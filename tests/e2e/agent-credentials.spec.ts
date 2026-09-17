import { expect, test } from "@playwright/test";
import { e2eOwner } from "./fixtures.js";

test("an Owner manages independent MCP keys without redisclosing secrets", async ({
  page,
}, testInfo) => {
  const suffix = testInfo.project.name;
  const agentName = `MCP keys ${suffix}`;
  const keyLabel = `VS Code ${suffix}`;

  await page.goto("/sign-in");
  await page.getByLabel("Email (required)").fill(e2eOwner.email);
  await page.getByLabel("Password (required)").fill(e2eOwner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Issopen" }),
  ).toBeHidden();

  if (
    await page
      .getByRole("heading", { name: "Name your workspace" })
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByRole("button", { name: "Create workspace" }).click();
  }
  await page.goto("/projects/new");
  await page
    .getByLabel("Project name (required)")
    .fill(`MCP credentials ${suffix}`);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(
    page.getByRole("heading", { name: `MCP credentials ${suffix}` }),
  ).toBeVisible();

  await page.goto("/agents");
  await page.getByRole("button", { name: "Create agent" }).click();
  await page.getByLabel("Name (required)").fill(agentName);
  await page.locator("fieldset").first().getByRole("checkbox").first().check();
  await page
    .locator("form")
    .getByRole("button", { name: "Create agent" })
    .click();
  const initialToken = await page
    .getByLabel("Personal access token")
    .inputValue();
  expect(initialToken).toMatch(/^issopen_pat_/);
  await page.getByRole("button", { name: "Finish key setup" }).click();
  await expect(page.getByLabel("Personal access token")).toHaveCount(0);

  const agentCard = page
    .getByRole("heading", { name: agentName })
    .locator("xpath=ancestor::article");
  await agentCard.getByRole("button", { name: "Create API key" }).click();
  await agentCard.getByLabel("Key label (required)").fill(keyLabel);
  await agentCard
    .getByRole("button", { name: "Create and reveal key" })
    .click();
  const secondToken = await page
    .getByLabel("Personal access token")
    .inputValue();
  expect(secondToken).toMatch(/^issopen_pat_/);
  expect(secondToken).not.toBe(initialToken);
  await page.getByRole("button", { name: "Finish key setup" }).click();
  await expect(page.getByLabel("Personal access token")).toHaveCount(0);

  const keyCard = page
    .getByRole("heading", { name: keyLabel })
    .locator("xpath=ancestor::article[1]");
  await keyCard.getByRole("button", { name: "Revoke key" }).click();
  await expect(page.getByRole("dialog")).toContainText("Other keys for");
  await page.getByRole("button", { name: "Revoke API key" }).click();
  await expect(keyCard.getByText(/Revoked · Fingerprint/)).toBeVisible();
  await expect(keyCard.getByRole("button", { name: "Revoke key" })).toHaveCount(
    0,
  );
  await expect(
    agentCard
      .getByRole("heading", { name: "Primary" })
      .locator("xpath=ancestor::article[1]")
      .getByRole("button", { name: "Revoke key" }),
  ).toBeVisible();
});
