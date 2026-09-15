import { expect, test } from "@playwright/test";
import { e2eBaseUrl } from "./fixtures.js";

test("mentions once after an uncertain save and reads personal notifications with directed question links", async ({
  page,
  browser,
}, info) => {
  const variant = info.project.name.startsWith("mobile") ? "mobile" : "desktop";
  const headers = { Origin: e2eBaseUrl };
  const recipientContext = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 1440, height: 950 },
  });
  const memberPage = await recipientContext.newPage();
  try {
    await page.goto("/sign-in");
    await page
      .getByLabel("Email (required)")
      .fill(`notification-owner-${variant}@example.test`);
    await page
      .getByLabel("Password (required)")
      .fill("synthetic-member-management-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => url.pathname !== "/sign-in");
    const projects = (await (await page.request.get("/api/v1/projects")).json())
      .projects;
    const projectId = projects.find(
      (p: { name: string }) => p.name === "Project Alpha",
    ).id;
    const ticket = (
      await (
        await page.request.post(`/api/v1/projects/${projectId}/issues`, {
          headers,
          data: { title: `Notification work ${variant}` },
        })
      ).json()
    ).issue;
    await page.goto(`/issues/${ticket.id}`);
    await page
      .getByLabel("Add comment (required)")
      .fill("Plain <b>mention</b> evidence");
    await page.getByText("Mention people (0/8)", { exact: true }).click();
    await page.getByRole("button", { name: "Find people" }).click();
    await page
      .getByRole("button", { name: new RegExp(`Managed member ${variant}`) })
      .click();
    const attempts: string[] = [];
    await page.route(
      `**/api/v1/issues/${ticket.id}/comments`,
      async (route) => {
        attempts.push(route.request().postDataJSON().clientRequestId);
        const response = await route.fetch();
        if (attempts.length === 1) await route.abort("failed");
        else await route.fulfill({ response });
      },
    );
    await page
      .getByRole("button", { name: "Add comment", exact: true })
      .click();
    await expect(page.getByText(/We couldn't add this comment/)).toBeVisible();
    await expect(page.getByLabel("Add comment (required)")).toHaveValue(
      "Plain <b>mention</b> evidence",
    );
    await page
      .getByRole("button", { name: "Add comment", exact: true })
      .click();
    await expect(
      page.getByText("Comment added", { exact: true }),
    ).toBeVisible();
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toBe(attempts[1]);
    await expect(page.locator(".comment-item")).toHaveCount(1);
    await expect(page.locator(".comment-item b")).toHaveCount(0);
    await expect(page.locator(".mention-tags")).toContainText(
      `Managed member ${variant}`,
    );
    await memberPage.goto(`${e2eBaseUrl}/sign-in`);
    await memberPage
      .getByLabel("Email (required)")
      .fill(`notification-member-${variant}@example.test`);
    await memberPage
      .getByLabel("Password (required)")
      .fill("synthetic-member-management-password");
    await memberPage
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await memberPage.waitForURL((url) => url.pathname !== "/sign-in");
    await expect
      .poll(
        async () =>
          (
            await (
              await recipientContext.request.get(
                `${e2eBaseUrl}/api/v1/notifications`,
              )
            ).json()
          ).unread,
      )
      .toBe(1);
    await memberPage.screenshot({
      path: `/tmp/issopen-inbox-start-${variant}.png`,
      fullPage: true,
    });
    await memberPage
      .getByRole("link", { name: "Notifications, 1 unread", exact: true })
      .click();
    await expect(
      memberPage.getByText("Mentioned you", { exact: true }),
    ).toBeVisible();
    await memberPage
      .getByRole("button", { name: "Mark read", exact: true })
      .click();
    await expect(
      memberPage.getByRole("link", {
        name: "Notifications, 0 unread",
        exact: true,
      }),
    ).toBeVisible();
    await memberPage
      .getByRole("button", { name: "Mark unread", exact: true })
      .click();
    await expect(
      memberPage.getByRole("link", {
        name: "Notifications, 1 unread",
        exact: true,
      }),
    ).toBeVisible();
    await memberPage.getByLabel("Show notifications").selectOption("unread");
    await expect(memberPage.locator(".notification-item")).toHaveCount(1);
    const member = (
      await (
        await recipientContext.request.get(`${e2eBaseUrl}/api/v1/session`)
      ).json()
    ).user;
    const questions = [];
    for (const prompt of ["General question", "Directed second question"]) {
      questions.push(
        (
          await (
            await page.request.post(`/api/v1/issues/${ticket.id}/questions`, {
              headers,
              data: {
                prompt,
                recommendation: "A",
                options: [{ label: "A" }, { label: "B" }],
                recommendedOptionIndex: 0,
              },
            })
          ).json()
        ).question,
      );
    }
    const detail = await (
      await page.request.get(`/api/v1/issues/${ticket.id}`)
    ).json();
    expect(
      (
        await page.request.put(
          `/api/v1/issues/${ticket.id}/questions/${questions[1].id}/recipient`,
          {
            headers,
            data: {
              recipientId: member.id,
              expectedVersion: detail.issue.version,
              questionVersions: questions.map((q) => ({
                id: q.id,
                version: q.version,
              })),
            },
          },
        )
      ).status(),
    ).toBe(200);
    await memberPage
      .getByRole("button", { name: "Refresh notifications" })
      .click();
    await expect(memberPage.locator(".notification-item")).toHaveCount(2);
    await expect(
      memberPage.getByRole("link", {
        name: "Notifications, 2 unread",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await memberPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await memberPage.screenshot({
      path: `/tmp/issopen-notifications-${variant}.png`,
      fullPage: true,
    });
    await memberPage
      .locator(".notification-item")
      .filter({ hasText: "Question for you" })
      .getByRole("link")
      .click();
    await expect(
      memberPage.getByText("Question 2 of 2", { exact: true }),
    ).toBeVisible();
    await memberPage.getByRole("radio", { name: /^A/ }).check();
    await memberPage
      .getByRole("button", { name: "Save answer", exact: true })
      .click();
    await memberPage.goto(`${e2eBaseUrl}/notifications`);
    await expect(
      memberPage
        .locator(".notification-item")
        .filter({ hasText: "Question for you" }),
    ).toContainText("No longer pending");
  } finally {
    await recipientContext.close().catch(() => {});
  }
});
