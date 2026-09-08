import { describe, expect, it } from "vitest";
import {
  nextReady,
  requireOwnClaim,
} from "../skills/issopen/scripts/execution.mjs";

describe("bounded Ready selection and claim acknowledgement", () => {
  const ticket = {
    id: "a",
    projectId: "project",
    epicId: "epic",
    status: "ready",
    priority: "medium",
    number: 2,
    claimedByAgentId: null,
    questionSummary: { unansweredBlocking: 0 },
  };
  const scope = {
    projectId: "project",
    epicId: "epic",
    agentId: "agent",
    eligibleIds: new Set(["a", "b", "c"]),
  };
  it("orders reviewed candidates by priority then number, not input order", () => {
    const tickets = [
      ticket,
      { ...ticket, id: "b", number: 8, priority: "urgent" },
      { ...ticket, id: "c", number: 3, priority: "urgent" },
    ];
    expect(nextReady(tickets, scope).id).toBe("c");
    expect(nextReady(tickets.toReversed(), scope).id).toBe("c");
  });
  it("excludes foreign scope, blockers, other claims, unread plans and Backlog fallback", () => {
    for (const changes of [
      { projectId: "other" },
      { epicId: "other" },
      { status: "backlog" },
      { claimedByAgentId: "other" },
      { questionSummary: { unansweredBlocking: 1 } },
      { questionSummary: undefined },
      { id: "unreviewed" },
    ])
      expect(nextReady([{ ...ticket, ...changes }], scope)).toBeNull();
    expect(() => nextReady([ticket], { ...scope, epicId: null })).toThrow(
      "Explicit execution scope",
    );
  });
  it("requires the backend to acknowledge this identity before any code work", () => {
    expect(() => requireOwnClaim(ticket, "agent")).toThrow(
      "Claim not acknowledged",
    );
    expect(() =>
      requireOwnClaim({ ...ticket, claimedByAgentId: "other" }, "agent"),
    ).toThrow();
    expect(() =>
      requireOwnClaim({ ...ticket, claimedByAgentId: "agent" }, "agent"),
    ).not.toThrow();
  });
});
