import type { IssueDetailSnapshot } from "./issue-detail-snapshot.js";

export type IssueDetailSyncState = {
  phase: "loading" | "ready" | "missing" | "error";
  live: "idle" | "refreshing" | "failed";
  mutation:
    | { phase: "idle" }
    | { phase: "submitting"; operation: string }
    | {
        phase: "conflict" | "failed";
        operation: string;
        message: string;
      };
  error: string | null;
  pendingSnapshot: IssueDetailSnapshot | null;
};

export type IssueDetailDraftInput = {
  answer: boolean;
  assignee: boolean;
  recipient: boolean;
  comment: string;
  mentionCount: number;
  linkUrl: string;
  reviewReason: string;
  requestingChanges: boolean;
};

export type IssueDetailSyncAction =
  | { type: "load_started" }
  | { type: "load_succeeded" }
  | { type: "load_failed"; message: string }
  | { type: "access_lost" }
  | { type: "live_started" }
  | { type: "live_unchanged" }
  | { type: "live_pending"; snapshot: IssueDetailSnapshot }
  | { type: "live_applied" }
  | { type: "live_failed" }
  | { type: "live_finished" }
  | { type: "mutation_started"; operation: string }
  | {
      type: "mutation_failed";
      kind: "conflict" | "failed";
      message: string;
      display?: "global" | "panel";
    }
  | { type: "mutation_finished" }
  | { type: "clear_error" };

export const initialIssueDetailSyncState: IssueDetailSyncState = {
  phase: "loading",
  live: "idle",
  mutation: { phase: "idle" },
  error: null,
  pendingSnapshot: null,
};

export function issueDetailDraftPhase(
  draft: IssueDetailDraftInput,
): "clean" | "dirty" {
  return draft.answer ||
    draft.assignee ||
    draft.recipient ||
    draft.comment !== "" ||
    draft.mentionCount > 0 ||
    draft.linkUrl !== "" ||
    draft.reviewReason !== "" ||
    draft.requestingChanges
    ? "dirty"
    : "clean";
}

export function issueDetailSyncReducer(
  state: IssueDetailSyncState,
  action: IssueDetailSyncAction,
): IssueDetailSyncState {
  switch (action.type) {
    case "load_started":
      return initialIssueDetailSyncState;
    case "load_succeeded":
      return { ...state, phase: "ready", live: "idle", error: null };
    case "load_failed":
      return {
        ...state,
        phase: "error",
        live: "idle",
        error: action.message,
      };
    case "access_lost":
      return {
        phase: "missing",
        live: "idle",
        mutation: { phase: "idle" },
        error: null,
        pendingSnapshot: null,
      };
    case "live_started":
      return { ...state, live: "refreshing" };
    case "live_unchanged":
      return { ...state, live: "idle", pendingSnapshot: null };
    case "live_pending":
      return { ...state, live: "idle", pendingSnapshot: action.snapshot };
    case "live_applied":
      return {
        ...state,
        phase: "ready",
        live: "idle",
        error: null,
        pendingSnapshot: null,
      };
    case "live_failed":
      return { ...state, live: "failed" };
    case "live_finished":
      return state.live === "refreshing" ? { ...state, live: "idle" } : state;
    case "mutation_started":
      return {
        ...state,
        mutation: { phase: "submitting", operation: action.operation },
        error: null,
      };
    case "mutation_failed":
      return {
        ...state,
        mutation: {
          phase: action.kind,
          operation:
            state.mutation.phase === "submitting"
              ? state.mutation.operation
              : "unknown",
          message: action.message,
        },
        error: action.display === "panel" ? state.error : action.message,
      };
    case "mutation_finished":
      return state.mutation.phase === "submitting"
        ? { ...state, mutation: { phase: "idle" } }
        : state;
    case "clear_error":
      return {
        ...state,
        error: null,
        mutation:
          state.mutation.phase === "conflict" ||
          state.mutation.phase === "failed"
            ? { phase: "idle" }
            : state.mutation,
      };
  }
}
