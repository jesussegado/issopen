// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { BoardColumn } from "../../src/web/components/board/BoardColumn.js";
import { BoardIssueCard } from "../../src/web/components/board/BoardIssueCard.js";
import { BoardToolbar } from "../../src/web/components/board/BoardToolbar.js";
import type { Epic, Issue, Project } from "../../src/web/types.js";

const timestamp = "2026-09-23T12:00:00.000Z";
const project: Project = {
  id: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  name: "Project",
  key: "PRO",
  description: "",
  repositoryUrl: null,
  defaultBranch: "main",
  repositorySubdirectory: null,
  showReviewColumn: true,
  showDoneColumn: true,
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const epic: Epic = {
  id: "33333333-3333-4333-8333-333333333333",
  workspaceId: project.workspaceId,
  projectId: project.id,
  number: 3,
  title: "Refactor",
  description: "",
  archivedAt: null,
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  summary: {
    totalIssues: 1,
    doneIssues: 0,
    statusCounts: {
      backlog: 1,
      ready: 0,
      in_progress: 0,
      ready_for_review: 0,
      done: 0,
    },
  },
};
const issue: Issue = {
  id: "44444444-4444-4444-8444-444444444444",
  workspaceId: project.workspaceId,
  projectId: project.id,
  epicId: epic.id,
  number: 7,
  key: "PRO-7",
  title: "Keep the card contract",
  description: "Visible details",
  priority: "high",
  status: "backlog",
  humanOwnerId: "owner",
  claimedByAgentId: null,
  claimedAt: null,
  version: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
  questionSummary: {
    total: 2,
    answered: 1,
    unansweredBlocking: 1,
    directedUnanswered: 1,
  },
};

afterEach(cleanup);

it("keeps the compact card, warnings and accessible status alternative independent", async () => {
  const user = userEvent.setup();
  const onMove = vi.fn();
  const onToggle = vi.fn();
  render(
    <BoardIssueCard
      issue={issue}
      epic={epic}
      view={{
        expanded: true,
        canEdit: true,
        online: true,
        saving: false,
        dragEnabled: true,
        showReviewColumn: true,
      }}
      actions={{
        statusRef: () => {},
        onToggle,
        onMove,
        onDragStart: () => {},
        onDragEnd: () => {},
      }}
    />,
  );

  expect(screen.getByRole("link", { name: `7-${issue.title}` })).toBeVisible();
  expect(screen.getByRole("link", { name: "⚠ 1 for you" })).toBeVisible();
  expect(screen.getByRole("link", { name: "⚠ 1 unanswered" })).toBeVisible();
  expect(screen.getByText(issue.description)).toBeVisible();
  const status = screen.getByRole("combobox", { name: "Change status for 7" });
  expect(
    within(status).getByRole("option", { name: "Ready for Human Review" }),
  ).toBeDisabled();
  await user.selectOptions(status, "ready");
  expect(onMove).toHaveBeenCalledWith("ready");
  await user.click(screen.getByRole("button", { name: "Hide details for 7" }));
  expect(onToggle).toHaveBeenCalledOnce();
});

it("owns warning filtering and column disclosure without copying ticket state", async () => {
  const user = userEvent.setup();
  const clearIssue: Issue = {
    ...issue,
    id: "55555555-5555-4555-8555-555555555555",
    number: 8,
    title: "No warning",
    questionSummary: {
      total: 1,
      answered: 1,
      unansweredBlocking: 0,
    },
  };
  const onToggleColumn = vi.fn();
  render(
    <BoardColumn
      column={{ status: "backlog", issues: [issue, clearIssue] }}
      epics={[epic]}
      view={{
        warningFilter: "warnings",
        collapsed: false,
        dropTarget: false,
        canEdit: true,
        online: true,
        savingIssue: null,
        expandedIssues: new Set(),
        showReviewColumn: true,
        hidden: false,
      }}
      actions={{
        statusRef: () => {},
        onToggleColumn,
        onToggleIssue: () => {},
        onMoveIssue: () => {},
        onDragStart: () => {},
        onDragEnd: () => {},
        onDragOver: () => {},
        onDragLeave: () => {},
        onDrop: () => {},
      }}
    />,
  );

  expect(screen.getByRole("link", { name: `7-${issue.title}` })).toBeVisible();
  expect(
    screen.queryByRole("link", { name: `8-${clearIssue.title}` }),
  ).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Collapse Backlog column" }),
  );
  expect(onToggleColumn).toHaveBeenCalledOnce();
});

it("keeps board filter controls in a dedicated toolbar", async () => {
  const user = userEvent.setup();
  const onStatusChange = vi.fn();
  const onWarningChange = vi.fn();
  const onAssigneeModeChange = vi.fn();
  render(
    <BoardToolbar
      project={project}
      columns={[{ status: "backlog", issues: [issue] }]}
      epics={[epic]}
      status="all"
      epic="all"
      warning="all"
      assigneeMode="all"
      selectedPerson={null}
      onStatusChange={onStatusChange}
      onWarningChange={onWarningChange}
      onAssigneeModeChange={onAssigneeModeChange}
      onPersonChange={() => {}}
    />,
  );

  await user.selectOptions(
    screen.getByRole("combobox", { name: "Show status" }),
    "backlog",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Show questions" }),
    "warnings",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Human assignee" }),
    "mine",
  );
  expect(onStatusChange).toHaveBeenCalledWith("backlog");
  expect(onWarningChange).toHaveBeenCalledWith("warnings");
  expect(onAssigneeModeChange).toHaveBeenCalledWith("mine");
});
