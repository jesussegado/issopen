import { useCallback, useEffect, useState } from "react";
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

  useEffect(() => {
    fetch(`/api/public/invitations/${encodeURIComponent(token)}`, {
      cache: "no-store",
      referrerPolicy: "no-referrer",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Invitation not found");
        const body = (await response.json()) as {
          invitation: PublicInvitation;
        };
        setInvitation(body.invitation);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : "Invitation not found",
        ),
      )
      .finally(() => setLoading(false));
  }, [token]);

  async function redeem() {
    setBusy(true);
    setError(null);
    setRequiresSignIn(false);
    try {
      const response = await authPost<{ invitationId: string }>(
        "/api/auth/invitations/redeem",
        { token },
      );
      await onRedeemed(response.invitationId);
    } catch (caught) {
      const authError = caught as Error & { code?: string };
      setRequiresSignIn(authError.code === "EXISTING_ACCOUNT_REQUIRES_SIGN_IN");
      setError(authError.message);
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
            This one-time invitation is for <strong>{invitation.email}</strong>.
            You will verify the exact address with Google before gaining access.
          </p>
          <p className="metadata">
            Link expires {new Date(invitation.expiresAt).toLocaleString()}.
          </p>
          {invitation.state === "pending" ||
          (invitation.state === "claimed" && authenticated) ? (
            <Button type="button" disabled={busy} onClick={() => void redeem()}>
              {busy ? "Checking invitation…" : "Continue securely"}
            </Button>
          ) : invitation.state === "claimed" ? (
            <StatusBanner>
              This link has already been started. Sign in with the invited
              account to continue it.
            </StatusBanner>
          ) : (
            <StatusBanner error>
              This invitation is {invitation.state} and can no longer be used.
              Ask the workspace Owner for a new link.
            </StatusBanner>
          )}
          {requiresSignIn ? (
            <AppLink
              className="button button-secondary"
              href={`/sign-in?returnTo=${encodeURIComponent(`/invite/${token}`)}`}
            >
              Sign in first
            </AppLink>
          ) : null}
        </section>
      ) : null}
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
      setError(authError.message);
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
