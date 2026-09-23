import { useEffect, useRef, useState } from "react";
import { BoardColumn } from "../components/board/BoardColumn.js";
import { BoardEpicOverview } from "../components/board/BoardEpicOverview.js";
import {
  BoardToolbar,
  type BoardWarningFilter,
} from "../components/board/BoardToolbar.js";
import {
  AppLink,
  EmptyState,
  OfflineBanner,
  PageHeading,
  RouteLoadError,
  Skeleton,
  StatusBanner,
} from "../components/ui.js";
import { useBoardDrag } from "../lib/board-drag.js";
import { useBoardModel } from "../lib/board-model.js";
import { useLocation } from "../lib/navigation.js";
import { useOnlineStatus } from "../lib/online.js";
import type { Issue, IssueStatus } from "../types.js";
import { issueReference, statusLabels } from "../types.js";
import { UnavailableRoute } from "./TrackerForms.js";

function repositoryLabel(repositoryUrl: string | null) {
  if (!repositoryUrl) return null;
  try {
    const parsed = new URL(repositoryUrl);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return repositoryUrl;
  }
}

export function BoardRoute({
  projectId,
  canManageProject,
}: {
  projectId: string;
  canManageProject: boolean;
}) {
  const location = useLocation();
  const epicFilter =
    new URLSearchParams(location.split("?")[1] ?? "").get("epic") ?? "all";
  const [statusFilter, setStatusFilter] = useState<"all" | IssueStatus>("all");
  const [assigneeMode, setAssigneeMode] = useState("all");
  const [selectedPerson, setSelectedPerson] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [warningFilter, setWarningFilter] = useState<BoardWarningFilter>("all");
  const [collapsedColumns, setCollapsedColumns] = useState<Set<IssueStatus>>(
    () => new Set(),
  );
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(
    () => new Set(),
  );
  const [announcement, setAnnouncement] = useState("");
  const [focusIssueId, setFocusIssueId] = useState<string | null>(null);
  const statusControls = useRef(new Map<string, HTMLSelectElement>());
  const online = useOnlineStatus();
  const assigneeFilter =
    assigneeMode === "person"
      ? selectedPerson?.id
      : assigneeMode === "all"
        ? undefined
        : assigneeMode;
  const questionsForMe = warningFilter === "for_me";
  const board = useBoardModel({
    projectId,
    epicFilter,
    assigneeFilter,
    questionsForMe,
  });
  const canEdit = board.project?.canEdit !== false;

  async function moveIssue(issue: Issue, status: IssueStatus) {
    setAnnouncement("");
    const moved = await board.moveIssue(issue, status);
    if (!moved) {
      setFocusIssueId(issue.id);
      return;
    }
    if (moved.targetIsVisible)
      setCollapsedColumns((current) => {
        if (!current.has(moved.issue.status)) return current;
        const next = new Set(current);
        next.delete(moved.issue.status);
        return next;
      });
    setAnnouncement(
      `${issueReference(moved.issue)} moved to ${statusLabels[moved.issue.status]}`,
    );
    setFocusIssueId(moved.targetIsVisible ? moved.issue.id : null);
  }

  const drag = useBoardDrag({
    columns: board.columns,
    canEdit,
    online,
    savingIssue: board.savingIssue,
    moveIssue: (issue, status) => void moveIssue(issue, status),
    announce: setAnnouncement,
  });

  useEffect(() => {
    if (!focusIssueId) return;
    const control = statusControls.current.get(focusIssueId);
    if (!control) return;
    control.focus();
    setFocusIssueId(null);
  }, [focusIssueId]);

  function toggleColumn(status: IssueStatus) {
    setCollapsedColumns((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function toggleIssue(issueId: string) {
    setExpandedIssues((current) => {
      const next = new Set(current);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  }

  if (board.loading) return <Skeleton label="Loading project board…" />;
  if (board.missing) return <UnavailableRoute />;
  if (!board.project && board.error)
    return (
      <RouteLoadError
        message={board.error}
        retrying={board.loading}
        online={online}
        onRetry={() => void board.refresh(true)}
      />
    );
  if (!board.project) return <UnavailableRoute />;

  const project = board.project;
  const issueCount = board.columns.reduce(
    (total, column) => total + column.issues.length,
    0,
  );
  const repository = repositoryLabel(project.repositoryUrl);
  const activeEpics = board.epics.filter((epic) => !epic.archivedAt);
  return (
    <div className="detail-column board-page">
      <div className="page-header">
        <div>
          <PageHeading>{project.name}</PageHeading>
          <div className="issue-metadata">
            {repository ? <span className="mono">{repository}</span> : null}
          </div>
        </div>
        <div className="page-actions">
          <AppLink
            className="button button-secondary"
            href={`/projects/${project.id}/collaborators`}
          >
            Collaborators
          </AppLink>
          {canManageProject ? (
            <AppLink
              className="button button-secondary"
              href={`/projects/${project.id}/settings`}
            >
              Project settings
            </AppLink>
          ) : null}
          <AppLink
            className="button button-secondary"
            href={`/projects/${project.id}/epics`}
          >
            {canEdit ? "Manage Epics" : "View Epics"}
          </AppLink>
          {canEdit ? (
            <AppLink
              className="button button-primary"
              href={`/projects/${project.id}/issues/new`}
            >
              Create issue
            </AppLink>
          ) : null}
        </div>
      </div>
      {new URLSearchParams(window.location.search).get("notice") ? (
        <StatusBanner>
          {new URLSearchParams(window.location.search).get("notice")}
        </StatusBanner>
      ) : null}
      {!online ? <OfflineBanner /> : null}
      {board.error ? (
        <StatusBanner error focus>
          {board.error}
        </StatusBanner>
      ) : null}
      <BoardEpicOverview epics={activeEpics} />
      {!canEdit ? (
        <StatusBanner>
          Read-only project. Ask the workspace owner for edit access.
        </StatusBanner>
      ) : null}
      {board.hiddenIssueCount > 0 ? (
        <StatusBanner>
          {board.hiddenIssueCount} hidden{" "}
          {board.hiddenIssueCount === 1 ? "ticket" : "tickets"}{" "}
          {board.hiddenIssueCount === 1 ? "is" : "are"} in columns disabled by{" "}
          <AppLink href={`/projects/${project.id}/settings`}>
            project settings
          </AppLink>
          .
        </StatusBanner>
      ) : null}
      {board.totalIssueCount === 0 &&
      epicFilter === "all" &&
      assigneeMode === "all" &&
      !questionsForMe ? (
        <EmptyState
          heading="No issues yet"
          body={
            canEdit
              ? "Create the first issue to start this project's backlog."
              : "Tickets will appear here when a collaborator creates them."
          }
          action={
            canEdit ? (
              <AppLink
                className="button button-primary"
                href={`/projects/${project.id}/issues/new`}
              >
                Create issue
              </AppLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <BoardToolbar
            project={project}
            columns={board.columns}
            epics={activeEpics}
            status={statusFilter}
            epic={epicFilter}
            warning={warningFilter}
            assigneeMode={assigneeMode}
            selectedPerson={selectedPerson}
            onStatusChange={setStatusFilter}
            onWarningChange={setWarningFilter}
            onAssigneeModeChange={setAssigneeMode}
            onPersonChange={setSelectedPerson}
          />
          {issueCount === 0 ? (
            <EmptyState
              heading={
                board.hiddenIssueCount > 0
                  ? "Issues hidden from this board"
                  : "No matching issues"
              }
              body={
                board.hiddenIssueCount > 0
                  ? "The matching tickets keep their status and can be shown again from project settings."
                  : "No tickets match the selected Epic and human assignee filters."
              }
              action={
                board.hiddenIssueCount > 0 ? (
                  <AppLink
                    className="button button-secondary"
                    href={`/projects/${project.id}/settings`}
                  >
                    Review board settings
                  </AppLink>
                ) : epicFilter !== "unassigned" ? (
                  <AppLink
                    className="button button-primary"
                    href={`/projects/${project.id}/issues/new?epic=${encodeURIComponent(epicFilter)}`}
                  >
                    Create ticket in Epic
                  </AppLink>
                ) : undefined
              }
            />
          ) : (
            <section
              className="board-region"
              aria-label={`${project.name} issue board`}
            >
              {canEdit ? (
                <p className="drag-instructions">
                  <span className="pointer-board-instructions">
                    Drag tickets between columns, or expand a ticket and use its
                    status selector.
                  </span>
                  <span className="touch-board-instructions">
                    Expand a ticket and use its status selector to move it.
                  </span>
                </p>
              ) : null}
              <div className={`board board-columns-${board.columns.length}`}>
                {board.columns.map((column) => (
                  <BoardColumn
                    key={column.status}
                    column={column}
                    epics={board.epics}
                    view={{
                      warningFilter,
                      collapsed: collapsedColumns.has(column.status),
                      dropTarget: drag.dragOverStatus === column.status,
                      canEdit,
                      online,
                      savingIssue: board.savingIssue,
                      expandedIssues,
                      showReviewColumn: project.showReviewColumn,
                      hidden:
                        statusFilter !== "all" &&
                        statusFilter !== column.status,
                    }}
                    actions={{
                      statusRef: (issueId, control) => {
                        if (control)
                          statusControls.current.set(issueId, control);
                        else statusControls.current.delete(issueId);
                      },
                      onToggleColumn: () => toggleColumn(column.status),
                      onToggleIssue: toggleIssue,
                      onMoveIssue: (issue, status) =>
                        void moveIssue(issue, status),
                      onDragStart: drag.startDragging,
                      onDragEnd: drag.finishDragging,
                      onDragOver: (event) =>
                        drag.dragOverColumn(event, column.status),
                      onDragLeave: (event) =>
                        drag.leaveColumn(event, column.status),
                      onDrop: (event) =>
                        drag.dropOnColumn(event, column.status),
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
      <p className="live-region" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
