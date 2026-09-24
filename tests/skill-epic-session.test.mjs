import { describe, expect, it } from "vitest";

import {
  createEpicCheckpoint,
  evaluateEpicLoop,
  resumeEpicSession,
  summarizeEpicRun,
} from "../skills/issopen/scripts/epic-session.mjs";

const scope = { mode: "work-epic", projectId: "project", epicId: "epic" };
const record = (id, status, changes = {}) => ({
  id,
  status,
  claimedByAgentId: null,
  ...changes,
});
const inventory = {
  projectId: "project",
  epicId: "epic",
  epicVersion: 3,
  fingerprint: "inventory-1",
  eligibleIds: ["ready"],
  blockedIds: ["blocked"],
  records: [
    record("ready", "ready"),
    record("blocked", "backlog"),
    record("review", "ready_for_review"),
  ],
};
const gitState = { head: "abc123", worktreeFingerprint: "clean-abc123" };

describe("work-epic checkpoints, resume and stop", () => {
  it("continues until no eligible work remains, without an arbitrary ticket cap", () => {
    expect(
      evaluateEpicLoop({ scope, inventory, agentId: "agent" }),
    ).toMatchObject({
      decision: "continue",
      reason: "eligible_work_remaining",
      nextIssueIds: ["ready"],
    });
    const empty = { ...inventory, eligibleIds: [] };
    expect(
      evaluateEpicLoop({ scope, inventory: empty, agentId: "agent" }),
    ).toMatchObject({ decision: "stop", reason: "no_eligible_work" });
  });

  it("releases every own claim before any safe stop", () => {
    const claimed = {
      ...inventory,
      eligibleIds: [],
      records: [
        ...inventory.records,
        record("mine", "in_progress", { claimedByAgentId: "agent" }),
      ],
    };
    expect(
      evaluateEpicLoop({ scope, inventory: claimed, agentId: "agent" }),
    ).toMatchObject({
      decision: "release_claims_before_stop",
      reason: "no_eligible_work",
      issueIds: ["mine"],
    });
  });

  it("creates a secret-free linked summary and resumes from server/Git state", () => {
    const summary = summarizeEpicRun(inventory, {
      createdIds: ["blocked"],
      completedIds: ["review"],
    });
    const checkpoint = createEpicCheckpoint({
      scope,
      inventory,
      gitState,
      summary,
      reason: "client closed after delivery",
      nextStep: "Reread the Epic and select the next eligible Ready ticket",
      pendingOperations: [{ createdAt: 100 }],
      createdAt: 101,
    });
    expect(checkpoint).toMatchObject({
      projectId: "project",
      epicId: "epic",
      summary: { createdIds: ["blocked"], completedIds: ["review"] },
    });
    expect(checkpoint.fingerprint).toHaveLength(64);
    expect(
      resumeEpicSession({
        scope,
        checkpoint,
        inventory,
        gitState,
        now: 102,
      }),
    ).toMatchObject({ decision: "derive_from_authoritative_state" });
  });

  it("invalidates cached work after a human answer, claim or Git change", () => {
    const checkpoint = createEpicCheckpoint({
      scope,
      inventory,
      gitState,
      summary: summarizeEpicRun(inventory),
      reason: "pause",
      nextStep: "Cached suggestion only",
      createdAt: 100,
    });
    expect(
      resumeEpicSession({
        scope,
        checkpoint,
        inventory: { ...inventory, fingerprint: "answer-or-claim-changed" },
        gitState: { ...gitState, worktreeFingerprint: "dirty" },
        now: 200,
      }),
    ).toEqual({
      decision: "reconcile_required",
      reasons: ["authoritative_state_changed", "git_state_changed"],
      cachedNextStep: "Cached suggestion only",
    });
  });

  it("reconciles effects instead of replaying an operation after 24 hours", () => {
    const checkpoint = createEpicCheckpoint({
      scope,
      inventory,
      gitState,
      summary: summarizeEpicRun(inventory),
      reason: "pause",
      nextStep: "Check whether the server applied the operation",
      pendingOperations: [{ createdAt: 0 }],
      createdAt: 1,
    });
    expect(
      resumeEpicSession({
        scope,
        checkpoint,
        inventory,
        gitState,
        now: 86_400_000,
      }),
    ).toMatchObject({
      decision: "reconcile_required",
      reasons: ["operation_window_elapsed"],
    });
  });

  it("stops a non-progressing loop and reports an explicit reason", () => {
    expect(
      evaluateEpicLoop({
        scope,
        inventory,
        agentId: "agent",
        previousFingerprint: inventory.fingerprint,
        progressMade: false,
      }),
    ).toMatchObject({ decision: "stop", reason: "state_not_progressing" });
  });
});
