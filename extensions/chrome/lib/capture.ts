import { browser } from "wxt/browser";
import { z } from "zod";
import {
  captureMetadataSchema,
  captureModeSchema,
  safePageUrl,
  selectedElementSchema,
} from "../../../src/shared/capture-contract";
import {
  CaptureFailure,
  captureErrorCodeSchema,
  captureFailure,
} from "./capture-errors";
import {
  prepareCapturePage,
  restoreCapturePage,
  scrollCapturePage,
  selectCaptureArea,
  validCapturePage,
} from "./capture-page";
import { inspectableOrigin } from "./protocol";

export { captureModeSchema };
export const captureRequestSchema = z
  .object({
    version: z.literal(1),
    type: z.literal("capture"),
    mode: captureModeSchema,
  })
  .strict();
export const captureResponseSchema = z.union([
  z
    .object({
      ok: z.literal(true),
      dataUrl: z.string().startsWith("data:image/png;base64,").max(12_000_000),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      origin: z.string(),
      mode: captureModeSchema,
      metadata: captureMetadataSchema.optional(),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      code: captureErrorCodeSchema.optional(),
      message: z.string().max(240),
    })
    .strict(),
]);
export type CaptureResponse = z.infer<typeof captureResponseSchema>;
type Mode = z.infer<typeof captureModeSchema>;
export function pixelRect(
  rect: { x: number; y: number; width: number; height: number },
  scale: number,
  width: number,
  height: number,
) {
  const x = Math.max(0, Math.min(width - 1, Math.floor(rect.x * scale)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(rect.y * scale)));
  return {
    x,
    y,
    width: Math.max(
      1,
      Math.min(width - x, Math.ceil((rect.x + rect.width) * scale) - x),
    ),
    height: Math.max(
      1,
      Math.min(height - y, Math.ceil((rect.y + rect.height) * scale) - y),
    ),
  };
}
let capturing = false;
// Shared across captures: rapid retries also count toward Chrome's quota.
let lastScreenshot = 0;
export async function capture(mode: Mode): Promise<CaptureResponse> {
  if (capturing) return captureFailure("busy");
  capturing = true;
  let tabId: number | undefined;
  let documentId: string | undefined;
  let changed = false;
  let windowId: number | undefined;
  const activated = (info: { windowId: number }) => {
    if (info.windowId === windowId) changed = true;
  };
  const updated = (id: number, info: { status?: string; url?: string }) => {
    if (id === tabId && (info.status === "loading" || info.url)) changed = true;
  };
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (tab?.id === undefined) return captureFailure("no-tab");
    if (tab.incognito) return captureFailure("unsupported-page");
    if (!tab.url) return captureFailure("page-access");
    if (!inspectableOrigin(tab.url)) return captureFailure("unsupported-page");
    // Auth screens and OAuth callbacks are never screenshot targets.
    if (
      /\/(?:sign-in|consent|oauth|extensions\/link)(?:\/|$)/.test(
        new URL(tab.url).pathname,
      )
    )
      return captureFailure("protected-page");
    tabId = tab.id;
    windowId = tab.windowId;
    browser.tabs.onActivated.addListener(activated);
    browser.tabs.onUpdated.addListener(updated);
    const assertPage = async () => {
      const current = await browser.tabs.get(tab.id as number);
      if (changed || !current.active || current.url !== tab.url)
        throw new CaptureFailure("page-changed");
    };
    const [identity] = await browser.scripting
      .executeScript({
        target: { tabId, frameIds: [0] },
        func: () => true,
      })
      .catch(() => {
        throw new CaptureFailure("page-access");
      });
    documentId = identity?.documentId;
    if (!documentId) throw new CaptureFailure("page-unavailable");
    const target = { tabId, documentIds: [documentId] };
    const chosen =
      mode === "element"
        ? selectedElementSchema.nullable().parse(
            (
              await browser.scripting.executeScript({
                target,
                files: ["/content-scripts/element.js"],
              })
            )[0]?.result ?? null,
          )
        : null;
    if (mode === "element" && !chosen)
      return captureFailure("selection-cancelled");
    const area =
      mode === "crop"
        ? (
            await browser.scripting.executeScript({
              target,
              func: selectCaptureArea,
            })
          )[0]?.result
        : null;
    if (mode === "crop" && !area) return captureFailure("selection-cancelled");
    await assertPage();
    const [prepared] = await browser.scripting.executeScript({
      target,
      func: prepareCapturePage,
      args: [mode === "full"],
    });
    const page = prepared?.result;
    if (page && "error" in page) return captureFailure(page.error);
    if (!page || page.origin !== new URL(tab.url).origin)
      throw new CaptureFailure("page-unavailable");
    if (
      mode === "full" &&
      (page.scrollWidth > page.width + 2 ||
        page.scrollHeight > 16000 ||
        Math.ceil(page.scrollHeight / page.height) > 20)
    )
      return captureFailure("full-page-limit");
    const assertStable = async () => {
      const status = (
        await browser.scripting.executeScript({
          target,
          func: validCapturePage,
        })
      )[0]?.result;
      if (status !== "ready")
        throw new CaptureFailure(status ?? "page-unavailable");
    };
    let canvas: OffscreenCanvas | undefined;
    let scale = 1;
    const totalHeight = mode === "full" ? page.scrollHeight : page.height;
    let captured = 0;
    do {
      await assertPage();
      let position = page.y;
      if (mode === "full") {
        const [scroll] = await browser.scripting.executeScript({
          target,
          func: scrollCapturePage,
          args: [captured],
        });
        const after = scroll?.result;
        if (!after) throw new CaptureFailure("page-unavailable");
        if (after.width !== page.width || after.height !== page.height)
          throw new CaptureFailure("viewport-changed");
        if (after.scrollHeight !== page.scrollHeight)
          throw new CaptureFailure("content-changed");
        position = after.y;
      }
      // Chrome permits at most two screenshot calls per second.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 550 - (Date.now() - lastScreenshot))),
      );
      await assertPage();
      await assertStable();
      const raw = await browser.tabs.captureVisibleTab(windowId, {
        format: "png",
      });
      lastScreenshot = Date.now();
      await assertPage();
      await assertStable();
      const bitmap = await createImageBitmap(await (await fetch(raw)).blob());
      try {
        if (!canvas) {
          scale = bitmap.width / page.width;
          const outHeight = Math.ceil(totalHeight * scale);
          if (
            bitmap.width > 8192 ||
            outHeight > 32000 ||
            bitmap.width * outHeight > 32_000_000
          )
            return captureFailure("image-too-large");
          canvas = new OffscreenCanvas(bitmap.width, outHeight);
        }
        if (
          bitmap.width !== canvas.width ||
          Math.abs(bitmap.height / page.height - scale) > 0.05
        )
          throw new CaptureFailure("viewport-changed");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");
        ctx.drawImage(
          bitmap,
          0,
          mode === "full" ? Math.round(position * scale) : 0,
        );
      } finally {
        bitmap.close();
      }
      captured =
        mode === "full"
          ? Math.min(totalHeight, position + page.height)
          : totalHeight;
    } while (captured < totalHeight);
    if (!canvas) throw new Error("Capture unavailable");
    if (chosen) {
      const rect = pixelRect(
        chosen.element.bounds,
        scale,
        canvas.width,
        canvas.height,
      );
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      const line = Math.max(2, Math.round(3 * scale));
      ctx.strokeStyle = "#027067";
      ctx.lineWidth = line;
      ctx.strokeRect(
        rect.x + line / 2,
        rect.y + line / 2,
        Math.max(1, rect.width - line),
        Math.max(1, rect.height - line),
      );
    }
    if (area) {
      const rect = pixelRect(area, scale, canvas.width, canvas.height);
      const cropped = new OffscreenCanvas(rect.width, rect.height);
      cropped
        .getContext("2d")
        ?.drawImage(
          canvas,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          0,
          0,
          rect.width,
          rect.height,
        );
      canvas = cropped;
    }
    const blob = await canvas.convertToBlob({ type: "image/png" });
    if (blob.size > 8 * 1024 * 1024) return captureFailure("image-too-heavy");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return {
      ok: true,
      dataUrl: `data:image/png;base64,${btoa(binary)}`,
      width: canvas.width,
      height: canvas.height,
      origin: page.origin,
      mode,
      metadata: {
        mode,
        ...(safePageUrl(tab.url)
          ? { url: safePageUrl(tab.url) as string }
          : {}),
        viewport: {
          width: page.width,
          height: page.height,
          devicePixelRatio: page.dpr,
        },
        capturedAt: new Date().toISOString(),
        ...(chosen ? { element: chosen.element, dom: chosen.dom } : {}),
      },
    };
  } catch (error) {
    return captureFailure(
      changed
        ? "page-changed"
        : error instanceof CaptureFailure
          ? error.code
          : "capture-failed",
    );
  } finally {
    browser.tabs.onActivated.removeListener(activated);
    browser.tabs.onUpdated.removeListener(updated);
    if (tabId !== undefined && documentId)
      await browser.scripting
        .executeScript({
          target: { tabId, documentIds: [documentId] },
          func: restoreCapturePage,
        })
        .catch(() => undefined);
    capturing = false;
  }
}
