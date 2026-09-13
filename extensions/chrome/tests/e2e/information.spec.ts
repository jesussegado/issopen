import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";

const key = "issopen-information-dismissed-v1";
async function fixture() {
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
  const cdp = await context.browser()?.newBrowserCDPSession();
  if (!cdp) throw Error("Missing CDP");
  const { extensions } = await cdp.send("Extensions.getExtensions");
  const extension = extensions.find((e) => e.name === "Issopen");
  if (!extension) throw Error("Missing extension");
  return { context, url: `chrome-extension://${extension.id}/sidepanel.html` };
}

// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature.
test("dismissal persists without losing draft and help stays in Account", async ({}, info) => {
  const { context, url } = await fixture();
  try {
    const requests: string[] = [];
    context.on("request", (r) => {
      if (r.url().startsWith("http")) requests.push(r.url());
    });
    const page = await context.newPage();
    await page.goto(url);
    const notice = page.locator(".info-notice");
    await expect(notice).toBeVisible();
    const text = await notice.locator(".information-content").innerText();
    await expect(
      notice.getByRole("link", { name: "política de privacidad y datos" }),
    ).toHaveAttribute("href", "https://issopen.serviciosegado.com/privacy");
    for (const width of [320, 400]) {
      await page.setViewportSize({ width, height: 800 });
      const box = await page
        .getByRole("button", { name: "Cerrar aviso informativo" })
        .boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await notice.screenshot({ path: info.outputPath(`notice-${width}.png`) });
    }
    await page
      .getByLabel("Título", { exact: true })
      .fill("Borrador conservado");
    const png = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 20;
      canvas.height = 20;
      return canvas.toDataURL("image/png");
    });
    await page.getByLabel("Seleccionar imágenes").setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: Buffer.from(png.split(",")[1] ?? "", "base64"),
    });
    await expect(page.locator(".image-grid img")).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              const request = indexedDB.open("issopen-reviewed-draft-v1", 1);
              request.onsuccess = () => {
                const db = request.result;
                const q = db
                  .transaction("draft")
                  .objectStore("draft")
                  .get("current");
                q.onsuccess = () => {
                  resolve(q.result?.evidence?.images?.length ?? 0);
                  db.close();
                };
              };
            }),
        ),
      )
      .toBe(1);
    // Another extension view observes the same UI preference, not a different draft.
    const mirror = await context.newPage();
    await mirror.goto(url);
    await expect(mirror.locator(".info-notice")).toBeVisible();
    await page.bringToFront();
    const close = page.getByRole("button", {
      name: "Cerrar aviso informativo",
    });
    await close.focus();
    await page.keyboard.press("Enter");
    await expect(notice).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Tu cuenta", exact: true }),
    ).toBeFocused();
    await expect(mirror.locator(".info-notice")).toHaveCount(0);
    await mirror.close();
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
      "Borrador conservado",
    );
    await expect(page.locator(".image-grid img")).toHaveCount(1);
    await page.reload();
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
      "Borrador conservado",
    );
    await expect(page.locator(".image-grid img")).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(async (key) => {
          const storage = (
            globalThis as unknown as {
              chrome: {
                storage: {
                  local: {
                    get: (key: string) => Promise<Record<string, unknown>>;
                  };
                };
              };
            }
          ).chrome.storage;
          return (await storage.local.get(key))[key];
        }, key),
      )
      .toBe(true);
    await expect(notice).toHaveCount(0);
    for (const width of [320, 400]) {
      await page.setViewportSize({ width, height: 800 });
      await page
        .getByRole("button", { name: "Tu cuenta", exact: true })
        .click();
      const help = page.getByRole("region", { name: "Ayuda e información" });
      await expect(help).toBeVisible();
      expect(await help.locator(".information-content").innerText()).toBe(text);
      await expect(
        help.getByRole("link", { name: "política de privacidad y datos" }),
      ).toHaveAttribute("href", "https://issopen.serviciosegado.com/privacy");
      expect(
        await page
          .getByRole("dialog")
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await help.screenshot({ path: info.outputPath(`help-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(notice).toHaveCount(0);
    }
    expect(requests).toEqual([]);
  } finally {
    await context.close();
  }
});

test("unavailable preference storage does not block closing or reading help", async () => {
  const { context, url } = await fixture();
  try {
    const page = await context.newPage();
    await page.addInitScript((key) => {
      const storage = (
        globalThis as unknown as {
          chrome: {
            storage: {
              local: {
                get: (key: string) => Promise<Record<string, unknown>>;
                set: (value: Record<string, unknown>) => Promise<void>;
              };
            };
          };
        }
      ).chrome.storage.local;
      const get = storage.get.bind(storage),
        set = storage.set.bind(storage);
      storage.get = (input) =>
        input === key
          ? Promise.reject(Error("Fixture unavailable"))
          : get(input);
      storage.set = (input) =>
        key in input
          ? Promise.reject(Error("Fixture unavailable"))
          : set(input);
    }, key);
    await page.goto(url);
    await expect(page.locator(".info-notice")).toBeVisible();
    await page
      .getByRole("button", { name: "Cerrar aviso informativo" })
      .click();
    await expect(page.locator(".info-notice")).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "No pudimos recordar" }),
    ).toBeVisible();
    await page.getByLabel("Título", { exact: true }).fill("Sigue editable");
    await page.getByRole("button", { name: "Tu cuenta", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Ayuda e información" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
      "Sigue editable",
    );
  } finally {
    await context.close();
  }
});
