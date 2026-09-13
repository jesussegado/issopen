import { useEffect, useState } from "react";
import { Badge, Button, PageHeading, StatusBanner } from "../components/ui.js";
import type { Session } from "../types.js";

type LinkedAccount = {
  id: string;
  providerId: string;
};

export function AccountRoute({ session }: { session: Session }) {
  const [googleAvailable, setGoogleAvailable] = useState<boolean | null>(null);
  const [googleLinked, setGoogleLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = new URLSearchParams(window.location.search);

  useEffect(() => {
    Promise.all([
      fetch("/api/public/auth-providers", { cache: "no-store" }).then(
        async (response) =>
          response.ok
            ? ((await response.json()) as { google?: boolean }).google === true
            : false,
      ),
      fetch("/api/auth/list-accounts", {
        credentials: "same-origin",
        cache: "no-store",
      })
        .then(async (response) =>
          response.ok ? ((await response.json()) as LinkedAccount[]) : [],
        )
        .catch(() => []),
    ])
      .then(([available, accounts]) => {
        setGoogleAvailable(available);
        setGoogleLinked(
          accounts.some((account) => account.providerId === "google"),
        );
      })
      .catch(() => setGoogleAvailable(false));
  }, []);

  async function linkGoogle() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/link-social", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          callbackURL: "/account?google=linked",
          errorCallbackURL: "/account?google=error",
          loginHint: session.user.email,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        url?: string;
        message?: string;
      } | null;
      if (!response.ok || !body?.url) {
        throw new Error(body?.message ?? "Google verification could not start");
      }
      const destination = new URL(body.url);
      if (
        destination.protocol !== "https:" ||
        destination.hostname !== "accounts.google.com"
      ) {
        throw new Error("Google returned an unexpected destination");
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
    <div className="page-stack account-page">
      <div>
        <p className="eyebrow">Personal settings</p>
        <PageHeading>Your account</PageHeading>
      </div>
      {query.get("google") === "linked" ? (
        <StatusBanner>Google account verified successfully.</StatusBanner>
      ) : null}
      {query.get("google") === "error" ? (
        <StatusBanner error>
          Google did not complete verification. Try again with{" "}
          {session.user.email}.
        </StatusBanner>
      ) : null}
      {error ? <StatusBanner error>{error}</StatusBanner> : null}
      <section className="detail-panel form-stack">
        <h2>Profile</h2>
        <dl className="metadata-list">
          <div>
            <dt>Name</dt>
            <dd>{session.user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{session.user.email}</dd>
          </div>
          <div>
            <dt>Workspace role</dt>
            <dd>{session.workspace?.role === "owner" ? "Owner" : "Member"}</dd>
          </div>
        </dl>
      </section>
      <section className="detail-panel form-stack">
        <h2>Data and privacy</h2>
        <p>
          Review what Issopen stores, how long it is retained and how to revoke
          Chrome installations or request access and deletion.
        </p>
        <a href="/privacy">Open privacy and data controls</a>
      </section>
      <section className="detail-panel form-stack">
        <div className="section-heading">
          <h2>Google verification</h2>
          {googleLinked ? <Badge>Linked</Badge> : null}
        </div>
        <p>
          Link or reverify the Google account whose verified email is{" "}
          <strong>{session.user.email}</strong>. Issopen never merges accounts
          silently by email.
        </p>
        {googleAvailable === false ? (
          <StatusBanner error>
            Google sign-in is not configured on this Issopen installation yet.
          </StatusBanner>
        ) : null}
        <Button
          type="button"
          disabled={busy || googleAvailable !== true}
          onClick={() => void linkGoogle()}
        >
          {busy
            ? "Opening Google…"
            : googleLinked
              ? "Reverify with Google"
              : "Link Google account"}
        </Button>
      </section>
    </div>
  );
}
