import { useEffect, useRef, useState } from "react";
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
import type { Epic, Issue, IssueStatus, Project } from "../types.js";
import {
  epicLabel,
  issueStatuses,
  priorityLabels,
  statusLabels,
} from "../types.js";
import { UnavailableRoute } from "./TrackerForms.js";

type BoardColumn = { status: IssueStatus; issues: Issue[] };

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
                <p className="metadata">
                  {epic.description || "No description"}
                </p>
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

export function BoardRoute({ projectId }: { projectId: string }) {
  const location = useLocation();
  const epicParameter = new URLSearchParams(location.split("?")[1] ?? "").get(
    "epic",
  );
  const epicFilter = epicParameter ?? "all";
  const [project, setProject] = useState<Project | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingIssue, setSavingIssue] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | IssueStatus>("all");
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
  const online = useOnlineStatus();

  useEffect(() => {
    setLoading(true);
    setError(null);
    const query =
      epicFilter === "all" ? "" : `?epicId=${encodeURIComponent(epicFilter)}`;
    apiRequest<{
      project: Project;
      columns: BoardColumn[];
      epics: Epic[];
    }>(`/api/v1/projects/${projectId}/board${query}`)
      .then((board) => {
        setProject(board.project);
        setColumns(board.columns);
        setEpics(board.epics ?? []);
        setMissing(false);
      })
      .catch((caught) => {
        if (unavailable(caught)) setMissing(true);
        else
          setError(
            "We couldn't load this board. Check your connection and try again.",
          );
      })
      .finally(() => setLoading(false));
  }, [epicFilter, projectId]);

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
          body: JSON.stringify({ status }),
        },
      );
      const updatedIssue: Issue = issue.questionSummary
        ? { ...response.issue, questionSummary: issue.questionSummary }
        : response.issue;
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
      setCollapsedColumns((current) => {
        if (!current.has(updatedIssue.status)) return current;
        const next = new Set(current);
        next.delete(updatedIssue.status);
        return next;
      });
      setAnnouncement(
        `${updatedIssue.key} moved to ${statusLabels[updatedIssue.status]}`,
      );
      setFocusIssueId(response.issue.id);
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
  return (
    <div className="detail-column board-page">
      <div className="page-header">
        <div>
          <PageHeading>{project.name}</PageHeading>
          <div className="issue-metadata">
            <Badge mono>{project.key}</Badge>
            {repository ? <span className="mono">{repository}</span> : null}
          </div>
        </div>
        <div className="page-actions">
          <AppLink
            className="button button-secondary"
            href={`/projects/${project.id}/settings`}
          >
            Project settings
          </AppLink>
          <AppLink
            className="button button-secondary"
            href={`/projects/${project.id}/epics`}
          >
            Manage Epics
          </AppLink>
          <AppLink
            className="button button-primary"
            href={`/projects/${project.id}/issues/new`}
          >
            Create issue
          </AppLink>
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
      <EpicOverview epics={epics} />
      {issueCount === 0 && epicFilter === "all" ? (
        <EmptyState
          heading="No issues yet"
          body="Create the first issue to start this project's backlog."
          action={
            <AppLink
              className="button button-primary"
              href={`/projects/${project.id}/issues/new`}
            >
              Create issue
            </AppLink>
          }
        />
      ) : (
        <>
          <div className="board-toolbar">
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
                {epics.map((epic) => (
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
                {issueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
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
          {issueCount === 0 ? (
            <EmptyState
              heading="No matching issues"
              body="This Epic filter does not contain any tickets yet."
              action={
                epicFilter !== "unassigned" ? (
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
              <div className="board">
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
                                    <Badge mono>{issue.key}</Badge>
                                    <AppLink
                                      className="issue-card-title"
                                      href={`/issues/${issue.id}`}
                                    >
                                      {issue.title}
                                    </AppLink>
                                    <button
                                      className="disclosure-button"
                                      type="button"
                                      aria-expanded={issueExpanded}
                                      aria-controls={`issue-preview-${issue.id}`}
                                      aria-label={`${issueExpanded ? "Hide" : "Show"} details for ${issue.key}`}
                                      onClick={() => toggleIssue(issue.id)}
                                    >
                                      <span aria-hidden="true">
                                        {issueExpanded ? "−" : "+"}
                                      </span>
                                    </button>
                                  </div>
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
                                        <AppLink
                                          className="badge epic-badge"
                                          href={`/epics/${issue.epicId}`}
                                        >
                                          {issueEpic
                                            ? epicLabel(issueEpic)
                                            : "Epic"}
                                        </AppLink>
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
                                    <p className="metadata">Owner: You</p>
                                    {issue.claimedByAgentId ? (
                                      <p className="metadata">
                                        Agent: {issue.claimedByAgentId}
                                      </p>
                                    ) : null}
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
                                          aria-label={`Change status for ${issue.key}`}
                                          aria-describedby={
                                            (issue.questionSummary
                                              ?.unansweredBlocking ?? 0) > 0 &&
                                            issue.status !== "ready_for_review"
                                              ? `review-block-${issue.id}`
                                              : undefined
                                          }
                                          value={issue.status}
                                          disabled={
                                            !online || savingIssue === issue.id
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
                                                status === "ready_for_review" &&
                                                issue.status !==
                                                  "ready_for_review" &&
                                                (issue.questionSummary
                                                  ?.unansweredBlocking ?? 0) > 0
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
