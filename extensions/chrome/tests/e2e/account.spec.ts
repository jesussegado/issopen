import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixtures.
test("account details open from the header, support keyboard and preserve the composer", async ({}, info) => {
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
    if (!cdp) throw new Error("Missing Chrome CDP");
    const { extensions } = await cdp.send("Extensions.getExtensions");
    const extension = extensions.find((e) => e.name === "Issopen");
    if (!extension) throw new Error("Missing extension");
    const page = await context.newPage();
    // Standalone UI preview is not a trusted native side panel. Supply only
    // its account state; foundation/OAuth tests cover the real worker boundary.
    await page.addInitScript(() => {
      const state = globalThis as unknown as {
        chrome: {
          runtime: { sendMessage: (...args: unknown[]) => Promise<unknown> };
        };
        accountStatusRequests: number;
      };
      const original = state.chrome.runtime.sendMessage.bind(
        state.chrome.runtime,
      );
      state.accountStatusRequests = 0;
      state.chrome.runtime.sendMessage = (...args) => {
        if ((args[0] as { type?: string })?.type === "account-status") {
          state.accountStatusRequests++;
          return Promise.resolve({ ok: true, connected: false });
        }
        return original(...args);
      };
    });
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().startsWith("http")) requests.push(r.url());
    });
    await page.goto(`chrome-extension://${extension.id}/sidepanel.html`);
    const trigger = page.getByRole("button", {
      name: "Tu cuenta",
      exact: true,
    });
    const dialog = page.getByRole("dialog", { name: "Tu cuenta" });
    const close = page.getByRole("button", { name: "Cerrar cuenta" });
    await expect(trigger).toContainText("Sin conectar");
    await expect(dialog).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await page
      .getByLabel("Título", { exact: true })
      .fill("Borrador sin enviar");
    await page
      .getByLabel("Descripción", { exact: true })
      .fill("Contenido conservado");
    await page.getByRole("button", { name: "Crear proyecto aquí" }).click();
    await page
      .getByLabel("Nombre del nuevo proyecto")
      .fill("Proyecto pendiente");
    for (const width of [320, 400]) {
      await page.setViewportSize({ width, height: 700 });
      await trigger.scrollIntoViewIfNeeded();
      const box = await trigger.boundingBox();
      if (!box) throw new Error("Missing account button");
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: info.outputPath(`account-closed-${width}.png`),
      });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(dialog).toBeVisible();
      await expect(close).toBeFocused();
      await expect(
        page.getByRole("button", { name: "Conectar con Issopen" }),
      ).toBeVisible();
      // Background controls cannot steal focus while the native modal is open.
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Conectar con Issopen" }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Gestionar instalaciones en Issopen" }),
      ).toBeFocused();
      await trigger.evaluate((el: HTMLButtonElement) => el.focus());
      await expect(
        page.getByRole("link", { name: "Gestionar instalaciones en Issopen" }),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(close).toBeFocused();
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`account-open-${width}.png`),
      });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await trigger.click();
      await close.click();
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
        "Borrador sin enviar",
      );
      await expect(
        page.getByRole("textbox", { name: "Descripción", exact: true }),
      ).toHaveValue("Contenido conservado");
      await expect(page.getByLabel("Nombre del nuevo proyecto")).toHaveValue(
        "Proyecto pendiente",
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    expect(requests).toEqual([]);
    expect(await page.evaluate("globalThis.accountStatusRequests")).toBe(1);
  } finally {
    await context.close();
  }
});
