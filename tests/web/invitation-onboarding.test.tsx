// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { returnPath, safeInternalPath } from "../../src/web/lib/navigation.js";
import {
  InvitationCompleteRoute,
  InvitationLinkRoute,
  InvitationRedeemRoute,
} from "../../src/web/routes/InvitationRoutes.js";
import { HomeRoute } from "../../src/web/routes/TrackerForms.js";
import type { Project } from "../../src/web/types.js";

const projects = [
  { id: "a", name: "Alpha", canEdit: false },
  { id: "b", name: "Beta", canEdit: true },
] as Project[];
const invitation = {
  id: "invite-id",
  workspaceName: "Invited space",
  email: "in****@example.test",
  state: "pending",
  expiresAt: "2026-10-01T00:00:00Z",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  window.history.replaceState({}, "", "/");
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  "https://evil.example/",
  "//evil.example/",
  "/\\evil.example/",
  "/\nevil.example/",
  " /projects/a",
  "/%2f%2fevil.example/",
  "/%5cevil.example/",
  "/%0d%0aevil",
  "javascript:alert(1)",
  "/".repeat(8193),
])("rejects unsafe return destination %s", (path) => {
  expect(safeInternalPath(path)).toBe("/");
  window.history.replaceState(
    {},
    "",
    `/sign-in?returnTo=${encodeURIComponent(path)}`,
  );
  expect(returnPath()).toBe("/");
});
it.each([
  "/projects/a?workspace=space",
  "/invite/private-token",
  "/invitations/id/link",
  "/api/auth/oauth2/authorize?client_id=foo&redirect_uri=https%3A%2F%2Fexample.test%2Fcallback",
])("preserves internal authorized-flow destination %s", (path) =>
  expect(safeInternalPath(path)).toBe(path),
);
it("offers an explicit project chooser without opening the first project", () => {
  render(<HomeRoute projects={projects} canCreateProject={false} />);
  expect(
    screen.getByRole("heading", { name: "Choose a project" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute(
    "href",
    "/projects/a",
  );
  expect(screen.getByText("Member · read only")).toBeVisible();
  expect(screen.getByText("Member · edit")).toBeVisible();
  expect(window.location.pathname).toBe("/");
});
it("opens the only project and keeps zero-project membership in a waiting state", () => {
  const view = render(
    <HomeRoute projects={projects.slice(0, 1)} canCreateProject={false} />,
  );
  expect(window.location.pathname).toBe("/projects/a");
  view.rerender(<HomeRoute projects={[]} canCreateProject={false} />);
  expect(
    screen.getByRole("heading", { name: "No projects assigned" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "Create project" }),
  ).not.toBeInTheDocument();
});
it.each(["expired", "revoked"])(
  "does not offer retry for %s invitations",
  async (state) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ invitation: { ...invitation, state } })),
    );
    render(
      <InvitationRedeemRoute
        token="synthetic-token"
        authenticated={false}
        onRedeemed={async () => {}}
      />,
    );
    expect(
      await screen.findByText(new RegExp(`This invitation is ${state}`)),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Continue securely" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Invitation help" }),
    ).toHaveAttribute("href", "/support");
  },
);
it("offers a bounded resume action for an interrupted claimed invitation", async () => {
  const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) =>
    init?.method === "POST"
      ? json({
          invitationId: "invite-id",
          requiresGoogleVerification: true,
          resumed: true,
        })
      : json({ invitation: { ...invitation, state: "claimed" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const redeemed = vi.fn();
  render(
    <InvitationRedeemRoute
      token="synthetic-token"
      authenticated={false}
      onRedeemed={redeemed}
    />,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Resume verification" }),
  );
  expect(redeemed).toHaveBeenCalledWith("invite-id");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("offers sign-in preserving an accepted invitation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      json({ invitation: { ...invitation, state: "accepted" } }),
    ),
  );
  render(
    <InvitationRedeemRoute
      token="synthetic-token"
      authenticated={false}
      onRedeemed={async () => {}}
    />,
  );
  expect(
    await screen.findByRole("link", { name: "Sign in first" }),
  ).toHaveAttribute("href", "/sign-in?returnTo=%2Finvite%2Fsynthetic-token");
});
it("explains wrong-account recovery without signing out or mutating the invitation automatically", async () => {
  const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) =>
    init?.method === "POST"
      ? json({ code: "INVITATION_EMAIL_MISMATCH", message: "Wrong email" }, 403)
      : json({ invitation }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const redeemed = vi.fn(),
    user = userEvent.setup();
  render(
    <InvitationRedeemRoute
      token="synthetic-token"
      authenticated
      onRedeemed={redeemed}
    />,
  );
  await user.click(
    await screen.findByRole("button", { name: "Continue securely" }),
  );
  expect(
    await screen.findByText(/This Issopen account does not match/),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Switch Issopen account" }),
  ).toBeEnabled();
  expect(redeemed).not.toHaveBeenCalled();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  vi.spyOn(window, "confirm").mockReturnValue(false);
  await user.click(
    screen.getByRole("button", { name: "Switch Issopen account" }),
  );
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("keeps a cancelled Google verification retryable without activating access", async () => {
  window.history.replaceState({}, "", "/invitations/id/link?google=error");
  const fetchMock = vi.fn(async () => json({ google: true }));
  vi.stubGlobal("fetch", fetchMock);
  render(
    <InvitationLinkRoute invitationId="id" email="invited@example.test" />,
  );
  expect(screen.getByText(/Your invitation is still available/)).toBeVisible();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Verify with Google" }),
    ).toBeEnabled(),
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("an unavailable acceptance directs to recovery instead of an endless retry", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      json({ code: "INVITATION_UNAVAILABLE", message: "Unavailable" }, 403),
    ),
  );
  render(
    <InvitationCompleteRoute invitationId="id" onAccepted={async () => {}} />,
  );
  expect(
    await screen.findByRole("link", { name: "Invitation help" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Try again" }),
  ).not.toBeInTheDocument();
});

it("ignores a late redemption after switching to a different invitation", async () => {
  let finish: (value: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: unknown, init?: RequestInit) =>
      init?.method === "POST"
        ? new Promise<Response>((resolve) => {
            finish = resolve;
          })
        : json({ invitation }),
    ),
  );
  const redeemed = vi.fn();
  const view = render(
    <InvitationRedeemRoute token="first" authenticated onRedeemed={redeemed} />,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Continue securely" }),
  );
  view.rerender(
    <InvitationRedeemRoute
      token="second"
      authenticated
      onRedeemed={redeemed}
    />,
  );
  finish(json({ invitationId: "old-invitation" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Continue securely" }),
    ).toBeEnabled(),
  );
  expect(redeemed).not.toHaveBeenCalled();
});
