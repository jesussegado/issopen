import { resolve } from "node:path";
import { chromium, expect, type Locator, test } from "@playwright/test";

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixtures.
test("creation shortcuts stay above the fields, fit narrow panels and preserve input", async ({}, info) => {
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
    await page.goto(`chrome-extension://${extension.id}/sidepanel.html`);
    const project = page.getByRole("button", { name: "Crear proyecto aquí" });
    const epic = page.getByRole("button", { name: "Crear Epic aquí" });
    const shortcuts = page.getByRole("group", {
      name: "Crear proyecto o Epic",
    });
    const composer = page.locator(
      'section[aria-labelledby="composer-heading"]',
    );
    for (const width of [320, 400]) {
      await page.setViewportSize({ width, height: 1000 });
      await shortcuts.scrollIntoViewIfNeeded();
      const projectBox = await project.boundingBox();
      const epicBox = await epic.boundingBox();
      const searchBox = await page
        .getByRole("combobox", { name: "Proyecto", exact: true })
        .boundingBox();
      if (!projectBox || !epicBox || !searchBox)
        throw new Error("Missing fields");
      expect(Math.abs(projectBox.y - epicBox.y)).toBeLessThan(1);
      expect(projectBox.y + projectBox.height).toBeLessThan(searchBox.y);
      expect(projectBox.height).toBeGreaterThanOrEqual(44);
      expect(epicBox.x + epicBox.width).toBeLessThanOrEqual(width);
      await project.focus();
      await page.keyboard.press("Enter");
      await expect(project).toHaveAttribute("aria-expanded", "true");
      await page
        .getByLabel("Nombre del nuevo proyecto")
        .fill("Proyecto de prueba");
      await epic.click();
      await expect(project).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByLabel("Nombre del nuevo proyecto")).toBeHidden();
      await expect(
        page.getByText("Selecciona primero un proyecto", { exact: false }),
      ).toBeVisible();
      await page.getByLabel("Título del nuevo Epic").fill("Epic de prueba");
      await expect(
        page.getByRole("button", { name: "Crear Epic", exact: true }),
      ).toBeDisabled();
      await project.click();
      await expect(page.getByLabel("Nombre del nuevo proyecto")).toHaveValue(
        "Proyecto de prueba",
      );
      await expect(
        page.getByRole("button", { name: "Crear proyecto", exact: true }),
      ).toBeDisabled();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await composer.screenshot({
        path: info.outputPath(`composer-${width}.png`),
      });
      await project.focus();
      await page.keyboard.press("Space");
      await expect(project).toHaveAttribute("aria-expanded", "false");
    }
  } finally {
    await context.close();
  }
});

async function expectStack(controls: Locator[], width: number) {
  let previous: { x: number; y: number; width: number; height: number } | null =
    null;
  for (const control of controls) {
    const box = await control.boundingBox();
    if (!box) throw Error("Missing action");
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    if (previous) {
      expect(box.y - (previous.y + previous.height)).toBeGreaterThanOrEqual(12);
      expect(box.x).toBeCloseTo(previous.x);
      expect(box.width).toBeCloseTo(previous.width);
    }
    previous = box;
  }
}

// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature.
test("success link and final actions stack without collisions on narrow panels", async ({}, info) => {
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
    const extension = (
      await cdp.send("Extensions.getExtensions")
    ).extensions.find((e) => e.name === "Issopen");
    if (!extension) throw Error("Missing extension");
    const page = await context.newPage();
    // Explicit synthetic UI response: the root OAuth E2E covers actual API
    // submission, private images and idempotent retry with the same markup.
    await page.addInitScript(() => {
      const state = globalThis as unknown as {
        chrome: {
          runtime: { sendMessage: (message: unknown) => Promise<unknown> };
        };
        captureCalls: number;
      };
      state.captureCalls = 0;
      state.chrome.runtime.sendMessage = async (raw) => {
        const m = raw as {
          type: string;
          action?: string;
          payload?: { title: string };
        };
        if (m.type === "account-status")
          return {
            ok: true,
            connected: true,
            name: "Synthetic owner",
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            ownerId: "synthetic",
            workspaceId: "10000000-0000-4000-8000-000000000001",
            canWrite: true,
            apiVersion: 1,
            projects: [
              { id: "20000000-0000-4000-8000-000000000001", name: "Demo" },
            ],
          };
        if (m.type === "tickets" && m.action === "epics")
          return { ok: true, epics: [] };
        if (m.type === "tickets" && m.action === "capture") {
          state.captureCalls++;
          return {
            ok: true,
            issue: {
              id: "30000000-0000-4000-8000-000000000001",
              key: "DEMO-1",
              number: 1,
              title: m.payload?.title,
              url: "https://issopen.serviciosegado.com/issues/30000000-0000-4000-8000-000000000001",
            },
          };
        }
        return { ok: false, code: "network" };
      };
    });
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().startsWith("http")) requests.push(r.url());
    });
    await page.goto(`chrome-extension://${extension.id}/sidepanel.html`);
    await expect(page.locator("#account-status")).toHaveText("Conectada");
    await page
      .getByRole("combobox", { name: "Proyecto", exact: true })
      .fill("Demo");
    await page.getByRole("option", { name: "Demo", exact: true }).click();
    await page
      .getByLabel("Título", { exact: true })
      .fill("Prueba con un título largo que ocupa varias líneas en el panel");
    const imageData = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 2;
      canvas.height = 2;
      return canvas.toDataURL("image/png");
    });
    await page.getByLabel("Seleccionar imágenes").setInputFiles({
      name: "evidence.png",
      mimeType: "image/png",
      buffer: Buffer.from(imageData.split(",")[1] ?? "", "base64"),
    });
    await expect(
      page.getByRole("img", { name: "Imagen adjunta 1" }),
    ).toBeVisible();
    const send = page.getByRole("button", {
      name: "Enviar ticket",
      exact: true,
    });
    const discard = page.getByRole("button", {
      name: "Descartar borrador",
      exact: true,
    });
    for (const width of [320, 400]) {
      await page.setViewportSize({ width, height: 900 });
      await send.scrollIntoViewIfNeeded();
      await expectStack([send, discard], width);
    }
    await send.click();
    const link = page.getByRole("link", { name: "Abrir ticket en Issopen" });
    const prepare = page.getByRole("button", { name: "Preparar otro ticket" });
    await expect(link).toBeVisible();
    await expect(page.getByText("1 imagen adjunta enviada.")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Imágenes del ticket/ }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Quitar imagen 1" }),
    ).toHaveCount(0);
    await expect(page.getByText(/Todavía no se han enviado/)).toHaveCount(0);
    await expect(link).toHaveAttribute(
      "href",
      "https://issopen.serviciosegado.com/issues/30000000-0000-4000-8000-000000000001",
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noreferrer");
    for (const width of [320, 400]) {
      await page.setViewportSize({ width, height: 900 });
      await link.scrollIntoViewIfNeeded();
      await expectStack([link, prepare, discard], width);
      await expect(link).toHaveCSS("text-decoration-line", "none");
      await link.focus();
      await expect(link).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(prepare).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(discard).toBeFocused();
      await page
        .locator('section[aria-labelledby="composer-heading"]')
        .screenshot({ path: info.outputPath(`success-${width}.png`) });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await prepare.click();
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue("");
    await expect(
      page.getByRole("combobox", { name: "Proyecto", exact: true }),
    ).toHaveValue("Demo");
    await expect(link).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /Imágenes del ticket/ }),
    ).toBeVisible();
    await expect(page.locator(".image-grid img")).toHaveCount(0);
    await expect(send).toBeDisabled();
    expect(await page.evaluate("globalThis.captureCalls")).toBe(1);
    expect(requests).toEqual([]);
  } finally {
    await context.close();
  }
});
