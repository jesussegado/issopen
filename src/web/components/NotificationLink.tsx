import { useEffect, useState } from "react";
import type { NotificationPage } from "../../shared/notification-contract.js";
import { apiRequest } from "../lib/api.js";
import { selectedWorkspace } from "../lib/workspace-context.js";
import { AppLink } from "./ui.js";

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
        ) {
          setUnread(result.unread);
        }
      } catch {
        if (active && request === generation) setUnread(null);
      }
    };
    const refreshEvent = () => {
      void refresh();
    };
    void refresh();
    const interval = window.setInterval(refreshEvent, 30000);
    for (const event of ["focus", "online", "issopen:notifications-changed"]) {
      window.addEventListener(event, refreshEvent);
    }
    return () => {
      active = false;
      window.clearInterval(interval);
      for (const event of [
        "focus",
        "online",
        "issopen:notifications-changed",
      ]) {
        window.removeEventListener(event, refreshEvent);
      }
    };
  }, [workspaceId]);
  return (
    <AppLink
      className="button button-secondary notification-link"
      href="/notifications"
      aria-label={`Notifications${unread === null ? ", count unavailable" : `, ${unread} unread`}`}
    >
      <span aria-hidden="true">🔔</span>{" "}
      <span className="notification-label">Notifications</span>{" "}
      {unread !== null ? <span className="badge">{unread}</span> : null}
    </AppLink>
  );
}
