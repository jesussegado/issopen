import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { AppLink, Badge, Button, StatusBanner } from "./ui.js";

type WebSession = {
  id: string;
  device: string;
  current: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};
type SessionList = { sessions: WebSession[]; hasMore: boolean };

function dateLabel(value: string) {
  return new Date(value).toLocaleString();
}

export function AccountSessions() {
  const [data, setData] = useState<SessionList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [target, setTarget] = useState<WebSession | "others" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (restoreFocus.current && !busy && !loading) {
      restoreFocus.current = false;
      refreshButton.current?.focus();
    }
  }, [busy, loading]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const next = await apiRequest<SessionList>("/api/v1/account/sessions", {
        cache: "no-store",
        ...(signal ? { signal } : {}),
      });
      if (signal?.aborted) return;
      setData(next);
      setError(null);
    } catch {
      if (!signal?.aborted)
        setError(
          "We couldn't load your sessions. Check your connection and try again.",
        );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function confirm(next: WebSession | "others") {
    setTarget(next);
    setError(null);
    setMessage(null);
    dialog.current?.showModal();
  }

  async function revoke() {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const path =
        target === "others"
          ? "/api/v1/account/sessions/revoke-others"
          : `/api/v1/account/sessions/${encodeURIComponent(target.id)}/revoke`;
      const result = await apiRequest<{ revoked: boolean; current: boolean }>(
        path,
        { method: "POST" },
      );
      if (result.current) {
        window.location.assign("/sign-in");
        return;
      }
      dialog.current?.close();
      setTarget(null);
      setMessage(
        target === "others"
          ? "Other web sessions closed. This session remains open."
          : "Web session closed.",
      );
      restoreFocus.current = true;
      await load();
    } catch {
      setError(
        "We couldn't confirm the closure. Refresh the list to check, or retry. Your Chrome installations are unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="detail-panel form-stack"
      aria-labelledby="web-sessions-heading"
    >
      <div className="section-heading">
        <h2 id="web-sessions-heading">Web sessions</h2>
        <Button
          ref={refreshButton}
          variant="secondary"
          disabled={loading || busy}
          onClick={() => void load()}
        >
          Refresh sessions
        </Button>
      </div>
      <p>
        These are your signed-in browsers. Closing one signs that browser out of
        Issopen across your workspaces. It does not sign you out of Google,
        disconnect Chrome installations or revoke agent credentials.
      </p>
      <AppLink href="/extensions">
        Manage Chrome installations separately
      </AppLink>
      {loading ? <p role="status">Loading sessions…</p> : null}
      {message ? <StatusBanner>{message}</StatusBanner> : null}
      {error && !target ? <StatusBanner error>{error}</StatusBanner> : null}
      <ul className="account-session-list">
        {data?.sessions.map((item) => (
          <li key={item.id} className="account-session-card">
            <div className="section-heading">
              <h3>{item.device}</h3>
              {item.current ? <Badge>Current session</Badge> : null}
            </div>
            <dl className="metadata-list">
              <div>
                <dt>Signed in</dt>
                <dd>{dateLabel(item.createdAt)}</dd>
              </div>
              <div>
                <dt>Session refreshed</dt>
                <dd>{dateLabel(item.updatedAt)}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{dateLabel(item.expiresAt)}</dd>
              </div>
            </dl>
            <Button
              variant="secondary"
              disabled={busy || loading}
              onClick={() => confirm(item)}
            >
              {item.current ? "Sign out here" : `Close session: ${item.device}`}
            </Button>
          </li>
        ))}
      </ul>
      {data?.hasMore ? (
        <p>
          Showing the current session and recent sessions (up to 100). Refresh
          after closing sessions to see more, or close all other web sessions.
        </p>
      ) : null}
      {!loading && data?.sessions.length === 0 ? (
        <p>No active sessions found. Refresh or sign in again.</p>
      ) : null}
      <p className="muted">
        Device labels are approximate. “Session refreshed” is not an exact
        last-activity time.
      </p>
      <Button
        variant="secondary"
        disabled={
          busy || loading || !data?.sessions.some((item) => !item.current)
        }
        onClick={() => confirm("others")}
      >
        Close other web sessions
      </Button>
      <dialog
        ref={dialog}
        className="delete-ticket-dialog"
        aria-labelledby="close-session-heading"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        onClose={() => {
          if (!busy) {
            setTarget(null);
            setError(null);
          }
        }}
      >
        <div className="form-stack">
          <h2 id="close-session-heading">
            {target === "others"
              ? "Close other web sessions?"
              : target?.current
                ? "Sign out of this browser?"
                : "Close this web session?"}
          </h2>
          <p>
            {target === "others"
              ? "All your other signed-in browsers will need to sign in again. This session stays open."
              : target?.current
                ? "You will return to the sign-in page. Save any work in your other Issopen tabs first."
                : `${target?.device ?? "This browser"} will need to sign in again. Unsaved work on that browser may not be saved.`}
          </p>
          <p>
            Only your Issopen web sessions are affected. Chrome installations,
            Google and agent credentials remain connected.
          </p>
          {error ? <StatusBanner error>{error}</StatusBanner> : null}
          <div className="delete-ticket-actions">
            <Button
              variant="secondary"
              autoFocus
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void revoke()}
            >
              {busy ? "Closing…" : "Confirm closure"}
            </Button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
