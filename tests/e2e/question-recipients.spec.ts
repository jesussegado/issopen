import { expect, test } from "@playwright/test";
import { e2eBaseUrl } from "./fixtures.js";

test("directs questions without losing answer drafts and filters my pending questions", async ({
  page,
}, info) => {
  const variant = info.project.name.startsWith("mobile") ? "mobile" : "desktop";
  const headers = { Origin: e2eBaseUrl };
  await page.goto("/sign-in");
  await page
    .getByLabel("Email (required)")
    .fill(`recipient-owner-${variant}@example.test`);
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
  const created = await page.request.post(
    `/api/v1/projects/${projectId}/issues`,
    { headers, data: { title: `Recipients ${variant}` } },
  );
  expect(created.status()).toBe(201);
  const ticket = (await created.json()).issue;
  const questions = [];
  for (const prompt of ["Which layout?", "Which next step?"]) {
    const response = await page.request.post(
      `/api/v1/issues/${ticket.id}/questions`,
      {
        headers,
        data: {
          prompt,
          recommendation: "Use A",
          options: [{ label: "A" }, { label: "B" }],
          recommendedOptionIndex: 0,
        },
      },
    );
    expect(response.status()).toBe(201);
    questions.push((await response.json()).question);
  }
  await page.goto(`/issues/${ticket.id}`);
  await page.getByRole("radio", { name: /^A/ }).check();
  const panel = page.getByRole("region", {
    name: "Question recipient",
    exact: true,
  });
  await panel.getByRole("button", { name: "Change recipient" }).click();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save answer", exact: true }),
  ).toBeDisabled();
  await panel.getByRole("button", { name: "Find people" }).click();
  await panel
    .getByRole("button", { name: new RegExp(`Managed member ${variant}`) })
    .click();
  expect(
    (
      await page.request.put(
        `/api/v1/issues/${ticket.id}/questions/${questions[0].id}/recipient`,
        {
          headers,
          data: {
            recipientId: session.user.id,
            expectedVersion: ticket.version,
            questionVersions: questions.map((q) => ({
              id: q.id,
              version: q.version,
            })),
          },
        },
      )
    ).status(),
  ).toBe(200);
  await panel.getByRole("button", { name: "Save recipient" }).click();
  await expect(panel.getByRole("alert")).toContainText("changed");
  await panel
    .getByRole("button", { name: "Compare current question recipients" })
    .click();
  await expect(
    panel.getByText(`Selected recipient: Managed member ${variant}`, {
      exact: true,
    }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: new RegExp(`Access owner ${variant}`) })
    .click();
  await panel.getByRole("button", { name: "Save recipient" }).click();
  await expect(
    panel.getByRole("button", { name: "Change recipient" }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: /^A/ })).toBeChecked();
  await expect(
    page.getByText("⚠ 1 unanswered for you", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/issopen-recipient-${variant}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save answer", exact: true }).click();
  await expect(
    page.getByText("Question 2 of 2", { exact: true }),
  ).toBeVisible();
  const detail = await (
    await page.request.get(`/api/v1/issues/${ticket.id}`)
  ).json();
  expect(detail.questions[0].answeredByUserId).toBe(session.user.id);
  expect(
    (
      await page.request.put(
        `/api/v1/issues/${ticket.id}/questions/${questions[1].id}/recipient`,
        {
          headers,
          data: {
            recipientId: session.user.id,
            expectedVersion: detail.issue.version,
            questionVersions: detail.questions.map(
              (q: { id: string; version: number }) => ({
                id: q.id,
                version: q.version,
              }),
            ),
          },
        },
      )
    ).status(),
  ).toBe(200);
  await page.goto(`/projects/${projectId}`);
  await page
    .getByRole("combobox", { name: "Show questions" })
    .selectOption("for_me");
  await expect(page.locator(".issue-card")).toHaveCount(1);
  await expect(page.getByText("⚠ 1 for you", { exact: true })).toBeVisible();
  await page.goto(`/issues/${ticket.id}`);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await panel.getByRole("button", { name: "Change recipient" }).click();
  await panel.getByRole("button", { name: "Find people" }).click();
  await panel
    .getByRole("button", { name: new RegExp(`Managed member ${variant}`) })
    .click();
  await panel.getByRole("button", { name: "Save recipient" }).click();
  await expect(
    panel.getByRole("button", { name: "Change recipient" }),
  ).toBeVisible();
  const member = (
    await (await page.request.get("/api/v1/members")).json()
  ).members.find((p: { role: string }) => p.role === "member");
  expect(
    (
      await page.request.patch(`/api/v1/members/${member.userId}`, {
        headers,
        data: {
          expectedVersion: member.version,
          grants: [{ projectId, permission: "read" }],
        },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    panel.getByText(/Recipient can no longer answer here/),
  ).toBeVisible();
  await page.getByRole("radio", { name: /^B/ }).check();
  await page.getByRole("button", { name: "Save answer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Change answer", exact: true }),
  ).toBeVisible();
  await page.goto(`/projects/${projectId}`);
  await page
    .getByRole("combobox", { name: "Show questions" })
    .selectOption("for_me");
  await expect(
    page.getByRole("heading", { name: "No matching issues" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Show questions" }),
  ).toBeVisible();
});
