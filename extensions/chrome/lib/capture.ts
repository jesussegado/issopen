import { browser } from "wxt/browser";
import { z } from "zod";
import {
  prepareCapturePage,
  restoreCapturePage,
  scrollCapturePage,
  selectCaptureArea,
  validCapturePage,
} from "./capture-page";
import { inspectableOrigin } from "./protocol";

export const captureModeSchema = z.enum(["crop", "viewport", "full"]);
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
    })
    .strict(),
  z.object({ ok: z.literal(false), message: z.string().max(240) }).strict(),
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
  if (capturing) return { ok: false, message: "Ya hay una captura en curso." };
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
    if (
      tab?.id === undefined ||
      !tab.url ||
      tab.incognito ||
      !inspectableOrigin(tab.url)
    )
      throw new Error("permission");
    // Auth screens and OAuth callbacks are never screenshot targets.
    if (
      /\/(?:sign-in|consent|oauth|extensions\/link)(?:\/|$)/.test(
        new URL(tab.url).pathname,
      )
    )
      return {
        ok: false,
        message:
          "No capturamos pantallas de acceso o consentimiento. Abre la página que quieras revisar.",
      };
    tabId = tab.id;
    windowId = tab.windowId;
    browser.tabs.onActivated.addListener(activated);
    browser.tabs.onUpdated.addListener(updated);
    const assertPage = async () => {
      const current = await browser.tabs.get(tab.id as number);
      if (changed || !current.active || current.url !== tab.url)
        throw new Error("page-changed");
    };
    const [identity] = await browser.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: () => true,
    });
    documentId = identity?.documentId;
    if (!documentId) throw new Error("Missing document");
    const target = { tabId, documentIds: [documentId] };
    const area =
      mode === "crop"
        ? (
            await browser.scripting.executeScript({
              target,
              func: selectCaptureArea,
            })
          )[0]?.result
        : null;
    if (mode === "crop" && !area)
      return {
        ok: false,
        message: "Selección cancelada. Vuelve a capturar cuando quieras.",
      };
    await assertPage();
    const [prepared] = await browser.scripting.executeScript({
      target,
      func: prepareCapturePage,
      args: [mode === "full"],
    });
    const page = prepared?.result;
    if (!page || page.origin !== new URL(tab.url).origin)
      throw new Error("Page unavailable");
    if (
      mode === "full" &&
      (page.scrollWidth > page.width + 2 ||
        page.scrollHeight > 16000 ||
        Math.ceil(page.scrollHeight / page.height) > 20)
    )
      return {
        ok: false,
        message:
          "La página supera el límite de captura completa (16.000 px/20 tramos o scroll horizontal). Usa viewport o recorte.",
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
        if (
          !after ||
          after.width !== page.width ||
          after.height !== page.height ||
          after.scrollHeight !== page.scrollHeight
        )
          throw new Error("Page changed size");
        position = after.y;
      }
      // Chrome permits at most two screenshot calls per second.
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(0, 550 - (Date.now() - lastScreenshot))),
      );
      await assertPage();
      if (
        !(
          await browser.scripting.executeScript({
            target,
            func: validCapturePage,
          })
        )[0]?.result
      )
        throw new Error("Page changed during capture");
      const raw = await browser.tabs.captureVisibleTab(windowId, {
        format: "png",
      });
      lastScreenshot = Date.now();
      await assertPage();
      if (
        !(
          await browser.scripting.executeScript({
            target,
            func: validCapturePage,
          })
        )[0]?.result
      )
        throw new Error("Page changed during capture");
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
            return {
              ok: false,
              message:
                "La captura es demasiado grande (32 megapíxeles). Reduce el zoom o elige recorte.",
            };
          canvas = new OffscreenCanvas(bitmap.width, outHeight);
        }
        if (
          bitmap.width !== canvas.width ||
          Math.abs(bitmap.height / page.height - scale) > 0.05
        )
          throw new Error("Viewport changed");
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
    if (blob.size > 8 * 1024 * 1024)
      return {
        ok: false,
        message: "La imagen supera 8 MiB. Elige un recorte más pequeño.",
      };
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
    };
  } catch {
    return {
      ok: false,
      message:
        "No se pudo capturar. Mantén la pestaña abierta, pulsa el icono de Issopen para dar permiso y reintenta. Si cambia de tamaño, usa viewport o recorte.",
    };
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
