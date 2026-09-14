import { type FormEvent, useCallback, useEffect, useState } from "react";
import { MemberAccessEditor } from "../components/MemberAccessEditor.js";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  PageHeading,
  Skeleton,
  StatusBanner,
  TextInput,
} from "../components/ui.js";
import { ApiError, apiRequest } from "../lib/api.js";
import type {
  Project,
  WorkspaceInvitation,
  WorkspaceMember,
} from "../types.js";

type MembersResponse = {
  invitations: WorkspaceInvitation[];
  members: WorkspaceMember[];
};

type InvitationResponse = {
  invitation: WorkspaceInvitation;
  inviteUrl: string;
};

const invitationLabels: Record<WorkspaceInvitation["state"], string> = {
  pending: "Pending",
  claimed: "Waiting for Google verification",
  expired: "Expired",
  accepted: "Accepted",
  revoked: "Revoked",
};

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "We couldn't save this change. Check your connection and try again.";
}

export function MembersRoute({ projects }: { projects: Project[] }) {
  const [data, setData] = useState<MembersResponse | null>(null);
  const [email, setEmail] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<WorkspaceMember | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiRequest<MembersResponse>("/api/v1/members"));
      setError(null);
    } catch (caught) {
      setError(message(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleProject(projectId: string) {
    setProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setInviteUrl(null);
    if (projectIds.length === 0) {
      setError("Choose at least one project for this member.");
      return;
    }
    setBusy("create");
    try {
      const result = await apiRequest<InvitationResponse>(
        "/api/v1/invitations",
        {
          method: "POST",
          body: JSON.stringify({ email, projectIds }),
        },
      );
      setInviteUrl(result.inviteUrl);
      setEmail("");
      setProjectIds([]);
      setNotice("Invitation created. Copy and send this private link now.");
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function copyInvitation(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Invitation link copied.");
    } catch {
      setError(
        "Your browser couldn't copy the link. Select it and copy it manually.",
      );
    }
  }

  async function resend(invitationId: string) {
    setBusy(invitationId);
    setError(null);
    setNotice(null);
    setInviteUrl(null);
    try {
      const result = await apiRequest<InvitationResponse>(
        `/api/v1/invitations/${invitationId}/resend`,
        { method: "POST" },
      );
      setInviteUrl(result.inviteUrl);
      setNotice("A new link was created. The previous link no longer works.");
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function revoke(invitationId: string) {
    if (
      !window.confirm("Revoke this invitation? Its link will stop working.")
    ) {
      return;
    }
    setBusy(invitationId);
    setError(null);
    try {
      await apiRequest(`/api/v1/invitations/${invitationId}/revoke`, {
        method: "POST",
      });
      setNotice("Invitation revoked.");
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function removeMember(member: WorkspaceMember) {
    if (
      !window.confirm(
        `Remove ${member.email} from this workspace? Access and Chrome installations for this workspace will stop working. Other workspaces and web sessions are preserved.`,
      )
    ) {
      return;
    }
    setBusy(member.userId);
    setError(null);
    try {
      await apiRequest(`/api/v1/members/${member.userId}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: member.version }),
      });
      setNotice(`${member.email} no longer has workspace access.`);
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  const projectNames = new Map(
    projects.map((project) => [project.id, project.name]),
  );

  return (
    <div className="page-stack members-page">
      <div>
        <p className="eyebrow">Workspace access</p>
        <PageHeading>Members and invitations</PageHeading>
        <p>
          Invite people as Members and choose exactly which projects they can
          access. Invitation links expire after seven days.
        </p>
      </div>

      {error ? (
        <StatusBanner error focus>
          {error}
        </StatusBanner>
      ) : null}
      {notice ? <StatusBanner>{notice}</StatusBanner> : null}
      {inviteUrl ? (
        <section
          className="form-panel form-stack"
          aria-labelledby="new-invite-link"
        >
          <h2 id="new-invite-link">Private invitation link</h2>
          <p className="helper-copy">
            This link is shown only now. Send it to the invited person through a
            trusted channel.
          </p>
          <TextInput
            className="invitation-link-input"
            aria-label="Invitation link"
            readOnly
            value={inviteUrl}
          />
          <div className="button-row">
            <Button
              type="button"
              onClick={() => void copyInvitation(inviteUrl)}
            >
              Copy link
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setInviteUrl(null)}
            >
              Hide link
            </Button>
          </div>
        </section>
      ) : null}

      <form className="form-panel form-stack" onSubmit={createInvitation}>
        <h2>Invite a member</h2>
        <Field label="Google account email" htmlFor="invite-email" required>
          <TextInput
            id="invite-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
        </Field>
        <fieldset className="choice-group">
          <legend>Project access (choose at least one)</legend>
          {projects.map((project) => (
            <label className="choice-row" key={project.id}>
              <input
                type="checkbox"
                checked={projectIds.includes(project.id)}
                onChange={() => toggleProject(project.id)}
              />
              <span>
                <strong>{project.name}</strong>
                <span className="metadata">{project.key}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={busy === "create"}>
          {busy === "create" ? "Creating invitation…" : "Create invitation"}
        </Button>
      </form>

      {!data ? (
        <Skeleton label="Loading members and invitations…" />
      ) : (
        <>
          <section
            className="detail-panel"
            aria-labelledby="pending-invitations"
          >
            <div className="section-heading">
              <h2 id="pending-invitations">Invitations</h2>
              <Badge>{data.invitations.length}</Badge>
            </div>
            {data.invitations.length === 0 ? (
              <EmptyState
                heading="No invitations yet"
                body="Create the first invitation when you are ready to add a member."
              />
            ) : (
              <ul className="access-list">
                {data.invitations.map((invitation) => (
                  <li key={invitation.id} className="access-list-item">
                    <div>
                      <strong>{invitation.email}</strong>
                      <p className="metadata">
                        {invitationLabels[invitation.state]} ·{" "}
                        {invitation.projectIds
                          .map(
                            (id) =>
                              projectNames.get(id) ?? "Unavailable project",
                          )
                          .join(", ")}
                      </p>
                      <p className="metadata">
                        Expires{" "}
                        {new Date(invitation.expiresAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="access-actions">
                      {invitation.state === "pending" ||
                      invitation.state === "expired" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy === invitation.id}
                          onClick={() => void resend(invitation.id)}
                        >
                          Create new link
                        </Button>
                      ) : null}
                      {invitation.state === "pending" ||
                      invitation.state === "claimed" ||
                      invitation.state === "expired" ? (
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={busy === invitation.id}
                          onClick={() => void revoke(invitation.id)}
                        >
                          Revoke invitation
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="detail-panel form-stack"
            aria-labelledby="workspace-members"
          >
            <div className="section-heading">
              <h2 id="workspace-members">Members</h2>
              <Badge>{data.members.length}</Badge>
              <Button
                variant="secondary"
                disabled={Boolean(busy) || Boolean(editing)}
                onClick={() => void load()}
              >
                Refresh members
              </Button>
            </div>
            <Field label="Search members" htmlFor="member-search">
              <TextInput
                id="member-search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
            </Field>
            {editing ? (
              <MemberAccessEditor
                key={editing.userId}
                member={editing}
                projects={projects}
                onReloaded={(latest) =>
                  setData((previous) =>
                    previous
                      ? {
                          ...previous,
                          members: previous.members.map((entry) =>
                            entry.userId === latest.userId ? latest : entry,
                          ),
                        }
                      : previous,
                  )
                }
                onCancel={() => setEditing(null)}
                onSaved={async () => {
                  setEditing(null);
                  setNotice("Member permissions updated.");
                  await load();
                }}
              />
            ) : null}
            <ul className="access-list">
              {data.members
                .filter((member) =>
                  `${member.name} ${member.email}`
                    .toLocaleLowerCase()
                    .includes(search.trim().toLocaleLowerCase()),
                )
                .map((member) => (
                  <li key={member.userId} className="access-list-item">
                    <div>
                      <strong>{member.name}</strong>
                      <p>{member.email}</p>
                      <p className="metadata">
                        {member.role === "owner"
                          ? "Owner · all projects"
                          : `Member · ${
                              (member.projectGrants ?? [])
                                .map(
                                  ({ projectId, permission }) =>
                                    `${projectNames.get(projectId) ?? "Unavailable project"} (${permission === "read" ? "read only" : "edit"})`,
                                )
                                .join(", ") ||
                              "No projects assigned · waiting for access"
                            }`}
                      </p>
                    </div>
                    {member.role === "member" ? (
                      <div className="access-actions">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={Boolean(busy) || Boolean(editing)}
                          onClick={() => setEditing(member)}
                        >
                          Edit access for {member.name}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={Boolean(busy) || Boolean(editing)}
                          onClick={() => void removeMember(member)}
                        >
                          Remove access
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
