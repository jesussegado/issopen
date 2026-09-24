import { describe, expect, it, vi } from "vitest";

import {
  buildEpicInventory,
  readEpicIssueDetails,
} from "../skills/issopen/scripts/epic-inventory.mjs";

const scope = {
  mode: "work-epic",
  projectId: "project",
  epicId: "epic",
};
const epic = {
  id: "epic",
  projectId: "project",
  version: 3,
  archivedAt: null,
};

function issue(id, number, changes = {}) {
  return {
    id,
    number,
    version: 1,
    projectId: "project",
    epicId: "epic",
    status: "ready",
    priority: "medium",
    claimedByAgentId: null,
    deletedAt: null,
    ...changes,
  };
}

function detail(value, questions = []) {
  return { issue: value, questions, comments: [], codeLinks: [] };
}

describe("work-epic inventory", () => {
  it("reads every stable page once and confirms each issue detail", async () => {
    const a = issue("a", 2);
    const b = issue("b", 1);
    const listPage = vi
      .fn()
      .mockResolvedValueOnce({ issues: [a], page: { nextCursor: "next" } })
      .mockResolvedValueOnce({ issues: [b], page: { nextCursor: null } });
    const getIssue = vi.fn(({ issueId }) =>
      Promise.resolve(detail(issueId === "a" ? a : b)),
    );

    const result = await readEpicIssueDetails({
      epicId: "epic",
      listPage,
      getIssue,
      limit: 1,
    });

    expect(listPage.mock.calls).toEqual([
      [{ epicId: "epic", limit: 1 }],
      [{ epicId: "epic", limit: 1, cursor: "next" }],
    ]);
    expect(getIssue.mock.calls).toEqual([
      [{ issueId: "b" }],
      [{ issueId: "a" }],
    ]);
    expect(result.map(({ issue: value }) => value.id)).toEqual(["b", "a"]);
  });

  it("rejects duplicate issue pages and cursor loops instead of hiding data", async () => {
    const value = issue("a", 1);
    await expect(
      readEpicIssueDetails({
        epicId: "epic",
        limit: 1,
        listPage: vi
          .fn()
          .mockResolvedValueOnce({ issues: [value], page: { nextCursor: "x" } })
          .mockResolvedValueOnce({
            issues: [value],
            page: { nextCursor: null },
          }),
        getIssue: vi.fn(),
      }),
    ).rejects.toThrow("Duplicate issue");
  });

  it("explains blockers, Other answers, foreign claims, cycles and broken links", () => {
    const other = {
      id: "q1",
      version: 2,
      blocking: true,
      answeredAt: "2026-09-24T10:00:00Z",
      answerOptionId: null,
      answerOtherText: "Use the public API",
      options: [],
    };
    const unanswered = {
      ...other,
      id: "q2",
      version: 1,
      answeredAt: null,
      answerOtherText: null,
    };
    const result = buildEpicInventory({
      scope,
      epic,
      agentId: "me",
      details: [
        detail(issue("a", 1), [other]),
        detail(issue("b", 2, { claimedByAgentId: "other" }), [unanswered]),
        detail(issue("c", 3, { status: "backlog" })),
      ],
      dependencies: [
        { issueId: "a", dependsOnIssueId: "b" },
        { issueId: "b", dependsOnIssueId: "a" },
        { issueId: "c", dependsOnIssueId: "missing" },
      ],
    });

    expect(result.eligibleIds).toEqual([]);
    expect(result.records.find(({ id }) => id === "a").reasons).toEqual([
      "dependency:cycle",
      "dependency:pending:b:ready",
    ]);
    expect(result.records.find(({ id }) => id === "b").reasons).toEqual([
      "questions:blocking:1",
      "claim:foreign:other",
      "dependency:cycle",
      "dependency:pending:a:ready",
    ]);
    expect(result.records.find(({ id }) => id === "c").reasons).toEqual([
      "status:backlog",
      "dependency:broken:missing",
    ]);
    expect(result.blockedIds).toEqual(["a", "b", "c"]);
    expect(result.foreignClaimIds).toEqual(["b"]);
  });

  it("returns a stable empty eligible queue without falling back to Backlog", () => {
    const args = {
      scope,
      epic,
      agentId: "me",
      details: [detail(issue("backlog", 1, { status: "backlog" }))],
    };
    const first = buildEpicInventory(args);
    const second = buildEpicInventory(args);
    expect(first.eligibleIds).toEqual([]);
    expect(first.byStatus.backlog).toEqual(["backlog"]);
    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it("rejects archived or cross-scope inventories", () => {
    expect(() =>
      buildEpicInventory({
        scope,
        epic: { ...epic, archivedAt: "2026-09-24T00:00:00Z" },
        agentId: "me",
        details: [],
      }),
    ).toThrow("Archived");
    expect(() =>
      buildEpicInventory({
        scope,
        epic,
        agentId: "me",
        details: [detail(issue("foreign", 1, { projectId: "other" }))],
      }),
    ).toThrow("Invalid scoped issue");
  });
});
