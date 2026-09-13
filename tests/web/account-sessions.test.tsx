// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountSessions } from "../../src/web/components/AccountSessions.js";

const current = {
  id: "current-id",
  device: "Chrome · Linux",
  current: true,
  createdAt: "2026-09-13T10:00:00Z",
  updatedAt: "2026-09-13T10:00:00Z",
  expiresAt: "2026-09-20T10:00:00Z",
};
const other = {
  ...current,
  id: "other-id",
  device: "Firefox · Windows",
  current: false,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value() {},
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value() {},
  });
  vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(
    function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  );
  vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("distinguishes current session and confirms/cancels other closures", async () => {
  let closed = false;
  const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
    if (init?.method === "POST") {
      closed = true;
      return json({ revoked: true, current: false });
    }
    return json({
      sessions: closed ? [current] : [current, other],
      hasMore: false,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<AccountSessions />);
  expect(await screen.findByText("Current session")).toBeVisible();
  expect(
    screen.getByRole("link", { name: /Manage Chrome installations/ }),
  ).toHaveAttribute("href", "/extensions");
  await user.click(
    screen.getByRole("button", { name: /Close session: Firefox/ }),
  );
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByText(/Only your Issopen web sessions/),
  ).toBeVisible();
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(closed).toBe(false);
  await user.click(
    screen.getByRole("button", { name: /Close session: Firefox/ }),
  );
  await user.click(screen.getByRole("button", { name: "Confirm closure" }));
  expect(await screen.findByText("Web session closed.")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Close other web sessions" }),
  ).toBeDisabled();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/account/sessions/other-id/revoke",
    expect.objectContaining({ method: "POST" }),
  );
  expect(
    screen.getByRole("button", { name: "Refresh sessions" }),
  ).toHaveFocus();
});

it("keeps a failed closure visible and retryable without pretending it succeeded", async () => {
  let fail = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (init?.method === "POST")
        return fail
          ? json({ error: "Unavailable" }, 503)
          : json({ revoked: true, current: false });
      return json({
        sessions: fail ? [current, other] : [current],
        hasMore: false,
      });
    }),
  );
  const user = userEvent.setup();
  render(<AccountSessions />);
  await user.click(
    await screen.findByRole("button", { name: "Close other web sessions" }),
  );
  await user.click(screen.getByRole("button", { name: "Confirm closure" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "couldn't confirm the closure",
  );
  expect(screen.getByRole("dialog")).toBeVisible();
  fail = false;
  await user.click(screen.getByRole("button", { name: "Confirm closure" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByText(/Other web sessions closed/)).toBeVisible();
});

it("offers refresh after a failed list without showing an empty success state", async () => {
  let fail = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      fail ? json({}, 503) : json({ sessions: [current], hasMore: false }),
    ),
  );
  const user = userEvent.setup();
  render(<AccountSessions />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "couldn't load your sessions",
  );
  expect(
    screen.queryByText("No active sessions found."),
  ).not.toBeInTheDocument();
  fail = false;
  await user.click(screen.getByRole("button", { name: "Refresh sessions" }));
  expect(await screen.findByText("Current session")).toBeVisible();
});
