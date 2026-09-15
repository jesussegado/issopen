import { useCallback, useEffect, useRef, useState } from "react";
import type {
  NotificationPage,
  PersonalNotification,
} from "../../shared/notification-contract.js";
import { AppLink, Button } from "../components/ui.js";
import { apiRequest } from "../lib/api.js";
import { selectedWorkspace } from "../lib/workspace-context.js";

const labels = {
  assignment: "Assigned to you",
  question: "Question for you",
  mention: "Mentioned you",
  review: "Ready for your review",
};
export function NotificationLink({ workspaceId }: { workspaceId: string }) {
  const [unread, setUnread] = useState<number | null>(null);
  useEffect(() => {
    let active = true,
      generation = 0;
    const refresh = async () => {
      const request = ++generation;
      try {
        const result = await apiRequest<NotificationPage>(
          "/api/v1/notifications?limit=1",
          { headers: { "X-Issopen-Workspace": workspaceId } },
        );
        if (
          active &&
          generation === request &&
          (selectedWorkspace() === null || workspaceId === selectedWorkspace())
        )
          setUnread(result.unread);
      } catch {
        if (active && request === generation) setUnread(null);
      }
    };
    const refreshEvent = () => {
      void refresh();
    };
    void refresh();
    const interval = window.setInterval(refreshEvent, 30000);
    for (const event of ["focus", "online", "issopen:notifications-changed"])
      window.addEventListener(event, refreshEvent);
    return () => {
      active = false;
      window.clearInterval(interval);
      for (const event of ["focus", "online", "issopen:notifications-changed"])
        window.removeEventListener(event, refreshEvent);
    };
  }, [workspaceId]);
  return (
    <AppLink
      className="button button-secondary notification-link"
      href="/notifications"
      aria-label={`Notifications${unread === null ? ", count unavailable" : `, ${unread} unread`}`}
    >
      <span aria-hidden="true">🔔</span> Notifications{" "}
      {unread !== null ? <span className="badge">{unread}</span> : null}
    </AppLink>
  );
}

export function NotificationsRoute({ workspaceId }: { workspaceId: string }) {
  const [status, setStatus] = useState<"all" | "unread">("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [page, setPage] = useState<NotificationPage | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ status, limit: "20" });
      if (cursor) params.set("cursor", cursor);
      const next = await apiRequest<NotificationPage>(
        `/api/v1/notifications?${params}`,
        { headers: { "X-Issopen-Workspace": workspaceId } },
      );
      if (
        request === generation.current &&
        (selectedWorkspace() === null || workspaceId === selectedWorkspace())
      ) {
        setPage(next);
        window.dispatchEvent(new Event("issopen:notifications-changed"));
      }
    } catch {
      if (request === generation.current) {
        setPage(null);
        setError(
          "Could not refresh your notifications. Check your connection and workspace access, then retry.",
        );
      }
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }, [status, cursor, workspaceId]);
  useEffect(() => {
    void refresh();
    const update = () => {
      void refresh();
    };
    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    return () => {
      generation.current += 1;
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
    };
  }, [refresh]);
  async function mark(item: PersonalNotification) {
    setBusy(true);
    setError("");
    const request = ++generation.current;
    try {
      await apiRequest(`/api/v1/notifications/${item.id}/read`, {
        method: "PUT",
        headers: { "X-Issopen-Workspace": workspaceId },
        body: JSON.stringify({ read: item.readAt === null }),
      });
      if (
        (selectedWorkspace() !== null && workspaceId !== selectedWorkspace()) ||
        request !== generation.current
      )
        return;
      window.dispatchEvent(new Event("issopen:notifications-changed"));
      await refresh();
    } catch {
      if (request === generation.current) {
        setPage(null);
        setError(
          "Could not update this notification. Refresh to check its current state and access.",
        );
        setBusy(false);
      }
    }
  }
  return (
    <section
      className="page-panel form-stack"
      aria-labelledby="notifications-heading"
    >
      <h1 id="notifications-heading">Notifications</h1>
      <p>
        Only assignments, mentions, directed questions and reviews in this
        workspace. No activity emails.
      </p>
      <p role="status">
        {page ? `${page.unread} unread` : "Checking your inbox…"}
      </p>
      <div className="inline-actions">
        <label className="field">
          Show notifications
          <select
            value={status}
            disabled={busy}
            onChange={(e) => {
              setStatus(e.target.value as "all" | "unread");
              setCursor(null);
              setPage(null);
            }}
          >
            <option value="all">All notifications</option>
            <option value="unread">Unread only</option>
          </select>
        </label>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Refresh notifications
        </Button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {page?.notifications.length === 0 ? (
        <p>No notifications to show.</p>
      ) : null}
      <ol className="notification-list">
        {page?.notifications.map((item) => (
          <li
            key={item.id}
            className={`notification-item${item.readAt ? " read" : ""}`}
          >
            <div className="inline-actions">
              <strong>{labels[item.kind]}</strong>
              <span className="badge">{item.readAt ? "Read" : "Unread"}</span>
              {!item.actionable ? (
                <span className="badge">No longer pending</span>
              ) : null}
            </div>
            <AppLink
              href={`/issues/${item.issueId}${item.questionId ? `?question=${encodeURIComponent(item.questionId)}` : ""}`}
            >
              {item.number}-{item.title}
            </AppLink>
            <p className="metadata">
              {item.actorName} ·{" "}
              <time dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString()}
              </time>
            </p>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void mark(item)}
            >
              {item.readAt ? "Mark unread" : "Mark read"}
            </Button>
          </li>
        ))}
      </ol>
      <div className="inline-actions">
        {cursor ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setCursor(null);
              setPage(null);
            }}
          >
            Back to latest
          </Button>
        ) : null}
        {page?.nextCursor ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setCursor(page.nextCursor);
              setPage(null);
            }}
          >
            Older notifications
          </Button>
        ) : null}
      </div>
    </section>
  );
}
