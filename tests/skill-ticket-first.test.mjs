import { describe, expect, it } from "vitest";

import {
  assertTicketFirstDecision,
  guardTicketFirst,
} from "../skills/issopen/scripts/ticket-first.mjs";

const scope = { mode: "work-epic", projectId: "project", epicId: "epic" };
const inventory = {
  projectId: "project",
  epicId: "epic",
  fingerprint: "current",
  records: [
    { id: "ready", version: 3, eligible: true, reasons: [] },
    {
      id: "backlog",
      version: 1,
      eligible: false,
      reasons: ["status:backlog"],
    },
  ],
};

describe("ticket-first work-epic guard", () => {
  it.each(["code", "configuration", "documentation", "deployment"])(
    "requires an eligible ticket before a %s change",
    (requestKind) => {
      const decision = guardTicketFirst({
        scope,
        requestKind,
        mcpAvailable: true,
        inventory,
        trackedIssueId: "ready",
      });
      expect(decision).toMatchObject({
        decision: "proceed_with_ticket",
        issueId: "ready",
        issueVersion: 3,
      });
      expect(() => assertTicketFirstDecision(decision)).not.toThrow();
    },
  );

  it("routes a new change through reconciliation and reuses the same tracked ID", () => {
    const missing = guardTicketFirst({
      scope,
      requestKind: "code",
      mcpAvailable: true,
      inventory,
    });
    expect(missing).toMatchObject({
      decision: "reconcile_ticket",
      reason: "ticket:missing",
    });
    expect(() => assertTicketFirstDecision(missing)).toThrow();

    const repeated = guardTicketFirst({
      scope,
      requestKind: "code",
      mcpAvailable: true,
      inventory,
      trackedIssueId: "ready",
    });
    expect(repeated.issueId).toBe("ready");
  });

  it("does not turn queries, explanations or reads into backlog noise", () => {
    for (const requestKind of ["query", "explanation", "read"])
      expect(
        guardTicketFirst({
          scope,
          requestKind,
          mcpAvailable: true,
          inventory,
        }),
      ).toMatchObject({
        required: false,
        decision: "proceed_without_ticket",
      });
  });

  it("stops a mutation on MCP failure with a secret-free checkpoint", () => {
    const result = guardTicketFirst({
      scope,
      requestKind: "deployment",
      mcpAvailable: false,
    });
    expect(result).toMatchObject({
      decision: "checkpoint_and_stop",
      reason: "mcp:unavailable",
      checkpoint: {
        projectId: "project",
        epicId: "epic",
        containsSecrets: false,
      },
    });
    expect(() => assertTicketFirstDecision(result)).toThrow();
  });

  it("requires a created Backlog ticket to be prepared before implementation", () => {
    const result = guardTicketFirst({
      scope,
      requestKind: "documentation",
      mcpAvailable: true,
      inventory,
      trackedIssueId: "backlog",
    });
    expect(result).toMatchObject({
      decision: "prepare_ticket",
      issueId: "backlog",
      reason: "status:backlog",
    });
    expect(() => assertTicketFirstDecision(result)).toThrow();
  });
});
