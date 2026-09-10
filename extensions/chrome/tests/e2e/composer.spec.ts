import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";

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
      const searchBox = await page.getByLabel("Buscar proyecto").boundingBox();
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
