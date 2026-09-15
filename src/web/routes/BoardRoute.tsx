import { useCallback, useEffect, useRef, useState } from "react";
import { AssigneeLabel } from "../components/AssigneeEditor.js";
import { CollaboratorPicker } from "../components/CollaboratorPicker.js";
import {
  AppLink,
  Badge,
  EmptyState,
  OfflineBanner,
  PageHeading,
  Select,
  Skeleton,
  StatusBanner,
} from "../components/ui.js";
import { ApiError, apiRequest, unavailable } from "../lib/api.js";
import { navigate, useLocation } from "../lib/navigation.js";
import { useOnlineStatus } from "../lib/online.js";
import { subscribeToProjectChanges } from "../lib/project-live.js";
import type { Epic, Issue, IssueStatus, Project } from "../types.js";
import {
  epicLabel,
  issueLabel,
  issueReference,
  issueStatuses,
  priorityLabels,
  statusLabels,
} from "../types.js";
import { UnavailableRoute } from "./TrackerForms.js";

type BoardColumn = { status: IssueStatus; issues: Issue[] };
type BoardResponse = {
  project: Project;
  columns: BoardColumn[];
  epics: Epic[];
  totalIssueCount?: number;
  hiddenIssueCount?: number;
};

function repositoryLabel(repositoryUrl: string | null) {
  if (!repositoryUrl) return null;
  try {
    const parsed = new URL(repositoryUrl);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return repositoryUrl;
  }
}

function EpicOverview({ epics }: { epics: Epic[] }) {
  return (
    <section className="project-epics" aria-labelledby="project-epics-heading">
      <div className="project-epics-header">
        <h2 id="project-epics-heading">Epics</h2>
        <Badge>{epics.length}</Badge>
      </div>
      {epics.length === 0 ? (
        <p className="metadata">No Epics yet.</p>
      ) : (
        <ul className="project-epic-list">
          {epics.map((epic) => {
            const { doneIssues, totalIssues } = epic.summary;
            return (
              <li className="project-epic-card" key={epic.id}>
                <div className="project-epic-title-row">
                  <AppLink
                    className="epic-card-title"
                    href={`/epics/${epic.id}`}
                  >
                    {epicLabel(epic)}
                  </AppLink>
                  <Badge>
                    {totalIssues} {totalIssues === 1 ? "ticket" : "tickets"}
                  </Badge>
                </div>
                <div className="epic-progress">
                  <div className="epic-progress-label">
                    <span>
                      {doneIssues}/{totalIssues} done
                    </span>
                    <span>
                      {totalIssues === 0
                        ? 0
                        : Math.round((doneIssues / totalIssues) * 100)}
                      %
                    </span>
                  </div>
                  <progress
                    max={Math.max(totalIssues, 1)}
                    value={doneIssues}
                    aria-label={`${epicLabel(epic)}: ${doneIssues} of ${totalIssues} tickets done`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function BoardRoute({
  projectId,
  canManageProject,
}: {
  projectId: string;
  canManageProject: boolean;
}) {
  const location = useLocation();
  const epicParameter = new URLSearchParams(location.split("?")[1] ?? "").get(
    "epic",
  );
  const epicFilter = epicParameter ?? "all";
  const [project, setProject] = useState<Project | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [totalIssueCount, setTotalIssueCount] = useState(0);
  const [hiddenIssueCount, setHiddenIssueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingIssue, setSavingIssue] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | IssueStatus>("all");
  const [assigneeMode, setAssigneeMode] = useState("all");
  const [selectedPerson, setSelectedPerson] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const assigneeFilter =
    assigneeMode === "person"
      ? selectedPerson?.id
      : assigneeMode === "all"
        ? undefined
        : assigneeMode;
  const [warningFilter, setWarningFilter] = useState<"all" | "warnings">("all");
  const [collapsedColumns, setCollapsedColumns] = useState<Set<IssueStatus>>(
    () => new Set(),
  );
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(
    () => new Set(),
  );
  const [announcement, setAnnouncement] = useState("");
  const [focusIssueId, setFocusIssueId] = useState<string | null>(null);
  const statusControls = useRef(new Map<string, HTMLSelectElement>());
  const boardRequest = useRef(0);
  const lastAppliedBoardRequest = useRef(0);
  const mounted = useRef(true);
  const boardRouteKey = `${projectId}:${epicFilter}:${assigneeFilter ?? "all"}`;
  const activeBoardRoute = useRef(boardRouteKey);
  activeBoardRoute.current = boardRouteKey;
  const online = useOnlineStatus();

  const refreshBoard = useCallback(
    async (initial = false) => {
      const request = ++boardRequest.current;
      const requestRoute = boardRouteKey;
      if (initial) {
        setLoading(true);
        setError(null);
      }
      const params = new URLSearchParams();
      if (epicFilter !== "all") params.set("epicId", epicFilter);
      if (assigneeFilter) params.set("assignee", assigneeFilter);
      const query = params.size ? `?${params}` : "";
      try {
        const board = await apiRequest<BoardResponse>(
          `/api/v1/projects/${projectId}/board${query}`,
        );
        if (
          !mounted.current ||
          requestRoute !== activeBoardRoute.current ||
          request < lastAppliedBoardRequest.current
        )
          return;
        lastAppliedBoardRequest.current = request;
        const visibleIssueCount = board.columns.reduce(
          (total, column) => total + column.issues.length,
          0,
        );
        setProject(board.project);
        setColumns(board.columns);
        setEpics(board.epics ?? []);
        setTotalIssueCount(board.totalIssueCount ?? visibleIssueCount);
        setHiddenIssueCount(board.hiddenIssueCount ?? 0);
        setMissing(false);
        setError(null);
        setLoading(false);
      } catch (caught) {
        if (
          !mounted.current ||
          requestRoute !== activeBoardRoute.current ||
          request < lastAppliedBoardRequest.current
        )
          return;
        if (unavailable(caught)) setMissing(true);
        else if (initial)
          setError(
            "We couldn't load this board. Check your connection and try again.",
          );
        setLoading(false);
      }
    },
    [boardRouteKey, epicFilter, projectId, assigneeFilter],
  );

  useEffect(() => {
    void refreshBoard(true);
  }, [refreshBoard]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    return subscribeToProjectChanges(
      projectId,
      () => void refreshBoard(),
      () => {
        setMissing(true);
        void refreshBoard(true);
      },
    );
  }, [projectId, refreshBoard]);

  useEffect(() => {
    if (!focusIssueId) return;
    const control = statusControls.current.get(focusIssueId);
    if (!control) return;
    control.focus();
    setFocusIssueId(null);
  }, [focusIssueId]);

  async function moveIssue(issue: Issue, status: IssueStatus) {
    if (status === issue.status) return;
    setSavingIssue(issue.id);
    setError(null);
    setAnnouncement("");
    try {
      const response = await apiRequest<{ issue: Issue }>(
        `/api/v1/issues/${issue.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status, expectedVersion: issue.version }),
        },
      );
      const updatedIssue: Issue = issue.questionSummary
        ? {
            ...issue,
            ...response.issue,
            questionSummary: issue.questionSummary,
          }
        : { ...issue, ...response.issue };
      const targetIsVisible = columns.some(
        (column) => column.status === updatedIssue.status,
      );
      setColumns((current) =>
        current.map((column) => ({
          ...column,
          issues:
            column.status === updatedIssue.status
              ? [
                  ...column.issues.filter(
                    (item) => item.id !== updatedIssue.id,
                  ),
                  updatedIssue,
                ].sort((a, b) => a.number - b.number)
              : column.issues.filter((item) => item.id !== updatedIssue.id),
        })),
      );
      if (targetIsVisible) {
        setCollapsedColumns((current) => {
          if (!current.has(updatedIssue.status)) return current;
          const next = new Set(current);
          next.delete(updatedIssue.status);
          return next;
        });
      } else {
        setHiddenIssueCount((current) => current + 1);
      }
      setAnnouncement(
        `${issueReference(updatedIssue)} moved to ${statusLabels[updatedIssue.status]}`,
      );
      setFocusIssueId(targetIsVisible ? response.issue.id : null);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? caught.message
          : "We couldn't save your changes. Check your connection and try again.",
      );
      setFocusIssueId(issue.id);
    } finally {
      setSavingIssue(null);
    }
  }

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

  if (loading) return <Skeleton label="Loading project board…" />;
  if (missing || !project) return <UnavailableRoute />;
  const issueCount = columns.reduce(
    (total, column) => total + column.issues.length,
    0,
  );
  const repository = repositoryLabel(project.repositoryUrl);
  const canEdit = project.canEdit !== false;
  const activeEpics = epics.filter((epic) => !epic.archivedAt);
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
      {error ? (
        <StatusBanner error focus>
          {error}
        </StatusBanner>
      ) : null}
      <EpicOverview epics={activeEpics} />
      {!canEdit ? (
        <StatusBanner>
          Read-only project. Ask the workspace owner for edit access.
        </StatusBanner>
      ) : null}
      {hiddenIssueCount > 0 ? (
        <StatusBanner>
          {hiddenIssueCount} hidden{" "}
          {hiddenIssueCount === 1 ? "ticket" : "tickets"}{" "}
          {hiddenIssueCount === 1 ? "is" : "are"} in columns disabled by{" "}
          <AppLink href={`/projects/${project.id}/settings`}>
            project settings
          </AppLink>
          .
        </StatusBanner>
      ) : null}
      {totalIssueCount === 0 &&
      epicFilter === "all" &&
      assigneeMode === "all" ? (
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
          <div className="board-toolbar">
            <label className="field" htmlFor="assignee-filter">
              <span>Human assignee</span>
              <Select
                id="assignee-filter"
                value={assigneeMode}
                onChange={(event) => setAssigneeMode(event.currentTarget.value)}
              >
                <option value="all">All people</option>
                <option value="mine">My tickets</option>
                <option value="unassigned">Unassigned</option>
                <option value="person">Choose a person</option>
              </Select>
            </label>
            <label className="field" htmlFor="epic-filter">
              <span>Show Epic</span>
              <Select
                id="epic-filter"
                value={epicFilter}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  navigate(
                    value === "all"
                      ? `/projects/${project.id}`
                      : `/projects/${project.id}?epic=${encodeURIComponent(value)}`,
                  );
                }}
              >
                <option value="all">All Epics</option>
                <option value="unassigned">No Epic</option>
                {activeEpics.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epicLabel(epic)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field" htmlFor="status-filter">
              <span>Show status</span>
              <Select
                id="status-filter"
                value={filter}
                onChange={(event) =>
                  setFilter(event.currentTarget.value as "all" | IssueStatus)
                }
              >
                <option value="all">All statuses</option>
                {columns.map((column) => (
                  <option key={column.status} value={column.status}>
                    {statusLabels[column.status]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field" htmlFor="warning-filter">
              <span>Show questions</span>
              <Select
                id="warning-filter"
                value={warningFilter}
                onChange={(event) =>
                  setWarningFilter(
                    event.currentTarget.value as "all" | "warnings",
                  )
                }
              >
                <option value="all">All tickets</option>
                <option value="warnings">Warnings only</option>
              </Select>
            </label>
          </div>
          {assigneeMode === "person" ? (
            <section className="detail-panel" aria-label="Filter by person">
              <p>
                {selectedPerson
                  ? `Showing tickets for ${selectedPerson.name}`
                  : "Choose a person below. All people are shown until you select someone."}
              </p>
              <CollaboratorPicker
                key={projectId}
                projectId={projectId}
                onChoose={(person) => setSelectedPerson(person)}
              />
            </section>
          ) : null}
          {issueCount === 0 ? (
            <EmptyState
              heading={
                hiddenIssueCount > 0
                  ? "Issues hidden from this board"
                  : "No matching issues"
              }
              body={
                hiddenIssueCount > 0
                  ? "The matching tickets keep their status and can be shown again from project settings."
                  : "No tickets match the selected Epic and human assignee filters."
              }
              action={
                hiddenIssueCount > 0 ? (
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
              <div className={`board board-columns-${columns.length}`}>
                {columns.map((column) => {
                  const visibleIssues = column.issues.filter(
                    (issue) =>
                      warningFilter === "all" ||
                      (issue.questionSummary?.unansweredBlocking ?? 0) > 0,
                  );
                  const columnCollapsed = collapsedColumns.has(column.status);
                  return (
                    <section
                      className={`board-column${columnCollapsed ? " is-collapsed" : ""}`}
                      key={column.status}
                      aria-labelledby={`column-${column.status}`}
                      hidden={filter !== "all" && filter !== column.status}
                    >
                      <div className="board-column-header">
                        <h2 id={`column-${column.status}`}>
                          {statusLabels[column.status]}
                        </h2>
                        <div className="board-column-actions">
                          <Badge>{visibleIssues.length}</Badge>
                          <button
                            className="disclosure-button"
                            type="button"
                            aria-expanded={!columnCollapsed}
                            aria-controls={`column-content-${column.status}`}
                            aria-label={`${columnCollapsed ? "Expand" : "Collapse"} ${statusLabels[column.status]} column`}
                            onClick={() => toggleColumn(column.status)}
                          >
                            <span aria-hidden="true">
                              {columnCollapsed ? "+" : "−"}
                            </span>
                          </button>
                        </div>
                      </div>
                      <div
                        id={`column-content-${column.status}`}
                        hidden={columnCollapsed}
                      >
                        {visibleIssues.length === 0 ? (
                          <p className="empty-column">
                            {warningFilter === "warnings"
                              ? "No tickets with warnings"
                              : "No issues"}
                          </p>
                        ) : (
                          <ul className="issue-list">
                            {visibleIssues.map((issue) => {
                              const issueEpic = epics.find(
                                (epic) => epic.id === issue.epicId,
                              );
                              const issueExpanded = expandedIssues.has(
                                issue.id,
                              );
                              return (
                                <li className="issue-card" key={issue.id}>
                                  <div className="issue-card-summary">
                                    <AppLink
                                      className="issue-card-title"
                                      href={`/issues/${issue.id}`}
                                    >
                                      {issueLabel(issue)}
                                    </AppLink>
                                    <button
                                      className="disclosure-button"
                                      type="button"
                                      aria-expanded={issueExpanded}
                                      aria-controls={`issue-preview-${issue.id}`}
                                      aria-label={`${issueExpanded ? "Hide" : "Show"} details for ${issueReference(issue)}`}
                                      onClick={() => toggleIssue(issue.id)}
                                    >
                                      <span aria-hidden="true">
                                        {issueExpanded ? "−" : "+"}
                                      </span>
                                    </button>
                                  </div>
                                  <AssigneeLabel issue={issue} />
                                  {(issue.questionSummary?.unansweredBlocking ??
                                    0) > 0 ? (
                                    <span
                                      className="badge warning-badge"
                                      role="status"
                                    >
                                      ⚠{" "}
                                      {
                                        issue.questionSummary
                                          ?.unansweredBlocking
                                      }{" "}
                                      unanswered
                                    </span>
                                  ) : null}
                                  <div
                                    id={`issue-preview-${issue.id}`}
                                    className="issue-card-details"
                                    hidden={!issueExpanded}
                                  >
                                    <div className="issue-metadata">
                                      {issue.epicId ? (
                                        <>
                                          <AppLink
                                            className="badge epic-badge"
                                            href={`/epics/${issue.epicId}`}
                                          >
                                            {issueEpic
                                              ? epicLabel(issueEpic)
                                              : "Epic"}
                                          </AppLink>
                                          {issueEpic?.archivedAt ? (
                                            <Badge>Archived Epic</Badge>
                                          ) : null}
                                        </>
                                      ) : null}
                                      <Badge>
                                        {priorityLabels[issue.priority]}
                                      </Badge>
                                      {(issue.questionSummary?.total ?? 0) >
                                      0 ? (
                                        <Badge>
                                          {issue.questionSummary?.answered}/
                                          {issue.questionSummary?.total} answers
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <p className="issue-card-description">
                                      {issue.description || "No description"}
                                    </p>
                                    {issue.claimedByAgentId ? (
                                      <p className="metadata">
                                        Agent: {issue.claimedByAgentId}
                                      </p>
                                    ) : null}
                                    {canEdit ? (
                                      <div className="card-status">
                                        <label htmlFor={`status-${issue.id}`}>
                                          <span>Status</span>
                                          <Select
                                            id={`status-${issue.id}`}
                                            ref={(control) => {
                                              if (control)
                                                statusControls.current.set(
                                                  issue.id,
                                                  control,
                                                );
                                              else
                                                statusControls.current.delete(
                                                  issue.id,
                                                );
                                            }}
                                            aria-label={`Change status for ${issueReference(issue)}`}
                                            aria-describedby={
                                              (issue.questionSummary
                                                ?.unansweredBlocking ?? 0) >
                                                0 &&
                                              issue.status !==
                                                "ready_for_review"
                                                ? `review-block-${issue.id}`
                                                : undefined
                                            }
                                            value={issue.status}
                                            disabled={
                                              !online ||
                                              savingIssue === issue.id
                                            }
                                            onChange={(event) =>
                                              void moveIssue(
                                                issue,
                                                event.currentTarget
                                                  .value as IssueStatus,
                                              )
                                            }
                                          >
                                            {issueStatuses.map((status) => (
                                              <option
                                                key={status}
                                                value={status}
                                                disabled={
                                                  status ===
                                                    "ready_for_review" &&
                                                  issue.status !==
                                                    "ready_for_review" &&
                                                  (issue.questionSummary
                                                    ?.unansweredBlocking ?? 0) >
                                                    0
                                                }
                                              >
                                                {statusLabels[status]}
                                              </option>
                                            ))}
                                          </Select>
                                        </label>
                                        {(issue.questionSummary
                                          ?.unansweredBlocking ?? 0) > 0 &&
                                        issue.status !== "ready_for_review" ? (
                                          <span
                                            id={`review-block-${issue.id}`}
                                            className="metadata"
                                          >
                                            Answer blocking questions before
                                            review.
                                          </span>
                                        ) : null}
                                        {savingIssue === issue.id ? (
                                          <span
                                            role="status"
                                            className="metadata"
                                          >
                                            Saving…
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <p className="metadata">
                                        {statusLabels[issue.status]}
                                      </p>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </section>
                  );
                })}
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
