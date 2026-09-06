import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { PublicShell } from "../components/Shell.js";
import {
  Button,
  Field,
  OfflineBanner,
  PageHeading,
  StatusBanner,
  TextInput,
} from "../components/ui.js";
import { ApiError, apiRequest } from "../lib/api.js";
import { navigate, returnPath } from "../lib/navigation.js";
import { useOnlineStatus } from "../lib/online.js";
import type { Session } from "../types.js";

export function StatusRoute() {
  const [ready, setReady] = useState<boolean | null>(null);
  const check = useCallback(async () => {
    setReady(null);
    const response = await fetch("/health/ready").catch(() => null);
    setReady(Boolean(response?.ok));
  }, []);
  useEffect(() => {
    void check();
  }, [check]);
  return (
    <PublicShell>
      <p className="eyebrow">Private issue tracker</p>
      <PageHeading>
        {ready === false ? "Issopen is starting" : "Issopen is ready"}
      </PageHeading>
      {ready === null ? (
        <p role="status">Checking readiness…</p>
      ) : ready ? (
        <a className="button button-primary" href="/sign-in">
          Sign in
        </a>
      ) : (
        <Button type="button" onClick={() => void check()}>
          Try again
        </Button>
      )}
    </PublicShell>
  );
}

export function SignInRoute({
  onSignedIn,
}: {
  onSignedIn: (session: Session) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const online = useOnlineStatus();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setPassword("");
        setError(
          "We couldn't sign you in. Check your email and password, then try again.",
        );
        requestAnimationFrame(() => passwordRef.current?.focus());
        return;
      }
      const session = await apiRequest<Session>("/api/v1/session");
      onSignedIn(session);
      navigate(session.workspace ? returnPath() : "/workspace/new", true);
    } catch {
      setError("We couldn't sign you in. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicShell>
      <PageHeading>Sign in to Issopen</PageHeading>
      <p>This is a private Issopen instance.</p>
      {!online ? <OfflineBanner /> : null}
      {error ? (
        <StatusBanner error focus>
          {error}
        </StatusBanner>
      ) : null}
      <form className="form-stack" onSubmit={submit}>
        <Field label="Email" htmlFor="email" required>
          <TextInput
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password" required>
          <TextInput
            ref={passwordRef}
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
        </Field>
        <Button type="submit" disabled={submitting || !online}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      {error ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => passwordRef.current?.focus()}
        >
          Try signing in again
        </Button>
      ) : null}
      <p className="helper-copy">
        Lost access? Use the documented owner recovery procedure.
      </p>
    </PublicShell>
  );
}

export function WorkspaceCreateRoute({
  onCreated,
}: {
  onCreated: (session: Session) => void;
}) {
  const [name, setName] = useState("My workspace");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const online = useOnlineStatus();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest("/api/v1/workspace", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const session = await apiRequest<Session>("/api/v1/session");
      onCreated(session);
      navigate("/", true);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.fields[0]?.message
          ? caught.fields[0].message
          : "We couldn't save your changes. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <PublicShell>
      <PageHeading>Name your workspace</PageHeading>
      {!online ? <OfflineBanner /> : null}
      {error ? (
        <StatusBanner error focus>
          {error}
        </StatusBanner>
      ) : null}
      <form className="form-stack" onSubmit={submit}>
        <Field label="Workspace name" htmlFor="name" required>
          <TextInput
            id="name"
            required
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </Field>
        <Button type="submit" disabled={submitting || !online}>
          {submitting ? "Creating…" : "Create workspace"}
        </Button>
      </form>
    </PublicShell>
  );
}
