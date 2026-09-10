import { expect, test } from "@playwright/test";
import { e2eOwner } from "./fixtures.js";

test("an open board receives tickets created by another browser tab", async ({
  context,
  page,
}, testInfo) => {
  const mobile = testInfo.project.name.startsWith("mobile");
  const suffix = mobile ? "Mobile" : "Desktop";
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

  const projectResponse = await page.evaluate(
    async ({ name, key }) => {
      const response = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, key }),
      });
      return {
        status: response.status,
        body: (await response.json()) as { project: { id: string } },
      };
    },
    { name: `${suffix} live board`, key: mobile ? "LVM" : "LVD" },
  );
  expect(projectResponse.status).toBe(201);
  const { project } = projectResponse.body;
  await page.goto(`/projects/${project.id}`);
  await expect(
    page.getByRole("heading", { name: "No issues yet" }),
  ).toBeVisible();

  const secondTab = await context.newPage();
  await secondTab.goto(`/projects/${project.id}`);
  const title = `${suffix} ticket from another tab`;
  const creation = await secondTab.evaluate(
    async ({ projectId, title }) => {
      const response = await fetch(`/api/v1/projects/${projectId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, priority: "medium", status: "backlog" }),
      });
      return response.status;
    },
    { projectId: project.id, title },
  );
  expect(creation).toBe(201);
  await expect(page.getByRole("link", { name: `1-${title}` })).toBeVisible({
    timeout: 5_000,
  });
  await secondTab.close();
});
