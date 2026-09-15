import { expect, test } from "@playwright/test";
import { e2eBaseUrl } from "./fixtures.js";

test("assigns a person, preserves conflict selection, filters tickets and warns after access removal", async ({
  page,
}, info) => {
  const variant = info.project.name.startsWith("mobile") ? "mobile" : "desktop";
  await page.goto("/sign-in");
  await page
    .getByLabel("Email (required)")
    .fill(`assignment-owner-${variant}@example.test`);
  await page
    .getByLabel("Password (required)")
    .fill("synthetic-member-management-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/sign-in");
  const session = await (await page.request.get("/api/v1/session")).json();
  const projects = (await (await page.request.get("/api/v1/projects")).json())
    .projects;
  const projectId = projects.find(
    (p: { name: string }) => p.name === "Project Alpha",
  ).id;
  const create = await page.request.post(
    `/api/v1/projects/${projectId}/issues`,
    {
      headers: { Origin: e2eBaseUrl },
      data: { title: `Human assignment ${variant}` },
    },
  );
  expect(create.status()).toBe(201);
  const ticket = (await create.json()).issue;
  const people = (
    await (
      await page.request.get(`/api/v1/projects/${projectId}/collaborators`)
    ).json()
  ).collaborators;
  const member = people.find((p: { role: string }) => p.role === "member");
  await page.goto(`/issues/${ticket.id}`);
  const panel = page.getByRole("region", {
    name: "Human assignment",
    exact: true,
  });
  await expect(
    panel.getByText("Human: Unassigned", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Change assignee" }).click();
  await panel.getByRole("button", { name: "Find people" }).click();
  await panel
    .getByRole("button", { name: new RegExp(`Managed member ${variant}`) })
    .click();
  await expect(
    panel.getByText(`Selected: Managed member ${variant}`, { exact: true }),
  ).toBeVisible();
  // Independent write after selecting; explicit CAS compare must retain selection.
  expect(
    (
      await page.request.put(`/api/v1/issues/${ticket.id}/assignee`, {
        headers: { Origin: e2eBaseUrl },
        data: {
          assigneeId: session.user.id,
          expectedVersion: ticket.version,
          questionVersions: [],
        },
      })
    ).status(),
  ).toBe(200);
  await panel.getByRole("button", { name: "Save assignee" }).click();
  await expect(panel.getByRole("alert")).toContainText("changed");
  await expect(
    panel.getByRole("button", { name: "Save assignee" }),
  ).toBeDisabled();
  await panel
    .getByRole("button", { name: "Load current assignment to compare" })
    .click();
  await expect(
    panel.getByText(`Selected: Managed member ${variant}`, { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText(`Human: Access owner ${variant}`, { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Save assignee" }).click();
  await expect(
    panel.getByRole("button", { name: "Change assignee" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    panel.getByText(`Human: Managed member ${variant}`, { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/issopen-assignment-${variant}.png`,
    fullPage: true,
  });
  await page.goto(`/projects/${projectId}`);
  await page
    .getByRole("combobox", { name: "Human assignee", exact: true })
    .selectOption("mine");
  await expect(
    page.getByRole("heading", { name: "No matching issues" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Human assignee", exact: true })
    .selectOption("person");
  const selector = page.getByRole("region", { name: "Filter by person" });
  await selector.getByRole("button", { name: "Find people" }).click();
  await selector
    .getByRole("button", { name: new RegExp(`Managed member ${variant}`) })
    .click();
  await expect(page.locator(".issue-card")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Human assignee", exact: true })
    .selectOption("unassigned");
  await expect(
    page.getByRole("heading", { name: "No matching issues" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Human assignee", exact: true })
    .selectOption("all");
  await expect(page.locator(".issue-card")).toHaveCount(1);
  const members = (await (await page.request.get("/api/v1/members")).json())
    .members;
  const grant = members.find((p: { userId: string }) => p.userId === member.id);
  expect(
    (
      await page.request.patch(`/api/v1/members/${member.id}`, {
        headers: { Origin: e2eBaseUrl },
        data: { expectedVersion: grant.version, grants: [] },
      })
    ).status(),
  ).toBe(200);
  await page.goto(`/issues/${ticket.id}`);
  await expect(panel.getByText(/No longer has project access/)).toBeVisible();
  await panel.getByRole("button", { name: "Change assignee" }).click();
  await panel.getByRole("button", { name: "Choose unassigned" }).click();
  await panel.getByRole("button", { name: "Save assignee" }).click();
  await expect(
    panel.getByText("Human: Unassigned", { exact: true }),
  ).toBeVisible();
});
