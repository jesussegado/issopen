// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MembersRoute } from "../../src/web/routes/MembersRoute.js";
import type { Project } from "../../src/web/types.js";

const projects = [
  { id: "a", name: "Private project", key: "PRIVATE" },
] as Project[];
const invite = {
  id: "invitation",
  email: "pilot@example.test",
  role: "member",
  state: "pending",
  projectIds: ["a"],
  expiresAt: "2026-09-22T00:00:00Z",
  createdAt: "2026-09-15T00:00:00Z",
  acceptedAt: null,
  revokedAt: null,
  claimedAt: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
it("separates invitation and email status, filters deliveries and confirms renewal without claiming delivery", async () => {
  const u = userEvent.setup();
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) =>
    init?.method === "POST"
      ? json({
          inviteUrl: "https://issopen.example.test/invite/synthetic",
          invitation: invite,
        })
      : json({
          emailEnabled: true,
          members: [],
          invitations: [
            {
              ...invite,
              delivery: {
                status: "queued",
                attempts: 1,
                nextAttemptAt: "2026-09-15T10:00:00Z",
                sentAt: null,
                lastErrorCode: "smtp_unavailable",
              },
            },
          ],
        }),
  );
  vi.stubGlobal("fetch", fetch);
  render(<MembersRoute projects={projects} />);
  expect(
    await screen.findByText("Email queued; not sent yet · 1/3 attempts"),
  ).toBeVisible();
  expect(screen.getByText(/Temporary mail-server failure/)).toBeVisible();
  await u.selectOptions(
    screen.getByRole("combobox", { name: "Invitation status" }),
    "accepted",
  );
  expect(screen.getByText("No matching invitations")).toBeVisible();
  await u.selectOptions(
    screen.getByRole("combobox", { name: "Invitation status" }),
    "",
  );
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  await u.click(screen.getByRole("button", { name: "Email a new link" }));
  expect(fetch.mock.calls.filter((c) => c[1]?.method === "POST")).toHaveLength(
    0,
  );
  confirm.mockReturnValue(true);
  await u.click(screen.getByRole("button", { name: "Email a new link" }));
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/invitations/invitation/resend",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ delivery: "email" }),
      }),
    ),
  );
  expect(
    await screen.findByText(
      "New link created and email queued. The previous link no longer works.",
    ),
  ).toBeVisible();
  await u.selectOptions(
    screen.getByRole("combobox", { name: "Email status" }),
    "sent",
  );
  expect(screen.getByText("No matching invitations")).toBeVisible();
});
it("email-disabled environments keep copy-link available and clear private lists on failed refresh", async () => {
  const u = userEvent.setup();
  let failed = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      failed
        ? json({ error: "Owner access changed" }, 403)
        : json({ emailEnabled: false, members: [], invitations: [invite] }),
    ),
  );
  render(<MembersRoute projects={projects} />);
  expect(await screen.findByText("pilot@example.test")).toBeVisible();
  expect(
    screen.getByRole("option", { name: "Send email and show link" }),
  ).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Email a new link" }),
  ).not.toBeInTheDocument();
  failed = true;
  await u.click(
    screen.getByRole("button", { name: "Refresh invitations and members" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Owner access changed",
  );
  expect(screen.queryByText("pilot@example.test")).not.toBeInTheDocument();
});
