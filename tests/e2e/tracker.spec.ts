import { expect, test } from "@playwright/test";
import { syntheticPng } from "../fixtures/png.js";
import { e2eBaseUrl, e2eOwner } from "./fixtures.js";

test("owner completes the tracker loop with native keyboard controls", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name.startsWith("mobile");
  const projectName = mobile ? "Mobile tracker" : "Desktop tracker";
  const issueTitle = `${projectName} keyboard workflow`;
  const epicTitle = `${projectName} MVP`;
  const epicDisplayName = `1-${epicTitle}`;

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
  await expect(
    page.getByRole("checkbox", { name: /Show Ready for Human Review/ }),
  ).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Show Done/ })).toBeChecked();
  await page
    .getByLabel("Description")
    .fill("Private end-to-end acceptance project");
  await page
    .getByLabel("Repository URL")
    .fill("https://git.example.test/owner/tracker");
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Issopen home" }).locator("img"),
  ).toBeVisible();

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
  await expect(
    page.getByText("Group the complete private MVP workflow."),
  ).toHaveCount(0);
  await page.getByRole("link", { name: epicDisplayName, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: epicDisplayName }),
  ).toBeVisible();
  await expect(
    page.getByText("Group the complete private MVP workflow."),
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
  await page.getByLabel("Choose images").setInputFiles({
    name: "review.png",
    mimeType: "image/png",
    buffer: syntheticPng(true),
  });
  await expect(page.getByText(/Image added/)).toBeVisible();
  await page.getByRole("button", { name: "Create issue" }).click();
  await expect(page.getByText("Issue created")).toBeVisible();
  await expect(
    page.getByRole("link", { name: `Epic: ${epicDisplayName}` }),
  ).toBeVisible();
  const issueId = new URL(page.url()).pathname.split("/").at(-1);
  if (!issueId) throw new Error("Expected issue identifier in detail URL");
  const issueResponse = await page.request.get(
    `${e2eBaseUrl}/api/v1/issues/${issueId}`,
  );
  const { issue } = await issueResponse.json();
  const issueRef = String(issue.number);
  const issueDisplayName = `${issueRef}-${issueTitle}`;
  expect(issue.key).toMatch(/^P[A-F0-9]{9}-1$/);
  await expect(
    page.getByRole("heading", { name: issueDisplayName }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Images and evidence (1)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Attachment 1 for this issue" }),
  ).toBeVisible();
  await expect(page.getByText(issue.key, { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: `Epic: ${epicDisplayName}` }).click();
  const createTicketInEpic = page.getByRole("link", {
    name: "Create ticket in Epic",
  });
  await expect(createTicketInEpic).toHaveCSS("gap", "8px");
  await expect(createTicketInEpic).toHaveAttribute(
    "href",
    `/projects/${issue.projectId}/issues/new?epic=${issue.epicId}`,
  );
  await page.getByRole("link", { name: issueDisplayName }).click();
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
  if (mobile) {
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close navigation" }),
    ).toHaveCount(0);
  }
  const epicOverview = page.getByRole("region", { name: "Epics" });
  await expect(
    epicOverview.getByRole("link", { name: epicDisplayName, exact: true }),
  ).toBeVisible();
  const boardFilters = page.getByRole("region", { name: "Filter tickets" });
  await expect(boardFilters).toBeVisible();
  await expect(boardFilters).toHaveCSS("display", "grid");
  if (!mobile) {
    const boardRegion = page.getByRole("region", {
      name: `${projectName} issue board`,
    });
    await expect
      .poll(() =>
        boardRegion.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        ),
      )
      .toBe(true);
    const firstColumnWidth = await boardRegion
      .locator(".board-column")
      .first()
      .evaluate((element) => element.getBoundingClientRect().width);
    expect(firstColumnWidth).toBeGreaterThanOrEqual(280);
    expect(firstColumnWidth).toBeLessThanOrEqual(360);
    await expect(
      page.getByText("Drag tickets between columns", { exact: false }),
    ).toBeVisible();
    const doneHeading = page.getByRole("heading", { name: "Done" });
    await doneHeading.scrollIntoViewIfNeeded();
    await expect(doneHeading).toBeInViewport();
  } else {
    await expect(page.locator(".touch-board-instructions")).toBeVisible();
    await expect(
      page.getByText("Drag tickets between columns", { exact: false }),
    ).toBeHidden();
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
  await expect(
    page.getByRole("link", { name: issueDisplayName }),
  ).toBeVisible();
  await expect(page.getByText("⚠ 1 unanswered")).toBeVisible();
  await page.getByLabel("Show questions").selectOption("warnings");
  await expect(
    page.getByRole("link", { name: issueDisplayName }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Collapse Backlog column" }).click();
  await expect(page.getByRole("link", { name: issueDisplayName })).toBeHidden();
  await page.getByRole("button", { name: "Expand Backlog column" }).click();
  await expect(
    page.getByRole("link", { name: issueDisplayName }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Show details for ${issueRef}` })
    .click();
  await expect(
    page.getByText("A plain-text result must remain accessible."),
  ).toBeVisible();

  const status = page.getByRole("combobox", {
    name: `Change status for ${issueRef}`,
  });
  await status.focus();
  for (const label of ["Ready", "In Progress"]) {
    await page.keyboard.press("ArrowDown");
    await expect(page.getByText(`${issueRef} moved to ${label}`)).toBeVisible();
    await expect(status).toBeFocused();
  }
  await expect(
    status.locator('option[value="ready_for_review"]'),
  ).toHaveAttribute("disabled", "");

  await page.getByRole("link", { name: issueDisplayName }).click();
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
  const answeredStatus = page.getByLabel(`Change status for ${issueRef}`);
  await expect(
    answeredStatus.locator('option[value="ready_for_review"]'),
  ).not.toHaveAttribute("disabled", "");
  await answeredStatus.selectOption("ready_for_review");
  await expect(
    page.getByText(`${issueRef} moved to Ready for Human Review`),
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
  await expect(page.getByLabel(`Change status for ${issueRef}`)).toHaveValue(
    "in_progress",
  );

  const detailStatus = page.getByLabel(`Change status for ${issueRef}`);
  await detailStatus.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByText(`${issueRef} moved to Ready for Human Review`),
  ).toBeVisible();
  await page.getByRole("button", { name: "Accept result" }).click();
  await expect(page.getByText("Result accepted")).toBeVisible();
  await expect(page.getByLabel(`Change status for ${issueRef}`)).toHaveValue(
    "done",
  );
  await expect(page.getByText(`Accepted result for ${issueRef}`)).toBeVisible();

  if (
    mobile &&
    (await page
      .getByRole("button", { name: "Close navigation" })
      .isVisible()
      .catch(() => false))
  )
    await page.getByRole("button", { name: "Close navigation" }).click();
  await page.getByRole("link", { name: `Epic: ${epicDisplayName}` }).click();
  const archiveButton = page.getByRole("button", { name: "Archive Epic" });
  await archiveButton.click();
  const archiveDialog = page.getByRole("dialog", {
    name: "Archive this Epic?",
  });
  await expect(archiveDialog).toBeVisible();
  await expect(archiveDialog.getByText(epicDisplayName)).toBeVisible();
  const archiveCancel = archiveDialog.getByRole("button", { name: "Cancel" });
  await expect(archiveCancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(archiveDialog).toBeHidden();
  await expect(archiveButton).toBeFocused();
  await archiveButton.click();
  await archiveDialog.getByRole("button", { name: "Confirm archive" }).click();
  await expect(page.getByText("Epic archived", { exact: true })).toBeVisible();
  await expect(page.getByText(/This Epic is archived/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: issueDisplayName }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create ticket in Epic" }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View on board" })).toHaveCount(
    0,
  );

  await page.goto(`/projects/${issue.projectId}`);
  await expect(page.getByRole("link", { name: issueDisplayName })).toHaveCount(
    0,
  );

  await page.goto(`/projects/${issue.projectId}/epics`);
  await expect(
    page.getByRole("heading", { name: "No active Epics" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show archived (1)" }).click();
  await expect(
    page.getByRole("link", { name: epicDisplayName, exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: epicDisplayName, exact: true }).click();
  await page.getByRole("button", { name: "Restore Epic" }).click();
  await expect(page.getByText("Epic restored", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create ticket in Epic" }),
  ).toBeVisible();
  await page.goto(`/projects/${issue.projectId}`);
  const restoredDoneColumn = page
    .getByRole("region", { name: `${projectName} issue board` })
    .locator("section.board-column")
    .filter({ has: page.getByRole("heading", { name: "Done" }) });
  await expect(
    restoredDoneColumn.getByRole("link", { name: issueDisplayName }),
  ).toBeVisible();

  await page.goto(`/projects/${issue.projectId}/settings`);
  await page
    .getByRole("checkbox", { name: /Show Ready for Human Review/ })
    .uncheck();
  await page.getByRole("checkbox", { name: /Show Done/ }).uncheck();
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ready for Human Review" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Done" })).toHaveCount(0);
  await expect(page.getByText(/1 hidden ticket is/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Issues hidden from this board" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await page.goto(`/issues/${issueId}`);
  await expect(
    page.getByRole("heading", { name: issueDisplayName }),
  ).toBeVisible();

  // Native dialog: safe initial focus, focus trap, Escape and explicit deletion.
  const closeNavigation = page.getByRole("button", {
    name: "Close navigation",
  });
  if (mobile && (await closeNavigation.isVisible().catch(() => false)))
    await closeNavigation.click();
  const deleteButton = page.getByRole("button", {
    name: "Delete ticket",
    exact: true,
  });
  await deleteButton.click();
  const dialog = page.getByRole("dialog", { name: "Delete this ticket?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(issueDisplayName)).toBeVisible();
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  await expect(cancel).toBeFocused();
  await dialog.screenshot({ path: testInfo.outputPath("delete-ticket.png") });
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Confirm deletion" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(deleteButton).toBeFocused();
  expect(
    (await page.request.get(`${e2eBaseUrl}/api/v1/issues/${issueId}`)).status(),
  ).toBe(200);
  await deleteButton.click();
  await cancel.click();
  await expect(dialog).toBeHidden();
  await deleteButton.click();
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
  const endpoint = `**/api/v1/issues/${issueId}`;
  await page.route(endpoint, (route) =>
    route.request().method() === "DELETE"
      ? route.abort("failed")
      : route.continue(),
  );
  await dialog.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Check your connection and retry",
  );
  await expect(dialog).toBeVisible();
  expect(
    (await page.request.get(`${e2eBaseUrl}/api/v1/issues/${issueId}`)).status(),
  ).toBe(200);
  await page.unroute(endpoint);
  await page.route(endpoint, (route) =>
    route.request().method() === "DELETE"
      ? route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "Changed" }),
        })
      : route.continue(),
  );
  await dialog.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Cancel, reload and review",
  );
  await page.unroute(endpoint);
  await cancel.click();
  await deleteButton.click();
  await dialog.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\?notice=Ticket%20deleted$/);
  await expect(page.getByText("Ticket deleted", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: issueDisplayName })).toHaveCount(
    0,
  );
  expect(
    (await page.request.get(`${e2eBaseUrl}/api/v1/issues/${issueId}`)).status(),
  ).toBe(404);
});
