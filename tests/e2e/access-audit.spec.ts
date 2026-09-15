import { expect, test } from "@playwright/test";
import { e2eBaseUrl } from "./fixtures.js";

test("Owner audits permission history with filters, pagination and safe error recovery", async ({
  page,
}, info) => {
  const variant = info.project.name.startsWith("mobile") ? "mobile" : "desktop";
  await page.goto("/sign-in");
  await page
    .getByLabel("Email (required)")
    .fill(`audit-owner-${variant}@example.test`);
  await page
    .getByLabel("Password (required)")
    .fill("synthetic-member-management-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/sign-in");
  const headers = { Origin: e2eBaseUrl };
  let member = (
    await (await page.request.get("/api/v1/members")).json()
  ).members.find(
    (m: { name: string }) => m.name === `Managed member ${variant}`,
  );
  const projectId = member.projectGrants[0].projectId;
  for (let i = 0; i < 22; i++) {
    const r = await page.request.patch(`/api/v1/members/${member.userId}`, {
      headers,
      data: {
        expectedVersion: member.version,
        grants: [{ projectId, permission: i % 2 ? "edit" : "read" }],
      },
    });
    expect(r.status()).toBe(200);
    member = (
      await (await page.request.get("/api/v1/members")).json()
    ).members.find((m: { userId: string }) => m.userId === member.userId);
  }
  await page.goto("/audit");
  await expect(
    page.getByRole("heading", { name: "Access audit", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".audit-event")).toHaveCount(20);
  await page.getByRole("button", { name: "Older events" }).click();
  await expect(page.locator(".audit-event")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Older events" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Newer events" }).click();
  await expect(page.locator(".audit-event")).toHaveCount(20);
  await page.getByLabel("Person name or ID").fill("not this person");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("No events match these filters.")).toBeVisible();
  await page.getByLabel("Person name or ID").fill(`Managed member ${variant}`);
  await page
    .getByRole("combobox", { name: "Action", exact: true })
    .selectOption("project.permission_changed");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".audit-event")).toHaveCount(20);
  await page
    .locator(".audit-event")
    .first()
    .getByText("Impact and reference")
    .click();
  await expect(page.locator(".audit-event").first()).toContainText(
    "Project permission:",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/issopen-audit-${variant}.png`,
    fullPage: true,
  });
  await page.getByLabel("Through date (UTC)").fill("2000-01-01");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("No events match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".audit-event")).toHaveCount(20);
  await page.route("**/api/v1/workspace/audit**", (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Owner access changed. Refresh your workspace.",
      }),
    }),
  );
  await page.getByRole("button", { name: "Refresh audit" }).click();
  await expect(page.getByRole("alert")).toContainText("Owner access changed");
  await expect(page.locator(".audit-event")).toHaveCount(0);
  await page.unroute("**/api/v1/workspace/audit**");
  await page.getByRole("button", { name: "Refresh audit" }).click();
  await expect(page.locator(".audit-event")).toHaveCount(20);
});
