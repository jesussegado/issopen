import { type FormEvent, useEffect, useRef, useState } from "react";
import { ConflictReview } from "../components/ConflictReview.js";
import {
  AppLink,
  Badge,
  Button,
  EmptyState,
  ErrorSummary,
  Field,
  OfflineBanner,
  PageHeading,
  Skeleton,
  StatusBanner,
  TextArea,
  TextInput,
} from "../components/ui.js";
import { ApiError, apiRequest, unavailable } from "../lib/api.js";
import { navigate } from "../lib/navigation.js";
import { useOnlineStatus } from "../lib/online.js";
import type { Epic, Issue, Project } from "../types.js";
import {
  epicLabel,
  issueLabel,
  issueStatuses,
  priorityLabels,
  statusLabels,
} from "../types.js";
import { UnavailableRoute } from "./TrackerForms.js";

const saveError =
  "We couldn't save your changes. Check your connection and try again.";

function errorDetails(error: unknown) {
  if (error instanceof ApiError)
    return error.fields.length > 0
      ? error.fields
      : [{ field: "request", message: error.message }];
  return [{ field: "request", message: saveError }];
}

function Progress({ epic }: { epic: Epic }) {
  const total = epic.summary.totalIssues;
  const done = epic.summary.doneIssues;
  const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="epic-progress">
      <div className="epic-progress-label">
        <span>{done} done</span>
        <span>
          {total} tickets · {percentage}%
        </span>
      </div>
      <progress
        max={Math.max(total, 1)}
        value={done}
        aria-label={`${epicLabel(epic)}: ${done} of ${total} tickets done`}
      />
    </div>
  );
}

function ArchiveEpicControl({
  epic,
  onChange,
}: {
  epic: Epic;
  onChange: (epic: Epic, notice: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnlineStatus();

  async function changeArchived(archived: boolean) {
    if (inFlight.current || !online) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiRequest<{ epic: Epic }>(
        `/api/v1/epics/${epic.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            archived,
            expectedVersion: epic.version,
          }),
        },
      );
      dialog.current?.close();
      onChange(response.epic, archived ? "Epic archived" : "Epic restored");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.status === 409
            ? "This Epic changed. Reload it and review the latest version before trying again."
            : caught.status === 403
              ? "You don't have permission to change this Epic."
              : "We couldn't confirm the change. Try again; the Epic and its tickets remain safe."
          : "We couldn't confirm the change. Check your connection and try again.",
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (epic.archivedAt) {
    return (
      <div className="archive-epic-control">
        <Button
          type="button"
          variant="secondary"
          disabled={!online || submitting}
          onClick={() => void changeArchived(false)}
        >
          {submitting ? "Restoring…" : "Restore Epic"}
        </Button>
        {error ? <StatusBanner error>{error}</StatusBanner> : null}
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={!online || submitting}
        onClick={() => {
          setError(null);
          dialog.current?.showModal();
        }}
      >
        Archive Epic
      </Button>
      <dialog
        ref={dialog}
        className="archive-epic-dialog"
        aria-labelledby="archive-epic-title"
        aria-describedby="archive-epic-description"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const buttons =
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            );
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (!first || !last) {
            event.preventDefault();
            return;
          }
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        onCancel={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
      >
        <h2 id="archive-epic-title">Archive this Epic?</h2>
        <p className="archive-epic-name">{epicLabel(epic)}</p>
        <p id="archive-epic-description">
          Its tickets will remain linked with their current statuses, but they
          will disappear from the board and active agent lists. Restoring the
          Epic returns every ticket to its previous column.
        </p>
        {error ? <StatusBanner error>{error}</StatusBanner> : null}
        {!online ? (
          <StatusBanner error>
            You are offline. Reconnect before archiving.
          </StatusBanner>
        ) : null}
        <div className="archive-epic-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={submitting || !online}
            onClick={() => void changeArchived(true)}
          >
            {submitting ? "Archiving…" : "Confirm archive"}
          </Button>
        </div>
      </dialog>
    </>
  );
}

export function EpicsRoute({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>(
    [],
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const online = useOnlineStatus();

  useEffect(() => {
    Promise.all([
      apiRequest<{ project: Project }>(`/api/v1/projects/${projectId}`),
      apiRequest<{ epics: Epic[] }>(
        `/api/v1/projects/${projectId}/epics?archived=all`,
      ),
    ])
      .then(([projectResponse, epicResponse]) => {
        setProject(projectResponse.project);
        setEpics(epicResponse.epics);
      })
      .catch((error) => {
        if (unavailable(error)) setMissing(true);
        else setErrors(errorDetails(error));
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  async function createEpic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors([]);
    setNotice(null);
    try {
      const response = await apiRequest<{ epic: Epic }>(
        `/api/v1/projects/${projectId}/epics`,
        {
          method: "POST",
          body: JSON.stringify({ title, description }),
        },
      );
      setEpics((current) => [...current, response.epic]);
      setTitle("");
      setDescription("");
      setNotice("Epic created");
    } catch (error) {
      setErrors(errorDetails(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Skeleton label="Loading Epics…" />;
  if (missing || !project) return <UnavailableRoute />;
  const activeEpics = epics.filter((epic) => !epic.archivedAt);
  const archivedEpics = epics.filter((epic) => epic.archivedAt);
  return (
    <div className="detail-column">
      <div className="page-header">
        <div>
          <PageHeading>Epics</PageHeading>
          <p className="metadata">
            Group related tickets inside {project.name}.
          </p>
        </div>
        <AppLink
          className="button button-secondary"
          href={`/projects/${project.id}`}
        >
          Return to board
        </AppLink>
      </div>
      {!online ? <OfflineBanner /> : null}
      <ErrorSummary errors={errors} />
      {notice ? <StatusBanner focus>{notice}</StatusBanner> : null}
      <div className="epic-layout">
        <section className="detail-panel" aria-labelledby="epic-list-heading">
          <div className="question-heading">
            <h2 id="epic-list-heading">Project Epics</h2>
            {archivedEpics.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                aria-expanded={showArchived}
                aria-controls="archived-epics"
                onClick={() => setShowArchived((current) => !current)}
              >
                {showArchived ? "Hide" : "Show"} archived (
                {archivedEpics.length})
              </Button>
            ) : null}
          </div>
          {activeEpics.length === 0 ? (
            <EmptyState
              heading="No active Epics"
              body="Create an Epic to group related tickets, or restore an archived one."
            />
          ) : (
            <ul className="epic-list">
              {activeEpics.map((epic) => (
                <li key={epic.id} className="epic-card">
                  <AppLink
                    className="epic-card-title"
                    href={`/epics/${epic.id}`}
                  >
                    {epicLabel(epic)}
                  </AppLink>
                  <Progress epic={epic} />
                </li>
              ))}
            </ul>
          )}
          {showArchived ? (
            <div id="archived-epics" className="archived-epics">
              <div className="question-heading">
                <h3>Archived Epics</h3>
                <Badge>{archivedEpics.length}</Badge>
              </div>
              <ul className="epic-list">
                {archivedEpics.map((epic) => (
                  <li key={epic.id} className="epic-card">
                    <div className="epic-card-heading">
                      <AppLink
                        className="epic-card-title"
                        href={`/epics/${epic.id}`}
                      >
                        {epicLabel(epic)}
                      </AppLink>
                      <Badge>Archived</Badge>
                    </div>
                    <Progress epic={epic} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
        <section className="detail-panel" aria-labelledby="create-epic-heading">
          <h2 id="create-epic-heading">Create Epic</h2>
          <form className="form-stack" onSubmit={createEpic}>
            <Field
              label="Title"
              htmlFor="epic-title"
              required
              error={errors.find((item) => item.field === "title")?.message}
            >
              <TextInput
                id="epic-title"
                required
                maxLength={240}
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
              />
            </Field>
            <Field
              label="Description"
              htmlFor="epic-description"
              helper="Explain the shared goal or outcome."
              error={
                errors.find((item) => item.field === "description")?.message
              }
            >
              <TextArea
                id="epic-description"
                maxLength={20000}
                value={description}
                onChange={(event) => setDescription(event.currentTarget.value)}
              />
            </Field>
            <Button type="submit" disabled={!online || submitting}>
              {submitting ? "Creating…" : "Create Epic"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}

export function EpicDetailRoute({ epicId }: { epicId: string }) {
  const [epic, setEpic] = useState<Epic | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("notice"),
  );
  const online = useOnlineStatus();

  useEffect(() => {
    async function load() {
      try {
        const detail = await apiRequest<{ epic: Epic; issues: Issue[] }>(
          `/api/v1/epics/${epicId}`,
        );
        const projectResponse = await apiRequest<{ project: Project }>(
          `/api/v1/projects/${detail.epic.projectId}`,
        );
        setEpic(detail.epic);
        setIssues(detail.issues);
        setProject(projectResponse.project);
      } catch (caught) {
        if (unavailable(caught)) setMissing(true);
        else setError("We couldn't load this Epic. Try again.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [epicId]);

  if (loading) return <Skeleton label="Loading Epic…" />;
  if (missing || !epic || !project) return <UnavailableRoute />;
  return (
    <div className="detail-column">
      <div className="page-header">
        <div>
          <div className="issue-metadata">
            <Badge>Epic</Badge>
            {epic.archivedAt ? <Badge>Archived</Badge> : null}
            <span>{project.name}</span>
          </div>
          <PageHeading>{epicLabel(epic)}</PageHeading>
        </div>
        <div className="page-actions">
          {!epic.archivedAt ? (
            <AppLink
              className="button button-secondary"
              href={`/projects/${project.id}?epic=${epic.id}`}
            >
              View on board
            </AppLink>
          ) : null}
          <AppLink
            className="button button-secondary"
            href={`/epics/${epic.id}/edit`}
          >
            Edit Epic
          </AppLink>
          {!epic.archivedAt ? (
            <AppLink
              className="button button-primary epic-create-button"
              href={`/projects/${project.id}/issues/new?epic=${epic.id}`}
            >
              <span aria-hidden="true">+</span> Create ticket in Epic
            </AppLink>
          ) : null}
          <ArchiveEpicControl
            epic={epic}
            onChange={(updated, message) => {
              setEpic({ ...updated, summary: epic.summary });
              setNotice(message);
            }}
          />
        </div>
      </div>
      {notice ? <StatusBanner>{notice}</StatusBanner> : null}
      {!online ? <OfflineBanner /> : null}
      {epic.archivedAt ? (
        <StatusBanner>
          This Epic is archived. Its tickets keep their previous statuses but
          stay hidden from the board until it is restored.
        </StatusBanner>
      ) : null}
      {error ? <StatusBanner error>{error}</StatusBanner> : null}
      <section className="detail-panel" aria-labelledby="epic-summary-heading">
        <h2 id="epic-summary-heading">Overview</h2>
        <p className="description">{epic.description || "No description"}</p>
        <Progress epic={epic} />
        <div className="epic-status-counts">
          {issueStatuses.map((status) => (
            <Badge key={status}>
              {statusLabels[status]}: {epic.summary.statusCounts[status]}
            </Badge>
          ))}
        </div>
      </section>
      <section className="detail-panel" aria-labelledby="epic-issues-heading">
        <div className="question-heading">
          <h2 id="epic-issues-heading">Related tickets</h2>
          <Badge>{issues.length}</Badge>
        </div>
        {issues.length === 0 ? (
          <EmptyState
            heading="No related tickets"
            body="Assign an existing ticket or create one inside this Epic."
          />
        ) : (
          <ul className="epic-issue-list">
            {issues.map((issue) => {
              const pendingQuestions = Math.max(
                0,
                (issue.questionSummary?.total ?? 0) -
                  (issue.questionSummary?.answered ?? 0),
              );
              return (
                <li key={issue.id}>
                  <div className="epic-issue-heading">
                    <AppLink href={`/issues/${issue.id}`}>
                      {issueLabel(issue)}
                    </AppLink>
                  </div>
                  <div className="issue-metadata">
                    <Badge>{statusLabels[issue.status]}</Badge>
                    <Badge>{priorityLabels[issue.priority]}</Badge>
                    {pendingQuestions > 0 ? (
                      <span className="badge warning-badge">
                        <span aria-hidden="true">⚠</span> {pendingQuestions}{" "}
                        unanswered{" "}
                        {pendingQuestions === 1 ? "question" : "questions"}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function EpicFormRoute({ epicId }: { epicId: string }) {
  const [epic, setEpic] = useState<Epic | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const online = useOnlineStatus();

  useEffect(() => {
    apiRequest<{ epic: Epic; issues: Issue[] }>(`/api/v1/epics/${epicId}`)
      .then((response) => {
        setEpic(response.epic);
        setTitle(response.epic.title);
        setDescription(response.epic.description);
      })
      .catch((error) => {
        if (unavailable(error)) setMissing(true);
        else setErrors(errorDetails(error));
      })
      .finally(() => setLoading(false));
  }, [epicId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors([]);
    try {
      const response = await apiRequest<{ epic: Epic }>(
        `/api/v1/epics/${epicId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title,
            description,
            expectedVersion: epic?.version,
          }),
        },
      );
      navigate(
        `/epics/${response.epic.id}?notice=${encodeURIComponent("Epic updated")}`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setConflict(true);
      setErrors(errorDetails(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Skeleton label="Loading Epic…" />;
  if (missing || !epic) return <UnavailableRoute />;
  return (
    <div className="reading-column">
      <PageHeading>Edit Epic</PageHeading>
      <p className="metadata">{epicLabel(epic)}</p>
      {!online ? <OfflineBanner /> : null}
      <ErrorSummary errors={errors} />
      {conflict ? (
        <ConflictReview
          url={`/api/v1/epics/${epicId}`}
          kind="epic"
          onUseBase={({ item }) => {
            setEpic(item as Epic);
            setConflict(false);
            setErrors([]);
          }}
        />
      ) : null}
      <form className="form-panel form-stack" onSubmit={save}>
        <Field
          label="Title"
          htmlFor="epic-title"
          required
          error={errors.find((item) => item.field === "title")?.message}
        >
          <TextInput
            id="epic-title"
            required
            maxLength={240}
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="epic-description"
          error={errors.find((item) => item.field === "description")?.message}
        >
          <TextArea
            id="epic-description"
            maxLength={20000}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </Field>
        <div className="form-actions">
          <Button type="submit" disabled={!online || submitting}>
            {submitting ? "Saving…" : "Save Epic"}
          </Button>
          <AppLink
            className="button button-secondary"
            href={`/epics/${epic.id}`}
          >
            Cancel
          </AppLink>
        </div>
      </form>
    </div>
  );
}
