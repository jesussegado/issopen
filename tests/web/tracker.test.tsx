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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BoardRoute } from "../../src/web/routes/BoardRoute.js";
import {
  EpicDetailRoute,
  EpicFormRoute,
  EpicsRoute,
} from "../../src/web/routes/EpicRoutes.js";
import { IssueDetailRoute } from "../../src/web/routes/IssueDetailRoute.js";
import { IssueFormRoute } from "../../src/web/routes/TrackerForms.js";
import { issueStatuses } from "../../src/web/types.js";
import { syntheticPng } from "../fixtures/png.js";

const project = {
  id: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  name: "Private tracker",
  key: "PRI",
  description: "",
  repositoryUrl: "https://git.example.test/owner/tracker",
  defaultBranch: "main",
  repositorySubdirectory: null,
  showReviewColumn: true,
  showDoneColumn: true,
  version: 1,
  createdAt: "2026-08-31T12:00:00.000Z",
  updatedAt: "2026-08-31T12:00:00.000Z",
  questionSummary: { total: 0, answered: 0, unansweredBlocking: 0 },
};

const issue = {
  id: "33333333-3333-4333-8333-333333333333",
  workspaceId: project.workspaceId,
  projectId: project.id,
  epicId: null,
  number: 1,
  key: "PRI-1",
  title: "Render <img src=x onerror=alert(1)> as text",
  description: "First line\n<script>alert(1)</script>",
  priority: "medium" as const,
  status: "backlog" as const,
  humanOwnerId: "owner-1",
  claimedByAgentId: null,
  claimedAt: null,
  version: 1,
  createdAt: "2026-08-31T12:00:00.000Z",
  updatedAt: "2026-08-31T12:00:00.000Z",
};

const epic = {
  id: "55555555-5555-4555-8555-555555555555",
  workspaceId: project.workspaceId,
  projectId: project.id,
  number: 7,
  title: "MCP foundations",
  description: "Close the first usable agent workflow.",
  version: 1,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  summary: {
    totalIssues: 1,
    doneIssues: 0,
    statusCounts: {
      backlog: 1,
      ready: 0,
      in_progress: 0,
      ready_for_review: 0,
      done: 0,
    },
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() =>
  window.history.replaceState({}, "", `/projects/${project.id}`),
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("tracker web routes", () => {
  it.each(["issue", "epic"] as const)(
    "preserves a %s draft on 409 and compares before adopting a fresh base",
    async (kind) => {
      let reads = 0;
      const patches: Record<string, unknown>[] = [];
      const entity = kind === "issue" ? issue : epic;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const path = String(input);
          if (path === `/api/v1/${kind}s/${entity.id}`) {
            if (init?.method === "PATCH") {
              patches.push(JSON.parse(String(init.body)));
              return json(
                {
                  error: "This plan changed; your draft is preserved",
                },
                409,
              );
            }
            reads++;
            return json({
              [kind]: {
                ...entity,
                version: reads === 1 ? 1 : 2,
                description:
                  reads === 1 ? entity.description : "Saved by another editor",
              },
              questions: [],
            });
          }
          if (path.endsWith("/epics")) return json({ epics: [epic] });
          if (path === `/api/v1/projects/${project.id}`)
            return json({ project });
          throw new Error(`Unexpected request ${path}`);
        }),
      );
      render(
        kind === "issue" ? (
          <IssueFormRoute issueId={issue.id} />
        ) : (
          <EpicFormRoute epicId={epic.id} />
        ),
      );
      const description = await screen.findByRole("textbox", {
        name: /^Description/,
      });
      const user = userEvent.setup();
      await user.clear(description);
      await user.type(description, "My unsaved draft");
      await user.click(
        screen.getByRole("button", {
          name: kind === "issue" ? "Save issue" : "Save Epic",
        }),
      );
      expect(description).toHaveValue("My unsaved draft");
      expect(patches[0]?.expectedVersion).toBe(1);
      await user.click(
        await screen.findByRole("button", { name: "Compare latest version" }),
      );
      expect(
        await screen.findByText("Saved by another editor"),
      ).toBeInTheDocument();
      expect(description).toHaveValue("My unsaved draft");
      expect(patches).toHaveLength(1);
      await user.click(
        screen.getByRole("button", {
          name: "I have merged the changes; keep my draft",
        }),
      );
      await user.click(
        screen.getByRole("button", {
          name: kind === "issue" ? "Save issue" : "Save Epic",
        }),
      );
      expect(patches[1]?.expectedVersion).toBe(2);
      expect(patches[1]?.description).toBe("My unsaved draft");
    },
  );
  it("renders server text safely and moves a card only after the authoritative response", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path.endsWith("/board")) {
          return json({
            project,
            columns: issueStatuses.map((status) => ({
              status,
              issues: status === "backlog" ? [issue] : [],
            })),
          });
        }
        if (path === `/api/v1/issues/${issue.id}` && init?.method === "PATCH") {
          return json({ issue: { ...issue, status: "ready", version: 2 } });
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<BoardRoute projectId={project.id} />);

    expect(
      await screen.findByRole("heading", { name: "Private tracker" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: `1-${issue.title}` }),
    ).toHaveTextContent("<img src=x onerror=alert(1)>");
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("First line", { exact: false })).not.toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Show details for 1" }),
    );
    const originalCard = screen
      .getByRole("link", { name: `1-${issue.title}` })
      .closest("li");
    if (!originalCard) throw new Error("Expected original issue card");
    expect(
      within(originalCard).getByText("First line", { exact: false }),
    ).toBeVisible();
    const status = screen.getByRole("combobox", {
      name: "Change status for 1",
    });
    await user.selectOptions(status, "ready");
    expect(await screen.findByText("1 moved to Ready")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Change status for 1" }),
      ).toHaveFocus(),
    );
    expect(
      screen.getByRole("heading", { name: "Ready" }).closest("section"),
    ).toHaveTextContent(issue.title);
  });

  it("refreshes an open board from SSE while preserving local presentation state", async () => {
    class FakeEventSource {
      static current: FakeEventSource | null = null;
      readonly url: string;
      closed = false;
      private listeners = new Map<string, Set<EventListener>>();

      constructor(url: string) {
        this.url = url;
        FakeEventSource.current = this;
      }

      addEventListener(type: string, listener: EventListener) {
        const listeners = this.listeners.get(type) ?? new Set<EventListener>();
        listeners.add(listener);
        this.listeners.set(type, listeners);
      }

      removeEventListener(type: string, listener: EventListener) {
        this.listeners.get(type)?.delete(listener);
      }

      emit(type: string) {
        for (const listener of this.listeners.get(type) ?? [])
          listener(new MessageEvent(type));
      }

      close() {
        this.closed = true;
      }
    }
    vi.stubGlobal("EventSource", FakeEventSource);
    const remoteIssue = {
      ...issue,
      id: "44444444-4444-4444-8444-444444444444",
      number: 2,
      key: "PRI-2",
      title: "Created from another client",
      status: "ready" as const,
    };
    let boardReads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (!String(input).endsWith("/board"))
          throw new Error(`Unexpected request: ${String(input)}`);
        boardReads++;
        return json({
          project,
          columns: issueStatuses.map((status) => ({
            status,
            issues:
              status === "backlog"
                ? [issue]
                : status === "ready" && boardReads > 1
                  ? [remoteIssue]
                  : [],
          })),
        });
      }),
    );
    const user = userEvent.setup();
    const rendered = render(<BoardRoute projectId={project.id} />);

    await screen.findByRole("link", { name: `1-${issue.title}` });
    expect(FakeEventSource.current?.url).toBe(
      `/api/v1/projects/${project.id}/board/events`,
    );
    await user.click(
      screen.getByRole("button", { name: "Show details for 1" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Collapse Ready column" }),
    );
    FakeEventSource.current?.emit("board");

    await waitFor(() => expect(boardReads).toBe(2));
    const liveOriginalCard = screen
      .getByRole("link", { name: `1-${issue.title}` })
      .closest("li");
    if (!liveOriginalCard) throw new Error("Expected original issue card");
    expect(
      within(liveOriginalCard).getByText("First line", { exact: false }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Expand Ready column" }),
    ).toHaveAttribute("aria-expanded", "false");
    await user.click(
      screen.getByRole("button", { name: "Expand Ready column" }),
    );
    expect(
      screen.getByRole("link", { name: `2-${remoteIssue.title}` }),
    ).toBeVisible();
    const source = FakeEventSource.current;
    rendered.unmount();
    expect(source?.closed).toBe(true);
  });

  it("collapses board columns and expands card previews independently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/board")) {
          return json({
            project,
            columns: issueStatuses.map((status) => ({
              status,
              issues: status === "backlog" ? [issue] : [],
            })),
          });
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      }),
    );
    const user = userEvent.setup();
    render(<BoardRoute projectId={project.id} />);

    const title = await screen.findByRole("link", {
      name: `1-${issue.title}`,
    });
    expect(title).toBeVisible();
    expect(screen.queryByText(issue.key)).not.toBeInTheDocument();
    expect(screen.queryByText(project.key)).not.toBeInTheDocument();
    const collapse = screen.getByRole("button", {
      name: "Collapse Backlog column",
    });
    await user.click(collapse);
    expect(title).not.toBeVisible();
    const expand = screen.getByRole("button", {
      name: "Expand Backlog column",
    });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await user.click(expand);
    expect(title).toBeVisible();

    const showDetails = screen.getByRole("button", {
      name: "Show details for 1",
    });
    expect(showDetails).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("First line", { exact: false })).not.toBeVisible();
    await user.click(showDetails);
    expect(screen.getByText("First line", { exact: false })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Hide details for 1" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("omits disabled completion columns while keeping their statuses available", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path.endsWith("/board")) {
          return json({
            project: {
              ...project,
              showReviewColumn: false,
              showDoneColumn: false,
            },
            totalIssueCount: 2,
            hiddenIssueCount: 1,
            columns: issueStatuses.slice(0, 3).map((status) => ({
              status,
              issues: status === "backlog" ? [issue] : [],
            })),
          });
        }
        if (path === `/api/v1/issues/${issue.id}` && init?.method === "PATCH") {
          expect(JSON.parse(String(init.body))).toEqual({ status: "done" });
          return json({ issue: { ...issue, status: "done", version: 2 } });
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<BoardRoute projectId={project.id} />);

    await screen.findByRole("heading", { name: project.name });
    expect(
      screen.queryByRole("heading", { name: "Ready for Human Review" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Done" }),
    ).not.toBeInTheDocument();
    const statusFilter = screen.getByRole("combobox", { name: "Show status" });
    expect(
      within(statusFilter).queryByRole("option", {
        name: "Ready for Human Review",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(statusFilter).queryByRole("option", { name: "Done" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/1 hidden ticket is/)).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Show details for 1" }),
    );
    const issueStatus = screen.getByRole("combobox", {
      name: "Change status for 1",
    });
    expect(
      within(issueStatus).getByRole("option", {
        name: "Ready for Human Review",
      }),
    ).toBeInTheDocument();
    expect(
      within(issueStatus).getByRole("option", { name: "Done" }),
    ).toBeInTheDocument();
    await user.selectOptions(issueStatus, "done");

    expect(await screen.findByText("1 moved to Done")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: `1-${issue.title}` })).toBeNull();
    expect(screen.getByText(/2 hidden tickets are/)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Issues hidden from this board" }),
    ).toBeVisible();
  });

  it("filters the board by Epic and links the expanded card to its container", async () => {
    const epicIssue = { ...issue, epicId: epic.id };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === `/api/v1/projects/${project.id}/board`) {
        return json({
          project,
          epics: [epic],
          columns: issueStatuses.map((status) => ({
            status,
            issues: status === "backlog" ? [epicIssue] : [],
          })),
        });
      }
      if (
        path ===
        `/api/v1/projects/${project.id}/board?epicId=${encodeURIComponent(epic.id)}`
      ) {
        return json({
          project,
          epics: [epic],
          columns: issueStatuses.map((status) => ({
            status,
            issues: status === "backlog" ? [epicIssue] : [],
          })),
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<BoardRoute projectId={project.id} />);

    await screen.findByRole("heading", { name: project.name });
    const epicOverview = screen.getByRole("region", { name: "Epics" });
    expect(
      within(epicOverview).getByRole("link", { name: `7-${epic.title}` }),
    ).toHaveAttribute("href", `/epics/${epic.id}`);
    expect(within(epicOverview).getByText("1 ticket")).toBeVisible();
    expect(within(epicOverview).getByText("0/1 done")).toBeVisible();
    expect(
      within(epicOverview).queryByText(epic.description),
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Show Epic"), epic.id);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/projects/${project.id}/board?epicId=${encodeURIComponent(epic.id)}`,
        expect.anything(),
      ),
    );
    expect(window.location.search).toBe(`?epic=${epic.id}`);
    await user.click(
      screen.getByRole("button", { name: "Show details for 1" }),
    );
    expect(
      screen.getAllByRole("link", { name: `7-${epic.title}` }),
    ).toHaveLength(2);
  });

  it("lists project Epics when the issue board is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/board")) {
          return json({
            project,
            epics: [
              {
                ...epic,
                summary: {
                  ...epic.summary,
                  totalIssues: 0,
                  statusCounts: {
                    backlog: 0,
                    ready: 0,
                    in_progress: 0,
                    ready_for_review: 0,
                    done: 0,
                  },
                },
              },
            ],
            columns: issueStatuses.map((status) => ({ status, issues: [] })),
          });
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      }),
    );

    render(<BoardRoute projectId={project.id} />);

    const epicOverview = await screen.findByRole("region", { name: "Epics" });
    expect(
      within(epicOverview).getByRole("link", { name: `7-${epic.title}` }),
    ).toBeVisible();
    expect(within(epicOverview).getByText("0 tickets")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "No issues yet" }),
    ).toBeVisible();
  });

  it("creates an Epic without leaving the panel and exposes its related tickets", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path === `/api/v1/projects/${project.id}`) return json({ project });
        if (path === `/api/v1/projects/${project.id}/epics`) {
          if (init?.method === "POST") {
            expect(JSON.parse(String(init.body))).toEqual({
              title: "Release readiness",
              description: "Group the closing work",
            });
            return json({ epic: { ...epic, title: "Release readiness" } }, 201);
          }
          return json({ epics: [epic] });
        }
        throw new Error(`Unexpected request: ${path}`);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    window.history.replaceState({}, "", `/projects/${project.id}/epics`);
    render(<EpicsRoute projectId={project.id} />);

    expect(
      await screen.findByRole("link", { name: `7-${epic.title}` }),
    ).toBeVisible();
    expect(screen.getByText("0 done")).toBeVisible();
    expect(screen.getByText("1 tickets · 0%")).toBeVisible();
    expect(screen.queryByText(epic.description)).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Title (required)"),
      "Release readiness",
    );
    await user.type(
      screen.getByLabelText(/^Description/),
      "Group the closing work",
    );
    await user.click(screen.getByRole("button", { name: "Create Epic" }));
    expect(await screen.findByText("Epic created")).toBeVisible();
    expect(window.location.pathname).toBe(`/projects/${project.id}/epics`);
    expect(
      screen.getByRole("link", { name: "7-Release readiness" }),
    ).toHaveAttribute("href", `/epics/${epic.id}`);
    expect(screen.getByLabelText("Title (required)")).toHaveValue("");
    expect(screen.getByLabelText(/^Description/)).toHaveValue("");

    cleanup();
    window.history.replaceState({}, "", `/epics/${epic.id}`);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path === `/api/v1/epics/${epic.id}`)
          return json({ epic, issues: [{ ...issue, epicId: epic.id }] });
        if (path === `/api/v1/projects/${project.id}`) return json({ project });
        throw new Error(`Unexpected request: ${path}`);
      }),
    );
    render(<EpicDetailRoute epicId={epic.id} />);
    expect(
      await screen.findByRole("heading", { name: `7-${epic.title}` }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: `1-${issue.title}` }),
    ).toHaveAttribute("href", `/issues/${issue.id}`);
    expect(screen.getByRole("link", { name: "View on board" })).toHaveAttribute(
      "href",
      `/projects/${project.id}?epic=${epic.id}`,
    );
    expect(screen.getByText(epic.description)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Create ticket in Epic" }),
    ).toHaveAttribute(
      "href",
      `/projects/${project.id}/issues/new?epic=${epic.id}`,
    );
  });

  it("adds private images while creating a web issue and retries an uncertain request safely", async () => {
    const submitted: Record<string, unknown>[] = [];
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path === `/api/v1/projects/${project.id}`) return json({ project });
        if (path === `/api/v1/projects/${project.id}/epics`)
          return json({ epics: [epic] });
        if (path === "/api/v1/captures" && init?.method === "POST") {
          submitted.push(JSON.parse(String(init.body)));
          attempts++;
          if (attempts === 1) throw new TypeError("connection ended");
          return json({ issue }, 201);
        }
        throw new Error(`Unexpected request: ${path}`);
      }),
    );
    window.history.replaceState(
      {},
      "",
      `/projects/${project.id}/issues/new?epic=${epic.id}`,
    );
    const user = userEvent.setup();
    render(<IssueFormRoute projectId={project.id} />);

    await screen.findByRole("heading", { name: "Create issue" });
    expect(screen.getByLabelText(/^Epic/)).toHaveValue(epic.id);
    const file = new File([syntheticPng(true)], "review.png", {
      type: "image/png",
    });
    await user.upload(screen.getByLabelText("Choose images"), file);
    expect(await screen.findByText(/Image added/)).toBeVisible();
    expect(screen.getByRole("img", { name: "Attachment 1" })).toBeVisible();
    await user.type(screen.getByLabelText("Title (required)"), "Web evidence");
    await user.click(screen.getByRole("button", { name: "Create issue" }));

    expect(
      await screen.findByRole("button", { name: "Retry safely" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Title (required)")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry safely" }));
    await waitFor(() =>
      expect(window.location.pathname).toBe(`/issues/${issue.id}`),
    );
    expect(submitted).toHaveLength(2);
    expect(submitted[1]).toEqual(submitted[0]);
    expect(submitted[0]).toMatchObject({
      projectId: project.id,
      epicId: epic.id,
      title: "Web evidence",
      images: [expect.stringMatching(/^data:image\/png;base64,/)],
    });
    expect(submitted[0]?.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("marks and filters cards with unanswered blocking questions", async () => {
    const blocked = {
      ...issue,
      questionSummary: { total: 2, answered: 1, unansweredBlocking: 1 },
    };
    const clear = {
      ...issue,
      id: "44444444-4444-4444-8444-444444444444",
      number: 2,
      key: "PRI-2",
      title: "No questions blocking",
      status: "ready" as const,
      questionSummary: { total: 1, answered: 1, unansweredBlocking: 0 },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/board")) {
          return json({
            project,
            columns: issueStatuses.map((status) => ({
              status,
              issues:
                status === "backlog"
                  ? [blocked]
                  : status === "ready"
                    ? [clear]
                    : [],
            })),
          });
        }
        throw new Error(`Unexpected request: ${String(input)}`);
      }),
    );
    const user = userEvent.setup();
    render(<BoardRoute projectId={project.id} />);

    expect(await screen.findByText("⚠ 1 unanswered")).toBeInTheDocument();
    expect(screen.getByText(`2-${clear.title}`)).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Show details for 1" }),
    );
    const blockedStatus = screen.getByRole("combobox", {
      name: "Change status for 1",
    });
    expect(
      blockedStatus.querySelector('option[value="ready_for_review"]'),
    ).toBeDisabled();
    expect(
      screen.getByText("Answer blocking questions before review."),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Show questions" }),
      "warnings",
    );
    expect(screen.getByText(`1-${blocked.title}`)).toBeInTheDocument();
    expect(screen.queryByText(`2-${clear.title}`)).not.toBeInTheDocument();
    expect(screen.getAllByText("No tickets with warnings").length).toBe(4);
  });

  it("renders immutable, attributed activity and review controls from the server", async () => {
    const reviewIssue = { ...issue, status: "ready_for_review" as const };
    const agentComment = {
      id: "99999999-9999-4999-8999-999999999999",
      workspaceId: project.workspaceId,
      issueId: issue.id,
      body: "Agent checkpoint <script>comment()</script>",
      authorType: "agent" as const,
      authorId: "agent-1",
      authorDisplayName: "Codex",
      source: "mcp" as const,
      createdAt: project.createdAt,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path === `/api/v1/issues/${issue.id}`)
          return json({
            issue: reviewIssue,
            codeLinks: [],
            questions: [],
            comments: [agentComment],
            questionSummary: {
              total: 0,
              answered: 0,
              unansweredBlocking: 0,
            },
          });
        if (
          path === `/api/v1/issues/${issue.id}/comments` &&
          init?.method === "POST"
        ) {
          expect(JSON.parse(String(init.body))).toEqual({
            body: "Human review note",
          });
          return json({
            comment: {
              ...agentComment,
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              body: "Human review note",
              authorType: "human",
              authorId: "owner-1",
              authorDisplayName: "Owner",
              source: "rest",
              createdAt: "2026-08-31T12:40:00.000Z",
            },
          });
        }
        if (path === `/api/v1/issues/${issue.id}/activity`)
          return json({
            activity: [
              {
                id: "event-1",
                issueId: issue.id,
                type: "issue.created",
                actorType: "human",
                actorId: "owner-1",
                actorDisplayName: "Owner",
                source: "rest",
                summary: "Created PRI-1",
                changes: {},
                createdAt: "2026-08-31T12:32:00.000Z",
              },
              {
                id: "event-2",
                issueId: issue.id,
                type: "review.accepted",
                actorType: "human",
                actorId: "owner-1",
                actorDisplayName: "Owner",
                source: "rest",
                summary: "Accepted PRI-1",
                changes: {},
                createdAt: "2026-08-31T12:45:00.000Z",
              },
            ],
          });
        if (path === `/api/v1/projects/${project.id}`) return json({ project });
        throw new Error(`Unexpected request: ${path}`);
      }),
    );
    window.history.replaceState({}, "", `/issues/${issue.id}`);
    const user = userEvent.setup();
    render(<IssueDetailRoute issueId={issue.id} />);

    expect(
      await screen.findByRole("heading", { name: `1-${issue.title}` }),
    ).toBeInTheDocument();
    expect(document.querySelector(".description")).toHaveTextContent(
      "<script>alert(1)</script>",
    );
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("Agent · Codex")).toBeInTheDocument();
    expect(screen.getByText(agentComment.body)).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Add comment (required)"),
      "Human review note",
    );
    await user.click(screen.getByRole("button", { name: "Add comment" }));
    expect(await screen.findByText("Human review note")).toBeInTheDocument();
    const commentItems = document.querySelectorAll(
      ".comment-list .comment-item",
    );
    expect(commentItems).toHaveLength(2);
    expect(commentItems[0]).toHaveTextContent("Human review note");
    expect(commentItems[1]).toHaveTextContent(agentComment.body);
    expect(
      screen.queryByRole("button", { name: /edit comment|delete comment/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Review result" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No code result is linked yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("Created 1")).toBeInTheDocument();
    const activityItems = document.querySelectorAll(
      ".activity-list .activity-item",
    );
    expect(activityItems).toHaveLength(2);
    expect(activityItems[0]).toHaveTextContent("Accepted 1");
    expect(activityItems[1]).toHaveTextContent("Created 1");
    expect(screen.getAllByText("You")).toHaveLength(3);
    expect(
      screen.queryByRole("button", { name: /delete activity/i }),
    ).not.toBeInTheDocument();
  });

  it("navigates questions and saves option or Other answers", async () => {
    const firstQuestion = {
      id: "55555555-5555-4555-8555-555555555555",
      workspaceId: project.workspaceId,
      issueId: issue.id,
      prompt: "Which interface should we ship?",
      recommendation: "Use responsive HTML.",
      options: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          label: "Responsive HTML",
          description: "Works in every supported browser",
        },
        {
          id: "77777777-7777-4777-8777-777777777777",
          label: "Desktop application",
          description: "Requires installation",
        },
      ],
      recommendedOptionId: "66666666-6666-4666-8666-666666666666",
      blocking: true,
      answerOptionId: null,
      answerOtherText: null,
      answeredByUserId: null,
      answeredAt: null,
      version: 1,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
    const secondQuestion = {
      ...firstQuestion,
      id: "88888888-8888-4888-8888-888888888888",
      prompt: "What should the fallback be?",
      answerOtherText: "Keep the current web flow.",
      answeredByUserId: "owner-1",
      answeredAt: project.updatedAt,
      version: 2,
    };
    let answerRequest = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path === `/api/v1/issues/${issue.id}`)
          return json({
            issue: {
              ...issue,
              questionSummary: {
                total: 2,
                answered: 1,
                unansweredBlocking: 1,
              },
            },
            codeLinks: [],
            questions: [firstQuestion, secondQuestion],
            comments: [],
            questionSummary: {
              total: 2,
              answered: 1,
              unansweredBlocking: 1,
            },
          });
        if (path === `/api/v1/issues/${issue.id}/activity`)
          return json({ activity: [] });
        if (path === `/api/v1/projects/${project.id}`) return json({ project });
        if (
          path ===
            `/api/v1/issues/${issue.id}/questions/${firstQuestion.id}/answer` &&
          init?.method === "PATCH"
        ) {
          answerRequest += 1;
          const submitted = JSON.parse(String(init.body));
          if (answerRequest === 1) {
            expect(submitted).toEqual({
              kind: "option",
              optionId: firstQuestion.options[0]?.id,
            });
            return json({
              question: {
                ...firstQuestion,
                answerOptionId: firstQuestion.options[0]?.id,
                answeredByUserId: "owner-1",
                answeredAt: project.updatedAt,
                version: 2,
              },
              questionSummary: {
                total: 2,
                answered: 2,
                unansweredBlocking: 0,
              },
            });
          }
          expect(submitted).toEqual({
            kind: "other",
            text: "Use a progressive web app.",
          });
          return json({
            question: {
              ...firstQuestion,
              answerOtherText: "Use a progressive web app.",
              answeredByUserId: "owner-1",
              answeredAt: project.updatedAt,
              version: 3,
            },
            questionSummary: {
              total: 2,
              answered: 2,
              unansweredBlocking: 0,
            },
          });
        }
        throw new Error(`Unexpected request: ${path}`);
      }),
    );
    window.history.replaceState({}, "", `/issues/${issue.id}`);
    const user = userEvent.setup();
    render(<IssueDetailRoute issueId={issue.id} />);

    expect(
      await screen.findByText("Questions are blocking this ticket", {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    const detailStatus = screen.getByLabelText("Change status for 1");
    expect(
      detailStatus.querySelector('option[value="ready_for_review"]'),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(secondQuestion.prompt)).toBeInTheDocument();
    expect(screen.getByLabelText("Your answer (required)")).toHaveValue(
      "Keep the current web flow.",
    );
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(
      screen.getByLabelText("Responsive HTML", { exact: false }),
    );
    await user.click(screen.getByRole("button", { name: "Save answer" }));
    expect(await screen.findByText("2 of 2 answered")).toBeInTheDocument();
    expect(
      screen.queryByText("Questions are blocking this ticket", {
        exact: false,
      }),
    ).not.toBeInTheDocument();
    expect(
      detailStatus.querySelector('option[value="ready_for_review"]'),
    ).not.toBeDisabled();

    await user.click(screen.getByLabelText("Other"));
    await user.type(
      screen.getByLabelText("Your answer (required)"),
      "Use a progressive web app.",
    );
    await user.click(screen.getByRole("button", { name: "Change answer" }));
    expect(await screen.findByText("Answer changed")).toBeInTheDocument();
    expect(answerRequest).toBe(2);
  });
});
