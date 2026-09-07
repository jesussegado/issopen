import { expect, test } from "@playwright/test";
import { e2eBaseUrl, e2eOwner } from "./fixtures.js";

test("owner completes the tracker loop with native keyboard controls", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name.startsWith("mobile");
  const projectName = mobile ? "Mobile tracker" : "Desktop tracker";
  const issueTitle = `${projectName} keyboard workflow`;
  const epicTitle = `${projectName} MVP`;
  const epicDisplayName = `1/${epicTitle}`;

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
    await expect(
      page.getByRole("heading", { name: "No projects yet" }),
    ).toBeVisible();
  }

  await page.goto("/projects/new");
  await expect(
    page.getByRole("heading", { name: "Create project" }),
  ).toBeFocused();
  await page.getByLabel("Project name (required)").fill(projectName);
  await page
    .getByLabel("Description")
    .fill("Private end-to-end acceptance project");
  await page
    .getByLabel("Repository URL")
    .fill("https://git.example.test/owner/tracker");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

  await page.getByRole("link", { name: "Manage Epics" }).click();
  await expect(
    page.getByRole("heading", { name: "Epics", exact: true }),
  ).toBeFocused();
  await page.getByLabel("Title (required)").fill(epicTitle);
  await page
    .getByLabel("Description")
    .fill("Group the complete private MVP workflow.");
  await page.getByRole("button", { name: "Create Epic" }).click();
  await expect(page.getByText("Epic created")).toBeVisible();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/epics$/);
  await page.getByRole("link", { name: epicDisplayName }).click();
  await expect(
    page.getByRole("heading", { name: epicDisplayName }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create ticket in Epic" }).click();
  await expect(
    page.getByRole("heading", { name: "Create issue" }),
  ).toBeFocused();
  await expect(page.getByLabel("Epic")).toHaveValue(/.+/);
  await page.getByLabel("Title (required)").fill(issueTitle);
  await page
    .getByLabel("Description")
    .fill("A plain-text result must remain accessible.");
  await page.getByLabel("Priority").selectOption("high");
  await page.getByRole("button", { name: "Create issue" }).click();
  await expect(page.getByText("Issue created")).toBeVisible();
  await expect(
    page.getByRole("link", { name: `Epic: ${epicDisplayName}` }),
  ).toBeVisible();
  const issueKey = await page
    .locator(".issue-metadata .badge.mono")
    .first()
    .textContent();
  expect(issueKey).toBeTruthy();
  const issueId = new URL(page.url()).pathname.split("/").at(-1);
  if (!issueId) throw new Error("Expected issue identifier in detail URL");
  const question = await page.request.post(
    `${e2eBaseUrl}/api/v1/issues/${issueId}/questions`,
    {
      headers: { Origin: e2eBaseUrl },
      data: {
        prompt: "Which delivery should the MVP use?",
        recommendation: "Use the responsive web experience.",
        options: [
          {
            label: "Responsive web",
            description: "Works on desktop and mobile",
          },
          { label: "Desktop app", description: "Requires installation" },
        ],
        recommendedOptionIndex: 0,
      },
    },
  );
  expect(question.ok()).toBe(true);

  const projectLink = page.getByRole("link", {
    name: projectName,
    exact: true,
  });
  if (mobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  await projectLink.click();
  const epicOverview = page.getByRole("region", { name: "Epics" });
  await expect(
    epicOverview.getByRole("link", { name: epicDisplayName }),
  ).toBeVisible();
  if (!mobile) {
    const boardRegion = page.getByRole("region", {
      name: `${projectName} issue board`,
    });
    await expect
      .poll(() =>
        boardRegion.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      )
      .toBe(true);
    await expect(page.getByRole("heading", { name: "Done" })).toBeInViewport();
  }
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await expect(page.getByLabel("Show questions")).toBeVisible();
  await page.getByLabel("Show Epic").selectOption({ label: epicDisplayName });
  await expect(page).toHaveURL(/\?epic=/);
  await expect(page.getByRole("link", { name: issueTitle })).toBeVisible();
  await expect(page.getByText("⚠ 1 unanswered")).toBeVisible();
  await page.getByLabel("Show questions").selectOption("warnings");
  await expect(page.getByRole("link", { name: issueTitle })).toBeVisible();
  await page.getByRole("button", { name: "Collapse Backlog column" }).click();
  await expect(page.getByRole("link", { name: issueTitle })).toBeHidden();
  await page.getByRole("button", { name: "Expand Backlog column" }).click();
  await expect(page.getByRole("link", { name: issueTitle })).toBeVisible();
  await page
    .getByRole("button", { name: `Show details for ${issueKey}` })
    .click();
  await expect(
    page.getByText("A plain-text result must remain accessible."),
  ).toBeVisible();

  const status = page.getByRole("combobox", {
    name: `Change status for ${issueKey}`,
  });
  await status.focus();
  for (const label of ["Ready", "In Progress"]) {
    await page.keyboard.press("ArrowDown");
    await expect(page.getByText(`${issueKey} moved to ${label}`)).toBeVisible();
    await expect(status).toBeFocused();
  }
  await expect(
    status.locator('option[value="ready_for_review"]'),
  ).toHaveAttribute("disabled", "");

  await page.getByRole("link", { name: issueTitle }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await expect(
    page.getByText("Questions are blocking this ticket", { exact: false }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Responsive web/ }).check();
  await page.getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByText("1 of 1 answered")).toBeVisible();
  await expect(
    page.getByText("Questions are blocking this ticket", { exact: false }),
  ).toBeHidden();
  const answeredStatus = page.getByLabel(`Change status for ${issueKey}`);
  await expect(
    answeredStatus.locator('option[value="ready_for_review"]'),
  ).not.toHaveAttribute("disabled", "");
  await answeredStatus.selectOption("ready_for_review");
  await expect(
    page.getByText(`${issueKey} moved to Ready for Review`),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Review result" }),
  ).toBeVisible();
  await page.getByLabel("Link type").selectOption("commit");
  await page
    .getByLabel("URL (required)")
    .fill("https://git.example.test/owner/tracker/commit/abc123");
  await page.getByRole("button", { name: "Add code link" }).click();
  await expect(page.getByText("Code link added")).toBeVisible();

  await page.getByRole("button", { name: "Request changes" }).click();
  await page
    .getByLabel("Reason (required)")
    .fill("Please add the missing regression test.");
  await page.getByRole("button", { name: "Request changes" }).last().click();
  await expect(page.getByText("Changes requested")).toBeVisible();
  await expect(page.getByLabel(`Change status for ${issueKey}`)).toHaveValue(
    "in_progress",
  );

  const detailStatus = page.getByLabel(`Change status for ${issueKey}`);
  await detailStatus.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByText(`${issueKey} moved to Ready for Review`),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept result" }).click();
  await expect(page.getByText("Result accepted")).toBeVisible();
  await expect(page.getByLabel(`Change status for ${issueKey}`)).toHaveValue(
    "done",
  );
  await expect(page.getByText(`Accepted result for ${issueKey}`)).toBeVisible();
});
