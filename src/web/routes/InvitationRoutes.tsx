import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppLink,
  Button,
  PageHeading,
  Skeleton,
  StatusBanner,
} from "../components/ui.js";

type PublicInvitation = {
  id: string;
  workspaceName: string;
  email: string;
  state: "pending" | "claimed" | "expired" | "accepted" | "revoked";
  expiresAt: string;
};

type AuthErrorBody = {
  code?: string;
  message?: string;
  error?: string;
};

async function authPost<T>(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as T & AuthErrorBody;
  if (!response.ok) {
    const error = new Error(
      result.message ??
        result.error ??
        "The invitation could not be completed.",
    ) as Error & { code: string | undefined };
    error.code = result.code;
    throw error;
  }
  return result;
}

function invitationError(code: string | undefined, fallback: string) {
  switch (code) {
    case "INVITATION_EMAIL_MISMATCH":
      return "This Issopen account does not match the invitation. Switch to the invited account; no project access has been granted.";
    case "EXISTING_ACCOUNT_REQUIRES_SIGN_IN":
      return "This email already has an Issopen account. Sign in with that account first, then return here to accept the invitation.";
    case "INVITATION_EXPIRED":
    case "INVITATION_REVOKED":
    case "INVITATION_UNAVAILABLE":
      return "This invitation has expired or was revoked. Ask the workspace Owner for a new private link; retrying this one will not grant access.";
    case "INVITATION_NOT_FOUND":
      return "This invitation is unavailable for this account. Use the account it was sent to, or ask the workspace Owner for a new private link.";
    case "INVITATION_USED":
      return "This invitation cannot be resumed in this browser. Reopen its latest private link, or ask the Owner to revoke it and send a new one.";
    case "GOOGLE_REAUTH_REQUIRED":
      return "Verify this invitation with the matching Google account before continuing. Your workspace access is not active yet.";
    default:
      return (
        fallback ||
        "Couldn't complete the invitation. Check your connection and try again."
      );
  }
}

function SwitchInvitationAccount({ returnTo }: { returnTo: string }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  return (
    <div className="form-stack">
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          if (
            !window.confirm(
              "Sign out of this Issopen browser session to use the invited account? Other sessions and Google sign-in are unchanged.",
            )
          )
            return;
          setBusy(true);
          setError(false);
          try {
            await authPost("/api/auth/sign-out", {});
            window.location.assign(
              `/sign-in?returnTo=${encodeURIComponent(returnTo)}`,
            );
          } catch {
            setBusy(false);
            setError(true);
          }
        }}
      >
        {busy ? "Signing out…" : "Switch Issopen account"}
      </Button>
      {error ? (
        <StatusBanner error>
          Couldn't sign out. Your invitation has not been changed. Try again.
        </StatusBanner>
      ) : null}
    </div>
  );
}

export function InvitationRedeemRoute({
  token,
  authenticated,
  onRedeemed,
}: {
  token: string;
  authenticated: boolean;
  onRedeemed: (invitationId: string) => Promise<void>;
}) {
  const [invitation, setInvitation] = useState<PublicInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresSignIn, setRequiresSignIn] = useState(false);
  const [wrongAccount, setWrongAccount] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    setLoading(true);
    setInvitation(null);
    setError(null);
    setRequiresSignIn(false);
    setWrongAccount(false);
    setBusy(false);
    fetch(`/api/public/invitations/${encodeURIComponent(token)}`, {
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Invitation not found");
        const body = (await response.json()) as {
          invitation: PublicInvitation;
        };
        if (!controller.signal.aborted) setInvitation(body.invitation);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Couldn't load this invitation. Check the full private link or ask the workspace Owner for a new one.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      generation.current++;
      controller.abort();
    };
  }, [token]);

  async function redeem() {
    const requestGeneration = generation.current;
    setBusy(true);
    setError(null);
    setRequiresSignIn(false);
    try {
      const response = await authPost<{ invitationId: string }>(
        "/api/auth/invitations/redeem",
        { token },
      );
      if (requestGeneration === generation.current)
        await onRedeemed(response.invitationId);
    } catch (caught) {
      if (requestGeneration !== generation.current) return;
      const authError = caught as Error & { code?: string };
      setRequiresSignIn(authError.code === "EXISTING_ACCOUNT_REQUIRES_SIGN_IN");
      setWrongAccount(authError.code === "INVITATION_EMAIL_MISMATCH");
      setError(invitationError(authError.code, authError.message));
      setBusy(false);
    }
  }

  if (loading) return <Skeleton label="Checking invitation…" />;

  return (
    <div className="form-stack invitation-page">
      <p className="eyebrow">Private workspace invitation</p>
      <PageHeading>Join {invitation?.workspaceName ?? "Issopen"}</PageHeading>
      {error ? (
        <StatusBanner error focus>
          {error}
        </StatusBanner>
      ) : null}
      {invitation ? (
        <section className="detail-panel form-stack">
          <h2>Confirm this invitation</h2>
          <p>
            This private invitation is for <strong>{invitation.email}</strong>.
            You can resume verification from this link until it expires, is
            revoked or is accepted. Google must verify the exact address before
            access is granted.
          </p>
          <p className="metadata">
            Link expires {new Date(invitation.expiresAt).toLocaleString()}.
          </p>
          {invitation.state === "pending" || invitation.state === "claimed" ? (
            <Button type="button" disabled={busy} onClick={() => void redeem()}>
              {busy
                ? "Checking invitation…"
                : invitation.state === "claimed" && !authenticated
                  ? "Resume verification"
                  : "Continue securely"}
            </Button>
          ) : invitation.state === "accepted" ? (
            <StatusBanner>
              This invitation was already accepted. Sign in to the invited
              account to open your projects; the link cannot be used for another
              person.
            </StatusBanner>
          ) : (
            <StatusBanner error>
              This invitation is {invitation.state} and can no longer be used.
              Ask the workspace Owner for a new link.
            </StatusBanner>
          )}
          {requiresSignIn ||
          (!authenticated && invitation.state === "accepted") ? (
            <AppLink
              className="button button-secondary"
              href={`/sign-in?returnTo=${encodeURIComponent(`/invite/${token}`)}`}
            >
              Sign in first
            </AppLink>
          ) : null}
          {wrongAccount && authenticated ? (
            <SwitchInvitationAccount returnTo={`/invite/${token}`} />
          ) : null}
          {invitation.state === "claimed" ? (
            <p className="helper-copy">
              Resuming replaces the previous temporary verification session. It
              does not grant project access: Google must still confirm the exact
              invited address before this invitation expires.
            </p>
          ) : null}
        </section>
      ) : null}
      <AppLink href="/support">Invitation help</AppLink>
    </div>
  );
}

function useGoogleAvailability() {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/public/auth-providers", { cache: "no-store" })
      .then(async (response) =>
        response.ok
          ? ((await response.json()) as { google?: boolean }).google === true
          : false,
      )
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);
  return available;
}

export function InvitationLinkRoute({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const googleAvailable = useGoogleAvailability();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function linkGoogle() {
    setBusy(true);
    setError(null);
    try {
      const result = await authPost<{ url: string }>("/api/auth/link-social", {
        provider: "google",
        callbackURL: `/invitations/${invitationId}/complete`,
        errorCallbackURL: `/invitations/${invitationId}/link?google=error`,
        loginHint: email,
      });
      const destination = new URL(result.url);
      if (
        destination.protocol !== "https:" ||
        destination.hostname !== "accounts.google.com"
      ) {
        throw new Error("Google returned an unexpected destination.");
      }
      window.location.assign(destination.href);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Google verification could not start.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="form-stack invitation-page">
      <p className="eyebrow">Invitation verification</p>
      <PageHeading>Verify your Google account</PageHeading>
      {new URLSearchParams(window.location.search).get("google") === "error" ? (
        <StatusBanner error>
          Google did not complete verification. No workspace access was granted.
          Your invitation is still available until it expires or the Owner
          revokes it. Retry below with the invited account.
        </StatusBanner>
      ) : null}
      {error ? (
        <StatusBanner error focus>
          {error}
        </StatusBanner>
      ) : null}
      <section className="detail-panel form-stack">
        <p>
          Continue with <strong>{email}</strong>. Issopen will only activate
          this membership after Google confirms that exact verified address.
        </p>
        {googleAvailable === false ? (
          <StatusBanner error>
            Google verification is not configured yet. Ask the workspace Owner
            to finish Google OAuth before continuing.
          </StatusBanner>
        ) : null}
        <Button
          type="button"
          disabled={busy || googleAvailable !== true}
          onClick={() => void linkGoogle()}
        >
          {busy ? "Opening Google…" : "Verify with Google"}
        </Button>
        <p className="helper-copy">
          Use the Google account shown above. Cancelling Google does not
          activate or delete the invitation. If this temporary session expires,
          ask the Owner for a new invitation rather than creating another
          account.
        </p>
        <AppLink href="/support">Invitation help</AppLink>
      </section>
    </div>
  );
}

export function InvitationCompleteRoute({
  invitationId,
  onAccepted,
}: {
  invitationId: string;
  onAccepted: (workspaceId: string) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [needsGoogle, setNeedsGoogle] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(true);

  const accept = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNeedsGoogle(false);
    try {
      const result = await authPost<{ membership: { workspaceId: string } }>(
        "/api/auth/invitations/accept",
        { invitationId },
      );
      await onAccepted(result.membership.workspaceId);
    } catch (caught) {
      const authError = caught as Error & { code?: string };
      setNeedsGoogle(authError.code === "GOOGLE_REAUTH_REQUIRED");
      setUnavailable(
        [
          "INVITATION_NOT_FOUND",
          "INVITATION_UNAVAILABLE",
          "INVITATION_EXPIRED",
          "INVITATION_REVOKED",
        ].includes(authError.code ?? ""),
      );
      setError(invitationError(authError.code, authError.message));
      setBusy(false);
    }
  }, [invitationId, onAccepted]);

  useEffect(() => {
    void accept();
  }, [accept]);

  return (
    <div className="form-stack invitation-page">
      <p className="eyebrow">Invitation verification</p>
      <PageHeading>
        {busy ? "Activating membership…" : "Invitation needs attention"}
      </PageHeading>
      {busy ? <Skeleton label="Activating your project access…" /> : null}
      {error ? (
        <StatusBanner error focus>
          {error}
        </StatusBanner>
      ) : null}
      {!busy ? (
        <div className="button-row">
          {needsGoogle ? (
            <AppLink
              className="button button-primary"
              href={`/invitations/${invitationId}/link`}
            >
              Verify with Google again
            </AppLink>
          ) : unavailable ? (
            <AppLink className="button button-secondary" href="/support">
              Invitation help
            </AppLink>
          ) : (
            <Button type="button" onClick={() => void accept()}>
              Try again
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
