import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Field,
  PageHeading,
  Skeleton,
  StatusBanner,
  TextInput,
} from "../components/ui.js";
import { ApiError, apiRequest } from "../lib/api.js";
import type { OwnerWorkspaceInvitation } from "../types.js";

type ListResponse = { invitations: OwnerWorkspaceInvitation[] };
type InvitationResponse = {
  invitation: OwnerWorkspaceInvitation;
  inviteUrl: string;
};

const labels: Record<OwnerWorkspaceInvitation["state"], string> = {
  pending: "Pending",
  claimed: "Waiting for Google verification",
  expired: "Expired",
  accepted: "Workspace created",
  revoked: "Revoked",
};

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "We couldn't save this change. Check your connection and try again.";
}

export function OwnerInvitationsRoute() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [email, setEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiRequest<ListResponse>("/api/v1/owner-invitations"));
      setError(null);
    } catch (caught) {
      setData(null);
      setError(message(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    setNotice(null);
    setInviteUrl(null);
    try {
      const result = await apiRequest<InvitationResponse>(
        "/api/v1/owner-invitations",
        {
          method: "POST",
          body: JSON.stringify({ email, workspaceName }),
        },
      );
      setInviteUrl(result.inviteUrl);
      setEmail("");
      setWorkspaceName("");
      setNotice(
        "Owner invitation created. Copy its private link now; it is not sent automatically.",
      );
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
      setNotice("Owner invitation link copied.");
    } catch {
      setError("Your browser couldn't copy the link. Copy it manually.");
    }
  }

  async function resend(invitationId: string) {
    if (
      !window.confirm(
        "Create a new private link? The previous Owner invitation link will stop working.",
      )
    )
      return;
    setBusy(invitationId);
    setError(null);
    setNotice(null);
    setInviteUrl(null);
    try {
      const result = await apiRequest<InvitationResponse>(
        `/api/v1/owner-invitations/${invitationId}/resend`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setInviteUrl(result.inviteUrl);
      setNotice("A new Owner invitation link was created.");
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function revoke(invitationId: string) {
    if (
      !window.confirm(
        "Revoke this Owner invitation? It will no longer be able to create a workspace.",
      )
    )
      return;
    setBusy(invitationId);
    setError(null);
    setNotice(null);
    setInviteUrl(null);
    try {
      await apiRequest(`/api/v1/owner-invitations/${invitationId}/revoke`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNotice("Owner invitation revoked.");
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page-stack members-page">
      <div>
        <p className="eyebrow">Instance administration</p>
        <PageHeading>Owner workspaces</PageHeading>
        <p>
          Invite a person to own a new, isolated workspace. They can create
          their own projects and invite Members, while you do not gain access to
          their workspace data.
        </p>
      </div>

      {error ? (
        <StatusBanner error focus>
          {error}
        </StatusBanner>
      ) : null}
      {notice ? <StatusBanner>{notice}</StatusBanner> : null}
      {inviteUrl ? (
        <section className="form-panel form-stack" aria-labelledby="owner-link">
          <h2 id="owner-link">Private Owner invitation link</h2>
          <p className="helper-copy">
            This link is shown only now. Send it to the exact Google account
            entered below through a trusted channel.
          </p>
          <TextInput
            className="invitation-link-input"
            aria-label="Owner invitation link"
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
        <h2>Invite a new Owner</h2>
        <Field label="Google account email" htmlFor="owner-email" required>
          <TextInput
            id="owner-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
        </Field>
        <Field label="New workspace name" htmlFor="owner-workspace" required>
          <TextInput
            id="owner-workspace"
            required
            maxLength={120}
            value={workspaceName}
            onChange={(event) => setWorkspaceName(event.currentTarget.value)}
          />
        </Field>
        <p className="helper-copy">
          The link expires after seven days. Google must verify the exact email.
          Each identity can own only one workspace.
        </p>
        <Button type="submit" disabled={busy === "create"}>
          {busy === "create"
            ? "Creating invitation…"
            : "Create Owner invitation"}
        </Button>
      </form>

      {!data ? (
        <Skeleton label="Loading Owner invitations…" />
      ) : (
        <section
          className="detail-panel form-stack"
          aria-labelledby="owner-invitations"
        >
          <div className="section-heading">
            <h2 id="owner-invitations">Owner invitations</h2>
            <Badge>{data.invitations.length}</Badge>
          </div>
          {data.invitations.length === 0 ? (
            <p className="metadata">No Owner invitations yet.</p>
          ) : (
            <ul className="stack-list">
              {data.invitations.map((invitation) => (
                <li className="list-card form-stack" key={invitation.id}>
                  <div className="section-heading">
                    <div>
                      <strong>{invitation.workspaceName}</strong>
                      <p className="metadata">{invitation.email}</p>
                    </div>
                    <Badge>{labels[invitation.state]}</Badge>
                  </div>
                  <p className="metadata">
                    {invitation.acceptedAt
                      ? `Workspace created ${new Date(invitation.acceptedAt).toLocaleString()}`
                      : `Link expires ${new Date(invitation.expiresAt).toLocaleString()}`}
                  </p>
                  {["pending", "expired"].includes(invitation.state) ? (
                    <div className="button-row">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy === invitation.id}
                        onClick={() => void resend(invitation.id)}
                      >
                        Create new link
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={busy === invitation.id}
                        onClick={() => void revoke(invitation.id)}
                      >
                        Revoke
                      </Button>
                    </div>
                  ) : invitation.state === "claimed" ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy === invitation.id}
                      onClick={() => void revoke(invitation.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
