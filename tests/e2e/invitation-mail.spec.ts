import { expect, test } from "@playwright/test";

test("Owner filters invitations, rotates a manual link with confirmation and recovers from lost access", async ({
  page,
}, info) => {
  const variant = info.project.name.startsWith("mobile") ? "mobile" : "desktop";
  await page.goto("/sign-in");
  await page
    .getByLabel("Email (required)")
    .fill(`mail-owner-${variant}@example.test`);
  await page
    .getByLabel("Password (required)")
    .fill("synthetic-member-management-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/sign-in");
  await page.goto("/members");
  await expect(page.getByText(/Email is not configured/)).toBeVisible();
  await page
    .getByLabel("Google account email", { exact: false })
    .fill(`invite-${variant}@example.test`);
  await page.getByRole("checkbox", { name: /Project Alpha/ }).check();
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  const link = page.getByRole("textbox", {
    name: "Invitation link",
    exact: true,
  });
  await expect(link).toBeVisible();
  const old = await link.inputValue();
  await page
    .getByRole("textbox", { name: "Find invitations" })
    .fill("unmatched@example.test");
  await expect(page.getByText("No matching invitations")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Find invitations" })
    .fill(`invite-${variant}`);
  await page
    .getByRole("combobox", { name: "Email status", exact: true })
    .selectOption("manual");
  await expect(
    page
      .locator(".access-list")
      .getByText("Manual link (no email requested)", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Create new link", exact: true })
    .click();
  await expect(link).toHaveValue(old);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Create new link", exact: true })
    .click();
  await expect(link).not.toHaveValue(old);
  expect(
    (
      await page.request.get(
        old.replace("/invite/", "/api/public/invitations/"),
      )
    ).status(),
  ).toBe(404);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Revoke invitation", exact: true })
    .click();
  await expect(link).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Invitation status", exact: true })
    .selectOption("revoked");
  await expect(
    page.getByText(`invite-${variant}@example.test`, { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/issopen-invitation-mail-${variant}.png`,
    fullPage: true,
  });
  await page.route("**/api/v1/members", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: "Owner access changed" }),
    }),
  );
  await page
    .getByRole("button", { name: "Refresh invitations and members" })
    .click();
  await expect(page.getByRole("alert")).toContainText("Owner access changed");
  await expect(
    page.getByText(`invite-${variant}@example.test`, { exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/v1/members");
  await page
    .getByRole("button", { name: "Refresh invitations and members" })
    .click();
  await expect(
    page.getByText(`invite-${variant}@example.test`, { exact: true }),
  ).toBeVisible();
});
