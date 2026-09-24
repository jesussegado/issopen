const mutationKinds = new Set([
  "code",
  "configuration",
  "documentation",
  "deployment",
]);
const informationKinds = new Set(["query", "explanation", "read"]);

export function guardTicketFirst({
  scope,
  requestKind,
  mcpAvailable,
  inventory,
  trackedIssueId = null,
}) {
  if (scope?.mode !== "work-epic")
    throw new Error("Ticket-first guard requires an active work-epic scope");
  if (informationKinds.has(requestKind))
    return {
      schemaVersion: 1,
      required: false,
      decision: "proceed_without_ticket",
      reason: `informational:${requestKind}`,
    };
  if (!mutationKinds.has(requestKind))
    throw new Error(`Unknown request kind: ${requestKind}`);
  if (!mcpAvailable)
    return {
      schemaVersion: 1,
      required: true,
      decision: "checkpoint_and_stop",
      reason: "mcp:unavailable",
      checkpoint: {
        projectId: scope.projectId,
        epicId: scope.epicId,
        requestKind,
        containsSecrets: false,
      },
    };
  if (
    inventory?.projectId !== scope.projectId ||
    inventory?.epicId !== scope.epicId ||
    !Array.isArray(inventory.records)
  )
    throw new Error("Current scoped inventory required before a mutation");
  if (!trackedIssueId)
    return {
      schemaVersion: 1,
      required: true,
      decision: "reconcile_ticket",
      reason: "ticket:missing",
    };

  const record = inventory.records.find(({ id }) => id === trackedIssueId);
  if (!record)
    throw new Error("Tracked ticket is outside the active Epic inventory");
  if (!record.eligible)
    return {
      schemaVersion: 1,
      required: true,
      decision: "prepare_ticket",
      issueId: trackedIssueId,
      reason: record.reasons?.[0] ?? "ticket:not-eligible",
      reasons: [...(record.reasons ?? [])],
    };
  return {
    schemaVersion: 1,
    required: true,
    decision: "proceed_with_ticket",
    issueId: trackedIssueId,
    issueVersion: record.version,
    inventoryFingerprint: inventory.fingerprint,
  };
}

export function assertTicketFirstDecision(decision) {
  if (decision?.decision !== "proceed_with_ticket")
    throw new Error(
      "Actionable changes require an eligible ticket before editing files or external state",
    );
}
