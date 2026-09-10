import { type FormEvent, useEffect, useState } from "react";
import { ConflictReview } from "../components/ConflictReview.js";
import {
  AppLink,
  Button,
  EmptyState,
  ErrorSummary,
  Field,
  OfflineBanner,
  PageHeading,
  Select,
  Skeleton,
  StatusBanner,
  TextArea,
  TextInput,
} from "../components/ui.js";
import { ApiError, apiRequest, unavailable } from "../lib/api.js";
import { navigate } from "../lib/navigation.js";
import { useOnlineStatus } from "../lib/online.js";
import type {
  Epic,
  Issue,
  IssuePriority,
  IssueQuestion,
  IssueStatus,
  Project,
  Session,
} from "../types.js";
import {
  epicLabel,
  issuePriorities,
  issueStatuses,
  priorityLabels,
  statusLabels,
} from "../types.js";

const networkError =
  "We couldn't save your changes. Check your connection and try again.";

function errorDetails(error: unknown) {
  if (error instanceof ApiError)
    return error.fields.length > 0
      ? error.fields
      : [{ field: "request", message: error.message }];
  return [{ field: "request", message: networkError }];
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function HomeRoute({ projects }: { projects: Project[] }) {
  useEffect(() => {
    if (projects[0]) navigate(`/projects/${projects[0].id}`, true);
  }, [projects]);
  if (projects.length > 0) return <Skeleton label="Opening project…" />;
  return (
    <div className="reading-column">
      <PageHeading>No projects yet</PageHeading>
      <EmptyState
        heading="Create your first project"
        body="Create a project to start a private backlog."
        action={
          <AppLink className="button button-primary" href="/projects/new">
            Create project
          </AppLink>
        }
      />
    </div>
  );
}

export function WorkspaceSettingsRoute({
  session,
  onSaved,
}: {
  session: Session & { workspace: NonNullable<Session["workspace"]> };
  onSaved: (session: Session) => void;
}) {
  const [name, setName] = useState(session.workspace.name);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>(
    [],
  );
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const online = useOnlineStatus();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setErrors([]);
    setSubmitting(true);
    try {
      await apiRequest("/api/v1/workspace", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      const updated = await apiRequest<Session>("/api/v1/session");
      onSaved(updated);
      setSaved(true);
    } catch (error) {
      setErrors(errorDetails(error));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="reading-column">
      <PageHeading>Workspace settings</PageHeading>
      {saved ? <StatusBanner>Workspace saved</StatusBanner> : null}
      {!online ? <OfflineBanner /> : null}
      <ErrorSummary errors={errors} />
      <form className="form-panel form-stack" onSubmit={submit}>
        <Field
          label="Workspace name"
          htmlFor="name"
          required
          error={errors.find((item) => item.field === "name")?.message}
        >
          <TextInput
            id="name"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </Field>
        <Button type="submit" disabled={submitting || !online}>
          {submitting ? "Saving…" : "Save workspace"}
        </Button>
      </form>
    </div>
  );
}

type ProjectFormState = {
  name: string;
  key: string;
  description: string;
  repositoryUrl: string;
  defaultBranch: string;
  repositorySubdirectory: string;
  showReviewColumn: boolean;
  showDoneColumn: boolean;
};

const emptyProject: ProjectFormState = {
  name: "",
  key: "",
  description: "",
  repositoryUrl: "",
  defaultBranch: "",
  repositorySubdirectory: "",
  showReviewColumn: true,
  showDoneColumn: true,
};

export function ProjectFormRoute({
  projectId,
  onProjectsChanged,
}: {
  projectId?: string;
  onProjectsChanged: () => Promise<void>;
}) {
  const editing = Boolean(projectId);
  const [form, setForm] = useState<ProjectFormState>(() => ({
    ...emptyProject,
    key: editing
      ? ""
      : `P${crypto.randomUUID().replaceAll("-", "").slice(0, 9).toUpperCase()}`,
  }));
  const [loading, setLoading] = useState(editing);
  const [missing, setMissing] = useState(false);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);
  const online = useOnlineStatus();

  useEffect(() => {
    if (!projectId) return;
    apiRequest<{ project: Project }>(`/api/v1/projects/${projectId}`)
      .then(({ project }) =>
        setForm({
          name: project.name,
          key: project.key,
          description: project.description,
          repositoryUrl: project.repositoryUrl ?? "",
          defaultBranch: project.defaultBranch ?? "",
          repositorySubdirectory: project.repositorySubdirectory ?? "",
          showReviewColumn: project.showReviewColumn,
          showDoneColumn: project.showDoneColumn,
        }),
      )
      .catch((error) =>
        unavailable(error) ? setMissing(true) : setErrors(errorDetails(error)),
      )
      .finally(() => setLoading(false));
  }, [projectId]);

  function update<K extends keyof ProjectFormState>(
    field: K,
    value: ProjectFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors([]);
    setSubmitting(true);
    const body = {
      name: form.name,
      description: form.description,
      repositoryUrl: nullable(form.repositoryUrl),
      defaultBranch: nullable(form.defaultBranch),
      repositorySubdirectory: nullable(form.repositorySubdirectory),
      showReviewColumn: form.showReviewColumn,
      showDoneColumn: form.showDoneColumn,
      ...(!editing ? { key: form.key } : {}),
    };
    try {
      const response = await apiRequest<{ project: Project }>(
        editing ? `/api/v1/projects/${projectId}` : "/api/v1/projects",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );
      await onProjectsChanged();
      navigate(
        `/projects/${response.project.id}?notice=${encodeURIComponent(editing ? "Project saved" : "Project created")}`,
      );
    } catch (error) {
      setErrors(errorDetails(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Skeleton label="Loading project…" />;
  if (missing) return <UnavailableRoute />;
  return (
    <div className="reading-column">
      <PageHeading>
        {editing ? "Project settings" : "Create project"}
      </PageHeading>
      {!online ? <OfflineBanner /> : null}
      <ErrorSummary errors={errors} />
      <form className="form-panel form-stack" onSubmit={submit}>
        <Field
          label="Project name"
          htmlFor="name"
          required
          error={errors.find((item) => item.field === "name")?.message}
        >
          <TextInput
            id="name"
            required
            maxLength={120}
            value={form.name}
            onChange={(event) => update("name", event.currentTarget.value)}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="description"
          error={errors.find((item) => item.field === "description")?.message}
        >
          <TextArea
            id="description"
            maxLength={10000}
            value={form.description}
            onChange={(event) =>
              update("description", event.currentTarget.value)
            }
          />
        </Field>
        <fieldset className="field-group">
          <legend>Board columns</legend>
          <p>
            Choose which completion columns appear on this project's board.
            Hidden tickets keep their status and remain available by direct
            link.
          </p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={form.showReviewColumn}
              onChange={(event) =>
                update("showReviewColumn", event.currentTarget.checked)
              }
            />{" "}
            <strong>Show Ready for Human Review</strong>
            <span className="field-helper">
              Show work waiting for a person's review.
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={form.showDoneColumn}
              onChange={(event) =>
                update("showDoneColumn", event.currentTarget.checked)
              }
            />{" "}
            <strong>Show Done</strong>
            <span className="field-helper">
              Show completed work on the active board.
            </span>
          </label>
        </fieldset>
        <fieldset className="field-group">
          <legend>Repository context</legend>
          <p>
            Plain reference data only. Issopen does not access or clone the
            repository.
          </p>
          <Field
            label="Repository URL"
            htmlFor="repositoryUrl"
            error={
              errors.find((item) => item.field === "repositoryUrl")?.message
            }
          >
            <TextInput
              id="repositoryUrl"
              className="mono"
              type="url"
              maxLength={2048}
              value={form.repositoryUrl}
              onChange={(event) =>
                update("repositoryUrl", event.currentTarget.value)
              }
            />
          </Field>
          <Field
            label="Default branch"
            htmlFor="defaultBranch"
            error={
              errors.find((item) => item.field === "defaultBranch")?.message
            }
          >
            <TextInput
              id="defaultBranch"
              className="mono"
              maxLength={255}
              value={form.defaultBranch}
              onChange={(event) =>
                update("defaultBranch", event.currentTarget.value)
              }
            />
          </Field>
          <Field
            label="Repository subdirectory"
            htmlFor="repositorySubdirectory"
            error={
              errors.find((item) => item.field === "repositorySubdirectory")
                ?.message
            }
          >
            <TextInput
              id="repositorySubdirectory"
              className="mono"
              maxLength={512}
              value={form.repositorySubdirectory}
              onChange={(event) =>
                update("repositorySubdirectory", event.currentTarget.value)
              }
            />
          </Field>
        </fieldset>
        <div className="form-actions">
          <Button type="submit" disabled={submitting || !online}>
            {submitting
              ? editing
                ? "Saving…"
                : "Creating…"
              : editing
                ? "Save project"
                : "Create project"}
          </Button>
          {editing ? (
            <AppLink
              className="button button-secondary"
              href={`/projects/${projectId}`}
            >
              Return to board
            </AppLink>
          ) : (
            <AppLink className="button button-secondary" href="/">
              Cancel
            </AppLink>
          )}
        </div>
      </form>
    </div>
  );
}

type IssueFormState = {
  title: string;
  description: string;
  epicId: string;
  priority: IssuePriority;
  status: IssueStatus;
};

export function IssueFormRoute({
  projectId,
  issueId,
}: {
  projectId?: string;
  issueId?: string;
}) {
  const editing = Boolean(issueId);
  const [project, setProject] = useState<Project | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [expectedVersion, setExpectedVersion] = useState<number | undefined>();
  const [questionVersions, setQuestionVersions] = useState<
    { id: string; version: number }[]
  >([]);
  const [conflict, setConflict] = useState(false);
  const [form, setForm] = useState<IssueFormState>({
    title: "",
    description: "",
    epicId: "",
    priority: "medium",
    status: "backlog",
  });
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);
  const online = useOnlineStatus();

  useEffect(() => {
    async function load() {
      try {
        if (issueId) {
          const detail = await apiRequest<{
            issue: Issue;
            epic: Epic | null;
            questions?: IssueQuestion[];
          }>(`/api/v1/issues/${issueId}`);
          const [projectResponse, epicResponse] = await Promise.all([
            apiRequest<{ project: Project }>(
              `/api/v1/projects/${detail.issue.projectId}`,
            ),
            apiRequest<{ epics: Epic[] }>(
              `/api/v1/projects/${detail.issue.projectId}/epics`,
            ),
          ]);
          setProject(projectResponse.project);
          setEpics(epicResponse.epics);
          setExpectedVersion(detail.issue.version);
          setQuestionVersions(
            (detail.questions ?? []).map(({ id, version }) => ({
              id,
              version,
            })),
          );
          setForm({
            title: detail.issue.title,
            description: detail.issue.description,
            epicId: detail.issue.epicId ?? "",
            priority: detail.issue.priority,
            status: detail.issue.status,
          });
        } else if (projectId) {
          const [projectResponse, epicResponse] = await Promise.all([
            apiRequest<{ project: Project }>(`/api/v1/projects/${projectId}`),
            apiRequest<{ epics: Epic[] }>(
              `/api/v1/projects/${projectId}/epics`,
            ),
          ]);
          setProject(projectResponse.project);
          setEpics(epicResponse.epics);
          const requestedEpic = new URLSearchParams(window.location.search).get(
            "epic",
          );
          if (
            requestedEpic &&
            epicResponse.epics.some((epic) => epic.id === requestedEpic)
          ) {
            setForm((current) => ({ ...current, epicId: requestedEpic }));
          }
        }
      } catch (error) {
        if (unavailable(error)) setMissing(true);
        else setErrors(errorDetails(error));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [issueId, projectId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    setErrors([]);
    setSubmitting(true);
    try {
      const response = await apiRequest<{ issue: Issue }>(
        editing
          ? `/api/v1/issues/${issueId}`
          : `/api/v1/projects/${project.id}/issues`,
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({
            ...form,
            epicId: form.epicId || null,
            ...(editing ? { expectedVersion, questionVersions } : {}),
          }),
        },
      );
      navigate(
        `/issues/${response.issue.id}?notice=${encodeURIComponent(editing ? "Issue updated" : "Issue created")}`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setConflict(true);
      setErrors(errorDetails(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Skeleton label="Loading issue form…" />;
  if (missing || !project) return <UnavailableRoute />;
  return (
    <div className="reading-column">
      <PageHeading>{editing ? "Edit issue" : "Create issue"}</PageHeading>
      {!online ? <OfflineBanner /> : null}
      <ErrorSummary errors={errors} />
      {conflict && issueId ? (
        <ConflictReview
          url={`/api/v1/issues/${issueId}`}
          kind="issue"
          onUseBase={({ item, questions }) => {
            setExpectedVersion(item.version);
            setQuestionVersions(
              questions.map(({ id, version }) => ({ id, version })),
            );
            setConflict(false);
            setErrors([]);
          }}
        />
      ) : null}
      <form className="form-panel form-stack" onSubmit={submit}>
        <Field label="Project" htmlFor="project">
          <TextInput id="project" value={project.name} readOnly />
        </Field>
        <Field
          label="Title"
          htmlFor="title"
          required
          error={errors.find((item) => item.field === "title")?.message}
        >
          <TextInput
            id="title"
            required
            maxLength={240}
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.currentTarget.value })
            }
          />
        </Field>
        <Field
          label="Description"
          htmlFor="description"
          helper="Plain text only."
          error={errors.find((item) => item.field === "description")?.message}
        >
          <TextArea
            id="description"
            maxLength={50000}
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.currentTarget.value })
            }
          />
        </Field>
        <Field
          label="Epic"
          htmlFor="epic"
          helper="Optional. Group this ticket under a shared outcome."
          error={errors.find((item) => item.field === "epicId")?.message}
        >
          <Select
            id="epic"
            value={form.epicId}
            onChange={(event) =>
              setForm({ ...form, epicId: event.currentTarget.value })
            }
          >
            <option value="">No Epic</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epicLabel(epic)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority">
          <Select
            id="priority"
            value={form.priority}
            onChange={(event) =>
              setForm({
                ...form,
                priority: event.currentTarget.value as IssuePriority,
              })
            }
          >
            {issuePriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabels[priority]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select
            id="status"
            value={form.status}
            onChange={(event) =>
              setForm({
                ...form,
                status: event.currentTarget.value as IssueStatus,
              })
            }
          >
            {issueStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="form-actions">
          <Button type="submit" disabled={submitting || !online}>
            {submitting ? "Saving…" : editing ? "Save issue" : "Create issue"}
          </Button>
          <AppLink
            className="button button-secondary"
            href={
              editing
                ? `/issues/${issueId}`
                : form.epicId
                  ? `/projects/${project.id}?epic=${encodeURIComponent(form.epicId)}`
                  : `/projects/${project.id}`
            }
          >
            Cancel
          </AppLink>
        </div>
      </form>
    </div>
  );
}

export function UnavailableRoute() {
  return (
    <div className="reading-column">
      <PageHeading>This page isn't available.</PageHeading>
      <p>
        The link may be invalid, or you may not have access. Return to your
        projects and try again from there.
      </p>
      <AppLink className="button button-primary" href="/">
        Return to projects
      </AppLink>
    </div>
  );
}
