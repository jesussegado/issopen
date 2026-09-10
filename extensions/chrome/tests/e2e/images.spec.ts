import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";

// Synthetic standalone UI fixture; real native panel/OAuth boundaries have their own E2E.
// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature.
test("uploads, pastes, removes and restores several images without reading a page or sending them", async ({}, info) => {
  const output = resolve(".output/chrome-mv3");
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${output}`,
      `--load-extension=${output}`,
    ],
  });
  try {
    const cdp = await context.browser()?.newBrowserCDPSession();
    if (!cdp) throw Error("Missing CDP");
    const { extensions } = await cdp.send("Extensions.getExtensions");
    const extension = extensions.find((e) => e.name === "Issopen");
    if (!extension) throw Error("Missing extension");
    const page = await context.newPage();
    const requests: string[] = [];
    context.on("request", (r) => {
      if (r.url().startsWith("http")) requests.push(r.url());
    });
    const origin = `chrome-extension://${extension.id}`;
    await page.goto(`${origin}/sidepanel.html`);
    await page.setViewportSize({ width: 320, height: 950 });
    const images = page.locator(".image-grid img"),
      input = page.getByLabel("Seleccionar imágenes");
    await expect(
      page.getByRole("button", { name: "Capturar página" }),
    ).toHaveCount(0);
    const fixture = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 80;
      c.height = 60;
      const ctx = c.getContext("2d");
      if (!ctx) throw Error();
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 80, 60);
      return ["image/png", "image/jpeg", "image/webp"].map((type) => ({
        type,
        data: c.toDataURL(type),
      }));
    });
    await input.setInputFiles(
      fixture.map((f, i) => ({
        name: `image-${i}`,
        mimeType: f.type,
        buffer: Buffer.from(f.data.split(",")[1] ?? "", "base64"),
      })),
    );
    await expect(images).toHaveCount(3);
    await expect(
      page.getByRole("status").filter({ hasText: "3 imágenes añadidas" }),
    ).toBeVisible();
    for (const image of await images.all())
      await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/);
    await page.getByRole("button", { name: "Quitar imagen 2" }).click();
    await expect(images).toHaveCount(2);
    await page.getByLabel("Título", { exact: true }).fill("Draft image ticket");
    await page.evaluate(async (data) => {
      const bytes = Uint8Array.from(atob(data.split(",")[1] ?? ""), (s) =>
        s.charCodeAt(0),
      );
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": new Blob([bytes], { type: "image/png" }),
        }),
      ]);
    }, fixture[0]?.data ?? "");
    await page.getByLabel("Título", { exact: true }).focus();
    await page.keyboard.press("Control+V");
    await expect(images).toHaveCount(3);
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
      "Draft image ticket",
    );
    await page.evaluate(() =>
      navigator.clipboard.writeText("Normal pasted description"),
    );
    await page
      .getByRole("textbox", { name: "Descripción", exact: true })
      .focus();
    await page.keyboard.press("Control+V");
    await expect(
      page.getByRole("textbox", { name: "Descripción", exact: true }),
    ).toHaveValue("Normal pasted description");
    await expect(images).toHaveCount(3);
    // Wait for the existing debounce's confirmed IndexedDB commit, not an arbitrary sleep.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              const r = indexedDB.open("issopen-reviewed-draft-v1", 1);
              r.onsuccess = () => {
                const db = r.result;
                const tx = db.transaction("draft");
                const q = tx.objectStore("draft").get("current");
                q.onsuccess = () => {
                  resolve(q.result?.evidence?.images?.length ?? 0);
                  db.close();
                };
              };
            }),
        ),
      )
      .toBe(3);
    await page.reload();
    await expect(images).toHaveCount(3);
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
      "Draft image ticket",
    );
    const first = await images.first().getAttribute("src");
    await page.getByRole("button", { name: "Tu cuenta", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(images.first()).toHaveAttribute("src", first ?? "");
    const png = {
      name: "small.png",
      mimeType: "image/png",
      buffer: Buffer.from(fixture[0]?.data.split(",")[1] ?? "", "base64"),
    };
    await input.setInputFiles([png, png, png]);
    await expect(page.getByRole("alert")).toContainText("hasta 5 imágenes");
    await expect(images).toHaveCount(3);
    await input.setInputFiles([
      png,
      {
        name: "bad.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from("<svg/>"),
      },
    ]);
    await expect(page.getByRole("alert")).toContainText("no es una imagen");
    await expect(images).toHaveCount(3);
    await input.setInputFiles({
      name: "too-big.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
    });
    await expect(page.getByRole("alert")).toContainText("8 MiB");
    await expect(images).toHaveCount(3);
    await input.setInputFiles(png);
    await expect(images).toHaveCount(4);
    await expect(page.getByRole("alert")).toHaveCount(0);
    // Button error/success branches use a controlled permission/clipboard fixture.
    // The native Ctrl+V path above does not mock permissions or the paste event.
    async function clipboardFixture(mode: "denied" | "empty" | "image") {
      await page.evaluate(
        ({ mode, png }) => {
          const extension = globalThis as unknown as {
            chrome: { permissions: { request: () => Promise<boolean> } };
          };
          extension.chrome.permissions.request = async () => mode !== "denied";
          Object.defineProperty(navigator.clipboard, "read", {
            configurable: true,
            value: async () => {
              if (mode === "denied")
                throw Error("Must not read denied clipboard");
              if (mode === "empty") return [];
              const data = Uint8Array.from(atob(png.split(",")[1] ?? ""), (s) =>
                s.charCodeAt(0),
              );
              return [
                new ClipboardItem({
                  "image/png": new Blob([data], { type: "image/png" }),
                }),
              ];
            },
          });
        },
        { mode, png: fixture[0]?.data ?? "" },
      );
    }
    await clipboardFixture("denied");
    await page
      .getByRole("button", { name: "Pegar imagen", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Ctrl+V");
    await expect(images).toHaveCount(4);
    await clipboardFixture("empty");
    await page
      .getByRole("button", { name: "Pegar imagen", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "No hay ninguna imagen copiada",
    );
    await expect(images).toHaveCount(4);
    await clipboardFixture("image");
    await page
      .getByRole("button", { name: "Pegar imagen", exact: true })
      .click();
    await expect(images).toHaveCount(5);
    await expect(page.getByRole("alert")).toHaveCount(0);
    for (const width of [320, 400]) {
      await page.setViewportSize({ width, height: 950 });
      await page.locator(".image-attachments").scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .locator(".image-attachments")
        .screenshot({ path: info.outputPath(`images-${width}.png`) });
    }
    expect(requests).toEqual([]);
  } finally {
    await context.close();
  }
});
