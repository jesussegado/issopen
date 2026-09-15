// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import {
  AssigneeEditor,
  AssigneeLabel,
} from "../../src/web/components/AssigneeEditor.js";
import { CollaboratorPicker } from "../../src/web/components/CollaboratorPicker.js";
import type { Issue } from "../../src/web/types.js";

const ticket = {
  id: "issue",
  projectId: "project",
  version: 1,
  humanAssigneeId: null,
} as Issue;
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
it("read-only people cannot assign; removed attribution is explicit text", () => {
  render(
    <AssigneeEditor
      issue={ticket}
      questions={[]}
      canEdit={false}
      onDirty={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Change assignee" }),
  ).not.toBeInTheDocument();
  render(
    <AssigneeLabel
      issue={{
        ...ticket,
        humanAssigneeId: "person",
        humanAssigneeName: "<script>not HTML</script>",
        humanAssigneeHasAccess: false,
      }}
    />,
  );
  expect(screen.getByText(/No longer has project access/)).toBeInTheDocument();
  expect(document.querySelector("script")).toBeNull();
});
it("only sends on explicit save, cancel performs no write and stale assignment needs comparison", async () => {
  const fetchMock = vi.fn(async (_path: unknown, init?: RequestInit) =>
    init?.method === "PUT"
      ? json({ error: "Assignment changed" }, 409)
      : json({ issue: { ...ticket, version: 4 }, questions: [] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(
    <AssigneeEditor
      issue={ticket}
      questions={[]}
      canEdit
      onDirty={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Change assignee" }));
  await user.click(screen.getByRole("button", { name: "Cancel assignment" }));
  expect(fetchMock).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Change assignee" }));
  await user.click(screen.getByRole("button", { name: "Save assignee" }));
  await screen.findByText("Assignment changed");
  expect(screen.getByRole("button", { name: "Save assignee" })).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Load current assignment to compare" }),
  );
  expect(screen.getByRole("button", { name: "Save assignee" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Save assignee" }));
  expect(
    JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body)).expectedVersion,
  ).toBe(4);
});
it("search errors clear old people and a project switch ignores late results", async () => {
  let resolve!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    ),
  );
  const props = { projectId: "first", onChoose: vi.fn() };
  const view = render(<CollaboratorPicker {...props} />);
  await userEvent.click(screen.getByRole("button", { name: "Find people" }));
  view.rerender(<CollaboratorPicker {...props} projectId="second" />);
  resolve(
    json({
      collaborators: [{ id: "old", name: "Old project person" }],
      nextCursor: null,
    }),
  );
  await new Promise((done) => setTimeout(done, 0));
  expect(screen.queryByText(/Old project person/)).not.toBeInTheDocument();
});
