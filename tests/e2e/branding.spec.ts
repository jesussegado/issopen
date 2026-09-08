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
  await logo.evaluate((image: HTMLImageElement) => image.decode());
  const faviconSource = "/assets/branding/issopen-favicon-v2-white.png";

  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    faviconSource,
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    source,
  );
  const approved = await readFile(
    "src/web/public/assets/branding/icon-concepts/aperture-variants/issopen-aperture-07-seis-piezas-verde-bosque.png",
  );
  const favicon = await readFile(`src/web/public${faviconSource}`);
  const assets = [
    [source, approved],
    [faviconSource, favicon],
    ["/favicon.ico", favicon],
  ] as const;
  for (const [url, expected] of assets) {
    const response = await page.request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect(await response.body()).toEqual(expected);
  }

  const corners = await page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");
    context.drawImage(image, 0, 0);
    return [
      [5, 5],
      [canvas.width - 6, 5],
      [5, canvas.height - 6],
      [canvas.width - 6, canvas.height - 6],
    ].map(([x, y]) =>
      Array.from(context.getImageData(x ?? 0, y ?? 0, 1, 1).data),
    );
  }, faviconSource);
  for (const [red, green, blue, alpha] of corners) {
    expect(alpha).toBe(255);
    for (const channel of [red, green, blue]) {
      expect(channel).toBeGreaterThanOrEqual(250);
    }
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
