// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { OwnerInvitationsRoute } from "../../src/web/routes/OwnerInvitationsRoute.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("creates an Owner workspace invitation and exposes its private link once", async () => {
  let invitations: unknown[] = [];
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const path = String(input);
    if (path !== "/api/v1/owner-invitations")
      throw new Error(`Unexpected request ${path}`);
    if (init?.method === "POST") {
      invitations = [
        {
          id: "owner-invite",
          email: "new-owner@example.test",
          workspaceName: "Independent space",
          state: "pending",
          createdWorkspaceId: null,
          expiresAt: "2026-09-24T10:00:00Z",
          claimedAt: null,
          acceptedAt: null,
          revokedAt: null,
          createdAt: "2026-09-17T10:00:00Z",
        },
      ];
      return json(
        {
          invitation: invitations[0],
          inviteUrl: "https://issopen.example.test/owner-invite/private-token",
        },
        201,
      );
    }
    return json({ invitations });
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<OwnerInvitationsRoute />);
  expect(
    await screen.findByRole("heading", { name: "Invite a new Owner" }),
  ).toBeVisible();
  await user.type(
    screen.getByRole("textbox", { name: /Google account email/ }),
    "new-owner@example.test",
  );
  await user.type(
    screen.getByRole("textbox", { name: /New workspace name/ }),
    "Independent space",
  );
  await user.click(
    screen.getByRole("button", { name: "Create Owner invitation" }),
  );
  expect(
    await screen.findByDisplayValue(
      "https://issopen.example.test/owner-invite/private-token",
    ),
  ).toBeVisible();
  expect(screen.getByText("new-owner@example.test")).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/owner-invitations",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        email: "new-owner@example.test",
        workspaceName: "Independent space",
      }),
    }),
  );
  await user.click(screen.getByRole("button", { name: "Copy link" }));
  await waitFor(() =>
    expect(screen.getByText("Owner invitation link copied.")).toBeVisible(),
  );
});
