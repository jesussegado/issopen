const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

export function nextReady(
  tickets,
  { projectId, epicId, agentId, eligibleIds },
) {
  if (!projectId || !epicId || !agentId || !(eligibleIds instanceof Set))
    throw new Error(
      "Explicit execution scope and reviewed eligibility are required",
    );
  return (
    tickets
      .filter(
        (ticket) =>
          ticket.projectId === projectId &&
          ticket.epicId === epicId &&
          ticket.status === "ready" &&
          (!ticket.claimedByAgentId || ticket.claimedByAgentId === agentId) &&
          ticket.questionSummary?.unansweredBlocking === 0 &&
          eligibleIds.has(ticket.id) &&
          Object.hasOwn(priorityOrder, ticket.priority) &&
          Number.isInteger(ticket.number) &&
          ticket.number > 0,
      )
      .sort(
        (a, b) =>
          priorityOrder[a.priority] - priorityOrder[b.priority] ||
          a.number - b.number ||
          a.id.localeCompare(b.id),
      )[0] ?? null
  );
}

export function requireOwnClaim(issue, agentId) {
  if (!agentId || issue.claimedByAgentId !== agentId)
    throw new Error(
      "Claim not acknowledged for this identity; do not edit or steal another claim",
    );
}
