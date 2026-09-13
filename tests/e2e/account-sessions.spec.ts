import { expect, test } from "@playwright/test";
import { e2eBaseUrl, e2eOwner } from "./fixtures.js";

test("account sessions confirm and revoke another browser, then sign out here", async ({
  page,
  browser,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email (required)").fill(e2eOwner.email);
  await page.getByLabel("Password (required)").fill(e2eOwner.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Issopen" }),
  ).toBeHidden();
  if (
    await page
      .getByRole("heading", { name: "Name your workspace" })
      .isVisible()
      .catch(() => false)
  )
    await page.getByRole("button", { name: "Create workspace" }).click();
  await page.goto("/account");
  await expect(
    page.getByText("Current session", { exact: true }),
  ).toBeVisible();
  const secondContext = await browser.newContext({
    userAgent: "Mozilla/5.0 Linux Firefox/140",
  });
  try {
    const signedIn = await secondContext.request.post(
      `${e2eBaseUrl}/api/auth/sign-in/email`,
      {
        headers: { Origin: e2eBaseUrl },
        data: { email: e2eOwner.email, password: e2eOwner.password },
      },
    );
    expect(signedIn.status()).toBe(200);
    const secondPage = await secondContext.newPage();
    await secondPage.goto(`${e2eBaseUrl}/account`);
    await expect(
      secondPage.getByText("Current session", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Refresh sessions" }).click();
    const closeSecond = page.getByRole("button", {
      name: "Close session: Firefox · Linux",
      exact: true,
    });
    await expect(closeSecond).toBeEnabled();
    await closeSecond.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(
      (
        await secondContext.request.get(`${e2eBaseUrl}/api/v1/session`)
      ).status(),
    ).toBe(200);
    await closeSecond.click();
    await page.getByRole("button", { name: "Confirm closure" }).click();
    await expect(
      page.getByText("Web session closed.", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await secondContext.request.get(`${e2eBaseUrl}/api/v1/session`)
      ).status(),
    ).toBe(401);
    await expect(
      page.getByText("Current session", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Refresh sessions" }),
    ).toBeFocused();
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: window.innerWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
    await page.screenshot({
      path: `/tmp/issopen-account-sessions-${page.viewportSize()?.width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Sign out here" }).click();
    await page.getByRole("button", { name: "Confirm closure" }).click();
    await expect(
      page.getByRole("heading", { name: "Sign in to Issopen" }),
    ).toBeVisible();
  } finally {
    await secondContext.close();
  }
});
