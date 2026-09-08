import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  Button,
  EmptyState,
  ErrorSummary,
  Field,
  PageHeading,
  Select,
  Skeleton,
  StatusBanner,
  TextArea,
  TextInput,
} from "../components/ui.js";
import { ApiError, apiRequest } from "../lib/api.js";
import type { Agent, AgentScope, Project } from "../types.js";
import { agentScopes } from "../types.js";

const defaultScopes = agentScopes.filter(
  (scope) => scope !== "issues:close" && !scope.startsWith("epics:"),
);
const scopeLabels: Record<AgentScope, string> = {
  "issues:read": "Read issues",
  "issues:create": "Create issues",
  "questions:write": "Ask blocking questions",
  "comments:write": "Add progress comments",
  "issues:claim": "Claim or release work",
  "issues:write": "Edit issue fields",
  "code:link": "Link code results",
  "issues:review": "Move work through Ready for Review",
  "issues:close": "Close issues",
  "epics:create": "Create Epics (explicit opt-in)",
  "epics:write": "Edit Epics (explicit opt-in)",
};

function messageFor(error: unknown) {
  if (error instanceof ApiError) {
    return error.fields.length
      ? error.fields
      : [{ field: "request", message: error.message }];
  }
  return [
    {
      field: "request",
      message:
        "We couldn't save your changes. Check your connection and try again.",
    },
  ];
}

function dateLabel(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "Never";
}

export function AgentsRoute({ projects }: { projects: Project[] }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [scopes, setScopes] = useState<AgentScope[]>([...defaultScopes]);
  const [expiresInDays, setExpiresInDays] = useState<
    "7" | "30" | "90" | "never"
  >("30");
  const [token, setToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Agent | null>(null);
  const [editTarget, setEditTarget] = useState<Agent | null>(null);
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);
  const [editScopes, setEditScopes] = useState<AgentScope[]>([]);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const response = await apiRequest<{ agents: Agent[] }>("/api/v1/agents");
    setAgents(response.agents);
  }, []);

  useEffect(() => {
    refresh()
      .catch(() =>
        setErrors([
          {
            field: "request",
            message:
              "We couldn't load agents. Check your connection and try again.",
          },
        ]),
      )
      .finally(() => setLoading(false));
  }, [refresh]);

  function toggle(values: string[], value: string) {
    return values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors([]);
    setSubmitting(true);
    try {
      const result = await apiRequest<{ agent: Agent; token: string }>(
        "/api/v1/agents",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            description,
            projectIds,
            scopes,
            expiresInDays:
              expiresInDays === "never" ? null : Number(expiresInDays),
          }),
        },
      );
      setToken(result.token);
      setShowForm(false);
      await refresh();
    } catch (error) {
      setErrors(messageFor(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(agent: Agent) {
    try {
      await apiRequest(`/api/v1/agents/${agent.id}/revoke`, {
        method: "POST",
        body: "{}",
      });
      setRevokeTarget(null);
      await refresh();
    } catch (error) {
      setErrors(messageFor(error));
    }
  }

  function beginEdit(agent: Agent) {
    setEditTarget(agent);
    setEditProjectIds([...agent.projectIds]);
    setEditScopes([...agent.scopes]);
    setErrors([]);
  }

  async function saveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    setErrors([]);
    setSubmitting(true);
    try {
      await apiRequest(`/api/v1/agents/${editTarget.id}/access`, {
        method: "PATCH",
        body: JSON.stringify({
          projectIds: editProjectIds,
          scopes: editScopes,
        }),
      });
      setEditTarget(null);
      await refresh();
    } catch (error) {
      setErrors(messageFor(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Skeleton label="Loading agents…" />;
  if (token) {
    return (
      <div className="reading-column">
        <PageHeading>Agent credential</PageHeading>
        <StatusBanner focus>
          Copy this token now. You won't be able to see it again.
        </StatusBanner>
        <label className="field" htmlFor="agent-token">
          <span>Personal access token</span>
          <textarea
            id="agent-token"
            className="secret-value"
            readOnly
            value={token}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <div className="page-actions">
          <Button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(token)}
          >
            Copy token
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setToken(null)}
          >
            Finish agent setup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="reading-column">
      <div className="page-header">
        <PageHeading>Agents</PageHeading>
        <Button type="button" onClick={() => setShowForm(true)}>
          Create agent
        </Button>
      </div>
      <ErrorSummary errors={errors} />
      {revokeTarget ? (
        <div
          className="confirmation-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-title"
        >
          <h2 id="revoke-title">Revoke agent access?</h2>
          <p>
            {revokeTarget.name} will lose access immediately. Existing activity
            will remain. This can't be undone.
          </p>
          <div className="page-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRevokeTarget(null)}
            >
              Keep agent access
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void revoke(revokeTarget)}
            >
              Revoke access
            </Button>
          </div>
        </div>
      ) : null}
      {showForm ? (
        <form className="form-panel form-stack" onSubmit={submit}>
          <Field label="Name" htmlFor="name" required>
            <TextInput
              id="name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </Field>
          <Field label="Description" htmlFor="description">
            <TextArea
              id="description"
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
            />
          </Field>
          <fieldset>
            <legend>Allowed projects (required)</legend>
            {projects.map((project) => (
              <label className="check-row" key={project.id}>
                <input
                  type="checkbox"
                  checked={projectIds.includes(project.id)}
                  onChange={() => setProjectIds(toggle(projectIds, project.id))}
                />{" "}
                {project.name}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Scopes (required)</legend>
            {agentScopes.map((scope) => (
              <label className="check-row" key={scope}>
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={() =>
                    setScopes(toggle(scopes, scope) as AgentScope[])
                  }
                />{" "}
                {scopeLabels[scope]}
                {scope === "issues:close" ? (
                  <span className="field-helper">
                    Allows this agent to move issues to Done. Human review
                    remains the default.
                  </span>
                ) : null}
              </label>
            ))}
          </fieldset>
          <Field label="Credential expiry" htmlFor="expires">
            <Select
              id="expires"
              value={expiresInDays}
              onChange={(event) =>
                setExpiresInDays(
                  event.currentTarget.value as typeof expiresInDays,
                )
              }
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="never">No expiry</option>
            </Select>
          </Field>
          <div className="page-actions">
            <Button
              type="submit"
              disabled={
                submitting || projectIds.length === 0 || scopes.length === 0
              }
            >
              {submitting ? "Creating…" : "Create agent"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      {agents.length === 0 && !showForm ? (
        <EmptyState
          heading="No agents yet"
          body="Create a separate identity before giving a code agent access."
        />
      ) : null}
      <div className="agent-list">
        {agents.map((agent) => (
          <article className="detail-panel" key={agent.id}>
            <div className="page-header">
              <div>
                <h2>{agent.name}</h2>
                <p>{agent.description}</p>
              </div>
              {agent.access.revokedAt ? null : (
                <div className="page-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => beginEdit(agent)}
                  >
                    Edit permissions
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setRevokeTarget(agent)}
                  >
                    Revoke access
                  </Button>
                </div>
              )}
            </div>
            {editTarget?.id === agent.id ? (
              <form className="form-panel form-stack" onSubmit={saveAccess}>
                <StatusBanner>
                  Permissions can only be reduced. Create a new grant if this
                  identity needs broader access.
                </StatusBanner>
                <fieldset>
                  <legend>Retained projects (required)</legend>
                  {agent.projects.map((project) => (
                    <label className="check-row" key={project.id}>
                      <input
                        type="checkbox"
                        checked={editProjectIds.includes(project.id)}
                        onChange={() =>
                          setEditProjectIds(toggle(editProjectIds, project.id))
                        }
                      />{" "}
                      {project.name}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Retained scopes (required)</legend>
                  {agent.scopes.map((scope) => (
                    <label className="check-row" key={scope}>
                      <input
                        type="checkbox"
                        checked={editScopes.includes(scope)}
                        onChange={() =>
                          setEditScopes(
                            toggle(editScopes, scope) as AgentScope[],
                          )
                        }
                      />{" "}
                      {scopeLabels[scope]}
                    </label>
                  ))}
                </fieldset>
                <div className="page-actions">
                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      editProjectIds.length === 0 ||
                      editScopes.length === 0
                    }
                  >
                    {submitting ? "Saving…" : "Save reduced access"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditTarget(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}
            <dl className="metadata-list">
              <div>
                <dt>Access type</dt>
                <dd>{agent.access.kind === "oauth" ? "OAuth" : "PAT"}</dd>
              </div>
              <div>
                <dt>Allowed projects</dt>
                <dd>
                  {agent.projects.map((project) => project.name).join(", ")}
                </dd>
              </div>
              <div>
                <dt>Scopes</dt>
                <dd>
                  {agent.scopes.map((scope) => scopeLabels[scope]).join(", ")}
                </dd>
              </div>
              <div>
                <dt>Credential status</dt>
                <dd>{agent.access.revokedAt ? "Revoked" : "Active"}</dd>
              </div>
              <div>
                <dt>Expiry</dt>
                <dd>
                  {agent.access.expiresAt
                    ? dateLabel(agent.access.expiresAt)
                    : agent.access.kind === "oauth"
                      ? "Managed by OAuth"
                      : "No expiry"}
                </dd>
              </div>
              <div>
                <dt>Last used</dt>
                <dd>{dateLabel(agent.access.lastUsedAt)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
