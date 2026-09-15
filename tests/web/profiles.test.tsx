// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ProfileEditor } from "../../src/web/components/ProfileEditor.js";
import { CollaboratorsRoute } from "../../src/web/routes/CollaboratorsRoute.js";

const profile = {
  name: "Ada",
  version: "00000000-0000-4000-8000-000000000001",
  avatarPng: null,
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

it("keeps a profile draft until explicit save and cancels without writes", async () => {
  const fetchMock = vi.fn(async (_path: unknown, init?: RequestInit) =>
    json({
      profile:
        init?.method === "PATCH"
          ? { ...profile, name: "Ada Lovelace" }
          : profile,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const saved = vi.fn();
  render(<ProfileEditor onSaved={saved} />);
  const user = userEvent.setup(),
    input = await screen.findByRole("textbox", { name: /Display name/ });
  await user.clear(input);
  await user.type(input, "Temporary draft");
  await user.click(
    screen.getByRole("button", { name: "Cancel profile changes" }),
  );
  expect(input).toHaveValue("Ada");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await user.clear(input);
  await user.type(input, "Ada Lovelace");
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith("Ada Lovelace"));
  expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
  expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
    JSON.stringify({
      expectedVersion: profile.version,
      name: "Ada Lovelace",
      avatarPng: null,
    }),
  );
});
it("retains stale edits, requires comparison, and saves only with the freshly loaded version", async () => {
  let reads = 0,
    writes = 0;
  const nextVersion = "00000000-0000-4000-8000-000000000002";
  const fetchMock = vi.fn(async (_path: unknown, init?: RequestInit) => {
    if (init?.method === "PATCH")
      return ++writes === 1
        ? json({ error: "Profile changed in another session" }, 409)
        : json({
            profile: { ...profile, version: nextVersion, name: "My draft" },
          });
    return json({
      profile:
        ++reads === 1
          ? profile
          : { ...profile, version: nextVersion, name: "Other browser" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<ProfileEditor />);
  const user = userEvent.setup(),
    input = await screen.findByRole("textbox", { name: /Display name/ });
  await user.clear(input);
  await user.type(input, "My draft");
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("Profile changed in another session");
  expect(input).toHaveValue("My draft");
  expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Load current profile to compare" }),
  );
  await screen.findByText("Other browser");
  expect(input).toHaveValue("My draft");
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() => expect(writes).toBe(2));
  expect(
    JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body)).expectedVersion,
  ).toBe(nextVersion);
});
it("a denied directory request clears previous people instead of leaking them during retry", async () => {
  let reads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      ++reads === 1
        ? json({
            collaborators: [
              {
                id: "a",
                name: "Private teammate",
                role: "member",
                permission: "read",
                avatarUrl: null,
              },
            ],
            nextCursor: null,
          })
        : json({ error: "No project access" }, 404),
    ),
  );
  render(<CollaboratorsRoute projectId="project" />);
  await screen.findByText("Private teammate");
  await userEvent.click(
    screen.getByRole("button", { name: "Search collaborators" }),
  );
  await screen.findByText(
    "This project's collaborators are no longer available to you.",
  );
  expect(screen.queryByText("Private teammate")).not.toBeInTheDocument();
});
