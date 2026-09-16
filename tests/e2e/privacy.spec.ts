import { expect, test } from "@playwright/test";

test("public Gmail disclosure fits the viewport and keeps table overflow local", async ({
  page,
}) => {
  const privateRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/"))
      privateRequests.push(request.method());
  });
  await page.goto("/privacy");
  await expect(page.getByText(/Versión 1.2/)).toBeVisible();
  await expect(
    page.getByRole("rowheader", { name: "Invitaciones por correo" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Google Gmail como proveedor SMTP/),
  ).toBeVisible();
  expect(await page.evaluate(() => window.innerWidth)).toBe(
    page.viewportSize()?.width,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const table = page.locator(".privacy-table-wrap");
  expect(
    await table.evaluate((element) => element.clientWidth <= window.innerWidth),
  ).toBe(true);
  if ((page.viewportSize()?.width ?? 1440) < 620)
    expect(
      await table.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
  expect(privateRequests).toEqual([]);
});
