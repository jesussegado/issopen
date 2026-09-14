import { expect, test } from "@playwright/test";

test("two tabs keep independent workspaces and switching asks before discarding a draft", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Email (required)")
    .fill("multiworkspace-e2e@example.test");
  await page
    .getByLabel("Password (required)")
    .fill("synthetic-multiworkspace-e2e-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a workspace" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Team A · member" }).click();
  await expect(
    page.getByRole("heading", { name: "Team A project", exact: true }),
  ).toBeVisible();
  const session = await (await page.request.get("/api/v1/session")).json();
  const teamA = session.workspaces.find(
    (w: { name: string }) => w.name === "Team A",
  );
  const teamB = session.workspaces.find(
    (w: { name: string }) => w.name === "Team B",
  );
  const project = (
    await (
      await page.request.get("/api/v1/projects", {
        headers: { "X-Issopen-Workspace": teamA.id },
      })
    ).json()
  ).projects[0];
  await page.goto(`/projects/${project.id}/issues/new?workspace=${teamA.id}`);
  await page.getByLabel("Title (required)").fill("Draft kept in Team A");
  const other = await context.newPage();
  await other.goto(`/?workspace=${teamA.id}`);
  other.once("dialog", (dialog) => dialog.accept());
  await other
    .getByRole("combobox", { name: "Workspace", exact: true })
    .selectOption(teamB.id);
  await expect(
    other.getByRole("combobox", { name: "Workspace", exact: true }),
  ).toHaveValue(teamB.id);
  await expect(page.getByLabel("Title (required)")).toHaveValue(
    "Draft kept in Team A",
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("combobox", { name: "Workspace", exact: true })
    .selectOption(teamB.id);
  await expect(page.getByLabel("Title (required)")).toHaveValue(
    "Draft kept in Team A",
  );
  await expect(
    page.getByRole("combobox", { name: "Workspace", exact: true }),
  ).toHaveValue(teamA.id);
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/captures") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create issue", exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON().projectId).toBe(project.id);
  expect(response.request().headers()["x-issopen-workspace"]).toBe(teamA.id);
  await expect(
    other.getByRole("combobox", { name: "Workspace", exact: true }),
  ).toHaveValue(teamB.id);
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  await other.close();
});
