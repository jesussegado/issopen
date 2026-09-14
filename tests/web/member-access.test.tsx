// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MemberAccessEditor } from "../../src/web/components/MemberAccessEditor.js";
import { MembersRoute } from "../../src/web/routes/MembersRoute.js";
import type { Project, WorkspaceMember } from "../../src/web/types.js";

const projects = [
  { id: "a", name: "Project A", key: "A" },
  { id: "b", name: "Project B", key: "B" },
] as Project[];
const member: WorkspaceMember = {
  userId: "member",
  name: "Ada",
  email: "ada@example.test",
  role: "member",
  version: "version-first",
  projectIds: ["a"],
  projectGrants: [{ projectId: "a", permission: "edit" }],
  createdAt: "2026-09-14T00:00:00Z",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

it("previews each delta, cancels without a request and only saves after explicit confirmation", async () => {
  const fetchMock = vi.fn(async () => json({ updated: true }));
  vi.stubGlobal("fetch", fetchMock);
  const saved = vi.fn(async () => {}),
    cancel = vi.fn(),
    user = userEvent.setup();
  render(
    <MemberAccessEditor
      member={member}
      projects={projects}
      onSaved={saved}
      onCancel={cancel}
    />,
  );
  expect(screen.getByRole("button", { name: "Review changes" })).toBeDisabled();
  await user.selectOptions(
    screen.getByRole("combobox", { name: /Project A/ }),
    "read",
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: /Project B/ }),
    "edit",
  );
  await user.click(screen.getByRole("button", { name: "Review changes" }));
  expect(screen.getByText("Project A: Edit → Read only")).toBeVisible();
  expect(screen.getByText("Project B: No access → Edit")).toBeVisible();
  expect(fetchMock).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Back to editing" }));
  await user.click(screen.getByRole("button", { name: "Review changes" }));
  await user.click(
    screen.getByRole("button", { name: "Confirm permission changes" }),
  );
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/v1/members/member",
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        expectedVersion: "version-first",
        grants: [
          { projectId: "a", permission: "read" },
          { projectId: "b", permission: "edit" },
        ],
      }),
    }),
  );
  expect(cancel).not.toHaveBeenCalled();
});

it("keeps a zero-project draft after conflict and requires reload, comparison and a fresh confirmation", async () => {
  let attempts = 0;
  const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
    if (init?.method === "PATCH")
      return ++attempts === 1
        ? json({ error: "Member access changed" }, 409)
        : json({ updated: true });
    return json({
      members: [
        {
          ...member,
          version: "version-second",
          projectIds: ["b"],
          projectGrants: [{ projectId: "b", permission: "read" }],
        },
      ],
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  const saved = vi.fn(async () => {}),
    user = userEvent.setup();
  render(
    <MemberAccessEditor
      member={member}
      projects={projects}
      onSaved={saved}
      onCancel={() => {}}
    />,
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: /Project A/ }),
    "none",
  );
  expect(
    screen.getByText(/No projects: membership stays active/),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Review changes" }));
  await user.click(
    screen.getByRole("button", { name: "Confirm permission changes" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Member access changed",
  );
  expect(screen.getByRole("combobox", { name: /Project A/ })).toHaveValue(
    "none",
  );
  expect(screen.getByRole("button", { name: "Review changes" })).toBeDisabled();
  await user.click(
    screen.getByRole("button", {
      name: "Reload current permissions and keep my draft",
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Review changes" }),
    ).toBeEnabled(),
  );
  expect(screen.getByRole("combobox", { name: /Project B/ })).toHaveValue(
    "none",
  );
  await user.click(screen.getByRole("button", { name: "Review changes" }));
  expect(screen.getByText("Project B: Read only → No access")).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Confirm permission changes" }),
  );
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/v1/members/member",
    expect.objectContaining({
      body: JSON.stringify({ expectedVersion: "version-second", grants: [] }),
    }),
  );
});

it("searches members, makes zero-project access explicit and confirms versioned removal", async () => {
  const zero = { ...member, projectIds: [], projectGrants: [] };
  const fetchMock = vi.fn(async () =>
    json({
      members: [
        zero,
        {
          ...member,
          userId: "owner",
          name: "Owner",
          email: "owner@example.test",
          role: "owner",
          projectIds: null,
          projectGrants: null,
        },
      ],
      invitations: [],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const user = userEvent.setup();
  render(<MembersRoute projects={projects} />);
  await screen.findByText("ada@example.test");
  expect(
    screen.getByText(/No projects assigned · waiting for access/),
  ).toBeVisible();
  await user.type(
    screen.getByRole("textbox", { name: "Search members" }),
    "ada",
  );
  expect(screen.queryByText("owner@example.test")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Remove access" }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole("button", { name: "Remove access" }));
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/members/member",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ expectedVersion: member.version }),
      }),
    ),
  );
});
