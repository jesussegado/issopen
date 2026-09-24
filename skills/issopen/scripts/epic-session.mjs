import { createHash } from "node:crypto";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertScope(scope, inventory) {
  if (
    scope?.mode !== "work-epic" ||
    inventory?.projectId !== scope.projectId ||
    inventory?.epicId !== scope.epicId ||
    !inventory?.fingerprint ||
    !Array.isArray(inventory.records)
  )
    throw new Error("Current scoped Epic inventory required");
}

export function summarizeEpicRun(
  inventory,
  { createdIds = [], completedIds = [] } = {},
) {
  const ids = new Set(inventory.records.map(({ id }) => id));
  for (const id of [...createdIds, ...completedIds])
    if (!ids.has(id))
      throw new Error(`Summary issue is outside the Epic: ${id}`);
  return {
    completedIds: [...new Set(completedIds)].sort(),
    createdIds: [...new Set(createdIds)].sort(),
    blockedIds: [...new Set(inventory.blockedIds ?? [])].sort(),
    readyForReviewIds: inventory.records
      .filter(({ status }) => status === "ready_for_review")
      .map(({ id }) => id)
      .sort(),
    doneIds: inventory.records
      .filter(({ status }) => status === "done")
      .map(({ id }) => id)
      .sort(),
    pendingIds: inventory.records
      .filter(({ status }) =>
        new Set(["backlog", "ready", "in_progress"]).has(status),
      )
      .map(({ id }) => id)
      .sort(),
  };
}

export function evaluateEpicLoop({
  scope,
  inventory,
  agentId,
  mcpAvailable = true,
  authorityMissing = false,
  conflict = false,
  nonTransientError = false,
  previousFingerprint = null,
  progressMade = true,
  summary = summarizeEpicRun(inventory),
}) {
  assertScope(scope, inventory);
  if (!agentId) throw new Error("Agent identity required");
  const ownClaimIds = inventory.records
    .filter(({ claimedByAgentId }) => claimedByAgentId === agentId)
    .map(({ id }) => id)
    .sort();

  let reason = null;
  if (!mcpAvailable) reason = "mcp_unavailable";
  else if (authorityMissing) reason = "authority_missing";
  else if (conflict) reason = "state_conflict";
  else if (nonTransientError) reason = "non_transient_error";
  else if (
    previousFingerprint === inventory.fingerprint &&
    progressMade === false
  )
    reason = "state_not_progressing";
  else if (inventory.eligibleIds.length === 0) reason = "no_eligible_work";

  if (!reason)
    return {
      decision: "continue",
      reason: "eligible_work_remaining",
      nextIssueIds: [...inventory.eligibleIds],
      summary,
    };
  if (ownClaimIds.length)
    return {
      decision: "release_claims_before_stop",
      reason,
      issueIds: ownClaimIds,
      summary,
    };
  return { decision: "stop", reason, summary };
}

export function createEpicCheckpoint({
  scope,
  inventory,
  gitState,
  summary,
  reason,
  nextStep,
  activeIssueId = null,
  pendingOperations = [],
  createdAt = Date.now(),
}) {
  assertScope(scope, inventory);
  if (
    !gitState?.head ||
    !gitState.worktreeFingerprint ||
    !reason?.trim() ||
    !nextStep?.trim() ||
    !Number.isFinite(createdAt)
  )
    throw new Error(
      "Checkpoint needs Git state, reason, next step and timestamp",
    );
  if (
    activeIssueId &&
    !inventory.records.some(({ id }) => id === activeIssueId)
  )
    throw new Error("Active issue is outside the Epic");
  const operationTimes = pendingOperations.map(({ createdAt: time }) => {
    if (!Number.isFinite(time))
      throw new Error("Invalid pending operation time");
    return time;
  });
  const checkpoint = {
    schemaVersion: 1,
    mode: "work-epic",
    projectId: scope.projectId,
    epicId: scope.epicId,
    epicVersion: inventory.epicVersion,
    inventoryFingerprint: inventory.fingerprint,
    gitHead: gitState.head,
    worktreeFingerprint: gitState.worktreeFingerprint,
    activeIssueId,
    reason: reason.trim(),
    nextStep: nextStep.trim(),
    summary,
    operationTimes,
    createdAt,
  };
  const serialized = JSON.stringify(checkpoint);
  if (
    /issopen_pat_[A-Za-z0-9_-]+|authorization\s*:\s*bearer|cookie\s*:/i.test(
      serialized,
    )
  )
    throw new Error("Possible secret in work-epic checkpoint");
  return { ...checkpoint, fingerprint: hash(serialized) };
}

export function resumeEpicSession({
  scope,
  checkpoint,
  inventory,
  gitState,
  now = Date.now(),
}) {
  assertScope(scope, inventory);
  if (
    checkpoint?.mode !== "work-epic" ||
    checkpoint.projectId !== scope.projectId ||
    checkpoint.epicId !== scope.epicId
  )
    throw new Error("Checkpoint does not belong to this work-epic session");
  const reasons = [];
  if (
    checkpoint.epicVersion !== inventory.epicVersion ||
    checkpoint.inventoryFingerprint !== inventory.fingerprint
  )
    reasons.push("authoritative_state_changed");
  if (
    checkpoint.gitHead !== gitState?.head ||
    checkpoint.worktreeFingerprint !== gitState?.worktreeFingerprint
  )
    reasons.push("git_state_changed");
  if (
    checkpoint.operationTimes.some(
      (createdAt) => now - createdAt < 0 || now - createdAt >= 86_400_000,
    )
  )
    reasons.push("operation_window_elapsed");
  if (reasons.length)
    return {
      decision: "reconcile_required",
      reasons,
      cachedNextStep: checkpoint.nextStep,
    };
  return {
    decision: "derive_from_authoritative_state",
    reason: "checkpoint_context_current",
    cachedNextStep: checkpoint.nextStep,
  };
}
