// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IssueDetailRoute } from "../../src/web/routes/IssueDetailRoute.js";
import type { Session } from "../../src/web/types.js";

const timestamp = "2026-09-13T22:00:00.000Z";
const viewer: Session = {
  user: { id: "person", name: "Person", email: "person@example.test" },
  workspace: { id: "workspace", name: "Workspace", version: 1, role: "member" },
};
class FakeStream extends EventTarget {
  static instances: FakeStream[] = [];
  close = vi.fn();
  constructor(public url: string) {
    super();
    FakeStream.instances.push(this);
  }
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function fixture() {
  const data = {
    issue: {
      id: "issue",
      projectId: "project",
      workspaceId: "workspace",
      number: 1,
      key: "ISS-1",
      title: "Original",
      description: "Original description",
      priority: "medium",
      status: "backlog",
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      humanOwnerId: "owner",
      claimedByAgentId: null,
    },
    epic: null,
    codeLinks: [],
    comments: [],
    questions: [1, 2].map((n) => ({
      id: `q${n}`,
      workspaceId: "workspace",
      issueId: "issue",
      prompt: `Question ${n}`,
      recommendation: "Choose",
      options: [{ id: `o${n}`, label: `Option ${n}`, description: "" }],
      recommendedOptionId: `o${n}`,
      blocking: true,
      answerOptionId: null,
      answerOtherText: null as string | null,
      answeredByUserId: null as string | null,
      answeredAt: null as string | null,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    questionSummary: { total: 2, answered: 0, unansweredBlocking: 2 },
  };
  let status = 200;
  let canEdit = true;
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const path = String(input);
    if (init?.method === "PATCH")
      return json(
        {
          error:
            "This answer changed. Compare the latest response before saving your draft.",
        },
        409,
      );
    if (path === "/api/v1/issues/issue") return json(data, status);
    if (path.endsWith("/activity")) return json({ activity: [] });
    if (path.endsWith("/evidence")) return json({ evidence: [] });
    if (path === "/api/v1/projects/project")
      return json({
        project: { id: "project", name: "Project", key: "ISS", canEdit },
      });
    if (path === "/api/v1/session") return json(viewer);
    throw new Error(`Unexpected ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    data,
    fetchMock,
    setCanEdit: (value: boolean) => {
      canEdit = value;
    },
    setStatus: (value: number) => {
      status = value;
    },
  };
}
beforeEach(() => {
  FakeStream.instances = [];
  vi.stubGlobal("EventSource", FakeStream);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function event(name = "board") {
  await waitFor(() => expect(FakeStream.instances.length).toBeGreaterThan(0));
  await act(async () => {
    FakeStream.instances.at(-1)?.dispatchEvent(new Event(name));
  });
}

it("applies an edit downgrade immediately without discarding an unsaved answer", async () => {
  const { setCanEdit } = fixture();
  const user = userEvent.setup();
  render(<IssueDetailRoute issueId="issue" session={viewer} />);
  await screen.findByText("Question 1");
  await user.click(screen.getByLabelText("Other", { exact: true }));
  await user.type(
    screen.getByLabelText("Your answer (required)"),
    "Retain my draft",
  );
  setCanEdit(false);
  await event();
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Save answer" }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByLabelText("Your answer (required)")).toBeDisabled();
  expect(screen.getByLabelText("Your answer (required)")).toHaveValue(
    "Retain my draft",
  );
  setCanEdit(true);
  await event();
  expect(
    await screen.findByRole("button", { name: "Save answer" }),
  ).toBeEnabled();
  expect(screen.getByLabelText("Your answer (required)")).toHaveValue(
    "Retain my draft",
  );
});

it("updates clean details automatically and clears them when access is revoked", async () => {
  const { data } = fixture();
  render(<IssueDetailRoute issueId="issue" session={viewer} />);
  await screen.findByRole("heading", { name: "1-Original" });
  data.issue = { ...data.issue, title: "Saved remotely", version: 2 };
  await event();
  expect(
    await screen.findByRole("heading", { name: "1-Saved remotely" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("region", { name: "Remote changes" }),
  ).not.toBeInTheDocument();
  await event("access-lost");
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { name: "1-Saved remotely" }),
    ).not.toBeInTheDocument(),
  );
  expect(FakeStream.instances.at(-1)?.close).toHaveBeenCalled();
});

it("preserves comment and answer drafts, compares remote changes and keeps the selected question by ID", async () => {
  const { data } = fixture();
  const user = userEvent.setup();
  render(<IssueDetailRoute issueId="issue" session={viewer} />);
  await screen.findByText("Question 1");
  await user.type(
    screen.getByLabelText("Add comment (required)"),
    "Unsaved comment",
  );
  await user.click(screen.getByRole("radio", { name: "Other" }));
  await user.type(
    screen.getByLabelText("Your answer (required)"),
    "My pending answer",
  );
  data.issue = { ...data.issue, title: "Remote title", version: 2 };
  data.questions = [...data.questions].reverse().map((q) =>
    q.id === "q1"
      ? {
          ...q,
          answerOtherText: "Other person's answer",
          answeredAt: timestamp,
          answeredByUserId: "another",
          version: 2,
        }
      : q,
  );
  data.questionSummary = { total: 2, answered: 1, unansweredBlocking: 1 };
  await event();
  await screen.findByRole("region", { name: "Remote changes" });
  expect(screen.getByRole("heading", { name: "1-Original" })).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Compare latest changes" }),
  );
  expect(screen.getByText(/Saved answer: Other person's answer/)).toBeVisible();
  await user.click(
    screen.getByRole("button", {
      name: "Load latest changes and keep my drafts",
    }),
  );
  expect(screen.getByRole("heading", { name: "1-Remote title" })).toBeVisible();
  expect(screen.getByText("Question 2 of 2")).toBeVisible();
  expect(screen.getByLabelText("Your answer (required)")).toHaveValue(
    "My pending answer",
  );
  expect(screen.getByLabelText("Add comment (required)")).toHaveValue(
    "Unsaved comment",
  );
});

it("keeps a stale answer draft on 409 and sends its original question version", async () => {
  const { fetchMock } = fixture();
  const user = userEvent.setup();
  render(<IssueDetailRoute issueId="issue" session={viewer} />);
  await screen.findByText("Question 1");
  await user.click(screen.getByRole("radio", { name: "Other" }));
  await user.type(screen.getByLabelText("Your answer (required)"), "My answer");
  await user.click(screen.getByRole("button", { name: "Save answer" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This answer changed",
  );
  expect(screen.getByLabelText("Your answer (required)")).toHaveValue(
    "My answer",
  );
  const call = fetchMock.mock.calls.find(
    ([, init]) => init?.method === "PATCH",
  );
  expect(JSON.parse(String(call?.[1]?.body))).toEqual({
    kind: "other",
    text: "My answer",
    expectedVersion: 1,
  });
});

it("retains drafts across a network failure and reconciles on reconnect", async () => {
  const { data, setStatus } = fixture();
  const user = userEvent.setup();
  const rendered = render(
    <IssueDetailRoute issueId="issue" session={viewer} />,
  );
  await screen.findByText("Question 1");
  await user.type(
    screen.getByLabelText("Add comment (required)"),
    "Offline draft",
  );
  setStatus(503);
  await event("error");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Live updates are temporarily unavailable",
  );
  setStatus(200);
  data.issue = { ...data.issue, title: "Reconnected", version: 2 };
  await act(async () => {
    window.dispatchEvent(new Event("online"));
  });
  await screen.findByRole("region", { name: "Remote changes" });
  expect(screen.getByLabelText("Add comment (required)")).toHaveValue(
    "Offline draft",
  );
  rendered.unmount();
  expect(FakeStream.instances.at(-1)?.close).toHaveBeenCalled();
});
