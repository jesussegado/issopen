import { useState } from "react";
import { ApiError, apiRequest } from "../lib/api.js";
import type { Project, WorkspaceMember } from "../types.js";
import { Button, Field, Select, StatusBanner } from "./ui.js";

type Permission = "none" | "read" | "edit";
const labels = { none: "No access", read: "Read only", edit: "Edit" };

export function MemberAccessEditor({
  member,
  projects,
  onSaved,
  onCancel,
  onReloaded,
}: {
  member: WorkspaceMember;
  projects: Project[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
  onReloaded?: (member: WorkspaceMember) => void;
}) {
  const [current, setCurrent] = useState(member);
  const [grants, setGrants] = useState(
    new Map(
      member.projectGrants?.map((grant) => [
        grant.projectId,
        grant.permission as Permission,
      ]),
    ),
  );
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const before = new Map(
    current.projectGrants?.map((grant) => [grant.projectId, grant.permission]),
  );
  const changes = projects.filter(
    (project) =>
      (before.get(project.id) ?? "none") !== (grants.get(project.id) ?? "none"),
  );
  const chosen = projects.filter(
    (project) => (grants.get(project.id) ?? "none") !== "none",
  );

  async function reload() {
    setBusy(true);
    try {
      const result = await apiRequest<{ members: WorkspaceMember[] }>(
        "/api/v1/members",
      );
      const latest = result.members.find(
        (entry) => entry.userId === member.userId,
      );
      if (latest?.role !== "member") {
        setUnavailable(true);
        setError(
          "This membership is no longer editable. Close this form and refresh the list.",
        );
        return;
      }
      setCurrent(latest);
      onReloaded?.(latest);
      setConflict(false);
      setConfirming(false);
      setError(null);
      // The draft is intentionally not overwritten; the next preview compares
      // it to the newly read baseline, and still requires explicit confirmation.
    } catch {
      setError(
        "Couldn't reload permissions. Your proposed changes remain here.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (busy || conflict || unavailable || !confirming) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/members/${member.userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: current.version,
          grants: chosen.map((project) => ({
            projectId: project.id,
            permission: grants.get(project.id),
          })),
        }),
      });
      await onSaved();
    } catch (caught) {
      setConflict(caught instanceof ApiError && caught.status === 409);
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Couldn't confirm this change. Reload and compare before retrying; your draft remains here.",
      );
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="form-panel form-stack member-access-editor"
      aria-label={`Edit access for ${member.name}`}
    >
      <h3>Project access for {member.name}</h3>
      <p>
        Workspace role: Member. Only explicitly selected projects are available;
        new projects are not added automatically.
      </p>
      {error ? <StatusBanner error>{error}</StatusBanner> : null}
      {conflict ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void reload()}
        >
          Reload current permissions and keep my draft
        </Button>
      ) : null}
      <fieldset
        className="form-stack"
        disabled={busy || confirming || unavailable}
      >
        <legend>Proposed project permissions</legend>
        {projects.map((project) => (
          <Field
            key={project.id}
            htmlFor={`access-${project.id}`}
            label={project.name}
            helper={`Current: ${labels[before.get(project.id) ?? "none"]}`}
          >
            <Select
              id={`access-${project.id}`}
              value={grants.get(project.id) ?? "none"}
              onChange={(event) => {
                const permission = event.currentTarget.value as Permission;
                setGrants((previous) =>
                  new Map(previous).set(project.id, permission),
                );
              }}
            >
              <option value="none">No access</option>
              <option value="read">Read only</option>
              <option value="edit">Edit</option>
            </Select>
          </Field>
        ))}
      </fieldset>
      {chosen.length === 0 ? (
        <p role="status">
          No projects: membership stays active, but no project content is
          visible. You can assign projects later without another invitation.
        </p>
      ) : null}
      {confirming ? (
        <section className="form-stack" aria-label="Confirm member permissions">
          <h4>Review the access changes</h4>
          <ul>
            {changes.map((project) => (
              <li key={project.id}>
                {project.name}: {labels[before.get(project.id) ?? "none"]} →{" "}
                {labels[grants.get(project.id) ?? "none"]}
              </li>
            ))}
          </ul>
          <p>
            Applies to this workspace's web and Chrome access. Tickets,
            comments, attribution, other workspaces and web sessions are
            preserved.
          </p>
          <div className="button-row">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Back to editing
            </Button>
            <Button disabled={busy} onClick={() => void save()}>
              {busy ? "Saving permissions…" : "Confirm permission changes"}
            </Button>
          </div>
        </section>
      ) : (
        <Button
          disabled={busy || conflict || unavailable || changes.length === 0}
          onClick={() => setConfirming(true)}
        >
          Review changes
        </Button>
      )}
      <Button variant="ghost" disabled={busy} onClick={onCancel}>
        Cancel editing
      </Button>
    </section>
  );
}
