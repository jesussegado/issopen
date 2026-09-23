import { describe, expect, it } from "vitest";
import {
  initialIssueDetailSyncState,
  issueDetailDraftPhase,
  issueDetailSyncReducer,
} from "../../src/web/lib/issue-detail-machine.js";
import type { IssueDetailSnapshot } from "../../src/web/lib/issue-detail-snapshot.js";

const snapshot = { issue: { id: "issue" } } as IssueDetailSnapshot;

describe("issue detail sync state", () => {
  it("makes load, access and retry transitions explicit", () => {
    const failed = issueDetailSyncReducer(initialIssueDetailSyncState, {
      type: "load_failed",
      message: "Try again",
    });
    expect(failed).toMatchObject({ phase: "error", error: "Try again" });
    expect(issueDetailSyncReducer(failed, { type: "load_started" })).toEqual(
      initialIssueDetailSyncState,
    );
    expect(
      issueDetailSyncReducer(initialIssueDetailSyncState, {
        type: "access_lost",
      }),
    ).toMatchObject({ phase: "missing", pendingSnapshot: null });
  });

  it("keeps a pending snapshot separate until the user applies it", () => {
    const ready = issueDetailSyncReducer(initialIssueDetailSyncState, {
      type: "load_succeeded",
    });
    const refreshing = issueDetailSyncReducer(ready, { type: "live_started" });
    const pending = issueDetailSyncReducer(refreshing, {
      type: "live_pending",
      snapshot,
    });
    expect(pending).toMatchObject({
      phase: "ready",
      live: "idle",
      pendingSnapshot: snapshot,
    });
    expect(issueDetailSyncReducer(pending, { type: "live_applied" })).toEqual({
      phase: "ready",
      live: "idle",
      mutation: { phase: "idle" },
      error: null,
      pendingSnapshot: null,
    });
  });

  it("represents live and mutation failures without discarding pending data", () => {
    const pending = {
      ...initialIssueDetailSyncState,
      phase: "ready" as const,
      pendingSnapshot: snapshot,
    };
    const liveFailed = issueDetailSyncReducer(pending, {
      type: "live_failed",
    });
    expect(liveFailed).toMatchObject({
      live: "failed",
      pendingSnapshot: snapshot,
    });
    expect(
      issueDetailSyncReducer(liveFailed, {
        type: "mutation_failed",
        kind: "conflict",
        message: "Conflict",
      }),
    ).toMatchObject({
      error: "Conflict",
      mutation: {
        phase: "conflict",
        operation: "unknown",
        message: "Conflict",
      },
      pendingSnapshot: snapshot,
    });
  });

  it("keeps submitting and conflict transitions observable", () => {
    const submitting = issueDetailSyncReducer(initialIssueDetailSyncState, {
      type: "mutation_started",
      operation: "question",
    });
    expect(submitting.mutation).toEqual({
      phase: "submitting",
      operation: "question",
    });
    expect(
      issueDetailSyncReducer(submitting, { type: "mutation_finished" })
        .mutation,
    ).toEqual({ phase: "idle" });

    const conflict = issueDetailSyncReducer(submitting, {
      type: "mutation_failed",
      kind: "conflict",
      message: "Refresh before retrying",
    });
    expect(
      issueDetailSyncReducer(conflict, { type: "mutation_finished" }).mutation,
    ).toEqual({
      phase: "conflict",
      operation: "question",
      message: "Refresh before retrying",
    });
  });

  it("derives whether local panel drafts must protect a remote refresh", () => {
    const cleanDraft = {
      answer: false,
      assignee: false,
      recipient: false,
      comment: "",
      mentionCount: 0,
      linkUrl: "",
      reviewReason: "",
      requestingChanges: false,
    };
    expect(issueDetailDraftPhase(cleanDraft)).toBe("clean");
    expect(
      issueDetailDraftPhase({ ...cleanDraft, comment: "Do not lose this" }),
    ).toBe("dirty");
  });
});
