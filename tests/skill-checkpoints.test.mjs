import { describe, expect, it } from "vitest";
import {
  recentFirst,
  renderCheckpoint,
} from "../skills/issopen/scripts/checkpoints.mjs";
import {
  prepareOperation,
  runOperation,
} from "../skills/issopen/scripts/operations.mjs";

describe("milestone checkpoints", () => {
  const input = {
    milestone: "pause",
    scope: "One agreed ticket",
    detail: {
      issue: {
        id: "ticket",
        projectId: "project",
        epicId: null,
        version: 3,
        status: "in_progress",
        claimedByAgentId: "agent",
      },
      questions: [],
    },
    completed: "Implemented local draft",
    verification: "Unit tests passed; native editor not checked",
    pending: "Human decision",
    nextStep: "Read the saved answer when asked to resume",
  };
  it("preserves the actual boundary and context needed by a fresh session", () => {
    const body = renderCheckpoint(input);
    expect(body).toContain(input.verification);
    expect(body).toContain(input.pending);
    expect(body).toContain(input.nextStep);
    expect(body).toContain('"issueVersion":3');
    expect(body).toContain("sin URL de código publicada");
  });
  it("does not duplicate a milestone after a lost response", async () => {
    const body = renderCheckpoint(input);
    const operation = prepareOperation("add_comment", {
      issueId: "ticket",
      body,
    });
    const comments = new Map();
    await runOperation(
      async (_tool, args) => {
        if (comments.has(args.idempotencyKey))
          return comments.get(args.idempotencyKey);
        comments.set(args.idempotencyKey, args.body);
        throw Object.assign(new Error("Lost response"), { status: 503 });
      },
      operation,
      { sleep: async () => {} },
    );
    expect([...comments.values()]).toEqual([body]);
  });
  it("rejects secret-shaped output and keeps chronological API data untouched", () => {
    expect(() =>
      renderCheckpoint({
        ...input,
        completed: `issopen_pat_${"a".repeat(43)}`,
      }),
    ).toThrow("Possible secret");
    const events = [
      { id: "old", createdAt: "2026-09-08T00:00:00Z" },
      { id: "new", createdAt: "2026-09-09T00:00:00Z" },
    ];
    expect(recentFirst(events).map((event) => event.id)).toEqual([
      "new",
      "old",
    ]);
    expect(events[0].id).toBe("old");
  });
});
