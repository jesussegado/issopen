import { expect, test } from "@playwright/test";

test("read-only collaborators can browse board, questions and Epics without edit controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Email (required)")
    .fill("multiworkspace-e2e@example.test");
  await page
    .getByLabel("Password (required)")
    .fill("synthetic-multiworkspace-e2e-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Team B · member" }).click();
  await expect(
    page.getByRole("heading", { name: "Team B project", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create issue", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "1-Read-only fixture ticket", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "1-Read-only fixture ticket",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
  await expect(page.getByRole("radio", { name: /First/ })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save answer", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add comment", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Edit issue", exact: true }),
  ).toHaveCount(0);
  const issuePath = new URL(page.url()).pathname;
  await page.goto(`${issuePath}/edit${new URL(page.url()).search}`);
  await expect(
    page.getByText("Read-only project.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Title (required)" }),
  ).toHaveCount(0);
  await page.goto(`${issuePath}${new URL(page.url()).search}`);
  await page
    .getByRole("link", { name: /Epic: 1-Read-only fixture Epic/ })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "1-Read-only fixture Epic",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Archive Epic", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Edit Epic", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
