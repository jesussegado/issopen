// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import {
  NotificationLink,
  NotificationsRoute,
} from "../../src/web/routes/NotificationsRoute.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
it("counts immediately after login while per-tab workspace storage is still settling", async () => {
  sessionStorage.clear();
  let finish: (value: Response) => void = () => {};
  const mock = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", mock);
  render(<NotificationLink workspaceId="confirmed-space" />);
  expect(mock.mock.calls).toHaveLength(1);
  await act(async () => {
    sessionStorage.setItem("issopen.workspace", "confirmed-space");
    finish(
      new Response(
        JSON.stringify({ unread: 3, notifications: [], nextCursor: null }),
      ),
    );
  });
  expect(
    await screen.findByRole("link", { name: "Notifications, 3 unread" }),
  ).toBeVisible();
});
it("renders literal content and clears private links on access/read failure", async () => {
  const mock = vi.fn(
    async (_path: unknown, init?: RequestInit) =>
      new Response(
        JSON.stringify(
          init?.method === "PUT"
            ? { error: "unavailable" }
            : {
                unread: 1,
                nextCursor: null,
                notifications: [
                  {
                    id: "n",
                    kind: "mention",
                    issueId: "i",
                    title: "<img onerror=alert(1)>",
                    number: 5,
                    actorName: "Member",
                    createdAt: new Date().toISOString(),
                    readAt: null,
                    actionable: false,
                  },
                ],
              },
        ),
        { status: init?.method === "PUT" ? 404 : 200 },
      ),
  );
  vi.stubGlobal("fetch", mock);
  render(<NotificationsRoute workspaceId="workspace" />);
  await screen.findByRole("link", { name: "5-<img onerror=alert(1)>" });
  expect(document.querySelector(".notification-item img")).toBeNull();
  expect(screen.getByText("No longer pending")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Mark read" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("link", { name: /5-/ })).not.toBeInTheDocument();
  expect(JSON.parse(String(mock.mock.calls.at(-1)?.[1]?.body))).toEqual({
    read: true,
  });
});
