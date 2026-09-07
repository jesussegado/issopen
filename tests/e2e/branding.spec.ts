import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("the approved brand loads in the shell, favicon and touch icon", async ({
  page,
}) => {
  await page.goto("/sign-in");
  const home = page.getByRole("link", { name: "Issopen home" });
  const logo = home.locator("img");
  await expect(logo).toBeVisible();
  await expect
    .poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(1254);
  const source = await logo.getAttribute("src");
  if (!source) throw new Error("Missing brand source");

  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    source,
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    source,
  );
  const approved = await readFile(
    "src/web/public/assets/branding/icon-concepts/aperture-variants/issopen-aperture-07-seis-piezas-verde-bosque.png",
  );
  for (const url of [source, "/favicon.ico"]) {
    const response = await page.request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect(await response.body()).toEqual(approved);
  }

  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(243, 250, 247)",
  );
  const action = page.getByRole("button", { name: "Sign in", exact: true });
  await expect(action).toHaveCSS("background-color", "rgb(2, 112, 103)");
  await expect(action).toHaveCSS("color", "rgb(255, 255, 255)");
  await action.focus();
  await expect(action).toHaveCSS("outline-style", "solid");
  await expect(action).toHaveCSS("outline-color", "rgb(1, 83, 76)");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
