import { createHash } from "node:crypto";

import { questionReview } from "./questions.mjs";

const statuses = new Set([
  "backlog",
  "ready",
  "in_progress",
  "ready_for_review",
  "done",
]);

function stableTickets(tickets) {
  return tickets.toSorted(
    (a, b) => a.number - b.number || a.id.localeCompare(b.id),
  );
}

function normalizePage(value) {
  const page = value?.structuredContent ?? value;
  if (!Array.isArray(page?.issues) || !page.page)
    throw new Error("Invalid list_issues page");
  return page;
}

function normalizeDetail(value) {
  const detail = value?.structuredContent ?? value;
  if (!detail?.issue) throw new Error("Invalid get_issue detail");
  return detail;
}

export async function readEpicIssueDetails({
  epicId,
  listPage,
  getIssue,
  limit = 100,
}) {
  if (
    !epicId ||
    typeof listPage !== "function" ||
    typeof getIssue !== "function"
  )
    throw new Error("Epic and MCP readers are required");
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Inventory page limit must be between 1 and 100");

  const summaries = [];
  const issueIds = new Set();
  const cursors = new Set();
  let cursor;

  do {
    const filters = { epicId, limit, ...(cursor ? { cursor } : {}) };
    const response = normalizePage(await listPage(filters));
    for (const issue of response.issues) {
      if (!issue?.id || issue.epicId !== epicId)
        throw new Error("list_issues returned an issue outside the Epic");
      if (issueIds.has(issue.id))
        throw new Error(`Duplicate issue in Epic pagination: ${issue.id}`);
      issueIds.add(issue.id);
      summaries.push(issue);
    }
    const next = response.page.nextCursor ?? null;
    if (next && cursors.has(next))
      throw new Error("Repeated nextCursor while reading Epic issues");
    if (next) cursors.add(next);
    cursor = next ?? undefined;
  } while (cursor);

  const details = [];
  for (const summary of stableTickets(summaries)) {
    const detail = normalizeDetail(await getIssue({ issueId: summary.id }));
    if (detail.issue.id !== summary.id || detail.issue.epicId !== epicId)
      throw new Error(`get_issue context changed for ${summary.id}`);
    details.push(detail);
  }
  return details;
}

function dependencyState(dependencies, issueIds) {
  const byIssue = new Map([...issueIds].map((id) => [id, []]));
  const brokenByIssue = new Map();
  for (const relation of dependencies) {
    if (!byIssue.has(relation?.issueId))
      throw new Error(
        `Dependency source is outside the Epic: ${relation?.issueId}`,
      );
    if (
      !relation.dependsOnIssueId ||
      !issueIds.has(relation.dependsOnIssueId)
    ) {
      const broken = brokenByIssue.get(relation.issueId) ?? [];
      broken.push(relation.dependsOnIssueId ?? "missing");
      brokenByIssue.set(relation.issueId, broken);
      continue;
    }
    const accepted = relation.satisfiedStatuses ?? ["done"];
    if (
      !Array.isArray(accepted) ||
      !accepted.length ||
      accepted.some((s) => !statuses.has(s))
    )
      throw new Error("Dependency requires explicit valid satisfiedStatuses");
    byIssue.get(relation.issueId).push({
      issueId: relation.issueId,
      dependsOnIssueId: relation.dependsOnIssueId,
      satisfiedStatuses: [...new Set(accepted)].sort(),
    });
  }
  for (const edges of byIssue.values())
    edges.sort((a, b) => a.dependsOnIssueId.localeCompare(b.dependsOnIssueId));

  const cyclic = new Set();
  const visiting = [];
  const visited = new Set();
  function visit(id) {
    const index = visiting.indexOf(id);
    if (index >= 0) {
      for (const member of visiting.slice(index)) cyclic.add(member);
      return;
    }
    if (visited.has(id)) return;
    visiting.push(id);
    for (const edge of byIssue.get(id) ?? []) visit(edge.dependsOnIssueId);
    visiting.pop();
    visited.add(id);
  }
  for (const id of [...issueIds].sort()) visit(id);
  return { byIssue, brokenByIssue, cyclic };
}

export function buildEpicInventory({
  scope,
  epic,
  agentId,
  details,
  dependencies = [],
}) {
  if (
    scope?.mode !== "work-epic" ||
    scope.projectId !== epic?.projectId ||
    scope.epicId !== epic?.id
  )
    throw new Error("Inventory does not match the active work-epic scope");
  if (epic.archivedAt) throw new Error("Archived Epic cannot be inventoried");
  if (!agentId || !Array.isArray(details))
    throw new Error("Agent identity and issue details are required");

  const issueIds = new Set();
  for (const detail of details) {
    const issue = detail?.issue;
    if (!issue?.id || issueIds.has(issue.id))
      throw new Error("Issue details require unique IDs");
    if (
      issue.projectId !== scope.projectId ||
      issue.epicId !== scope.epicId ||
      !Number.isInteger(issue.number) ||
      !Number.isInteger(issue.version) ||
      !statuses.has(issue.status)
    )
      throw new Error(`Invalid scoped issue detail: ${issue.id}`);
    issueIds.add(issue.id);
  }

  const dependency = dependencyState(dependencies, issueIds);
  const statusById = new Map(
    details.map(({ issue }) => [issue.id, issue.status]),
  );
  const records = stableTickets(details.map((detail) => detail.issue)).map(
    (issue) => {
      const detail = details.find(
        (candidate) => candidate.issue.id === issue.id,
      );
      const reasons = [];
      let review = null;
      if (!Array.isArray(detail.questions)) reasons.push("questions:not-read");
      else {
        review = questionReview(detail.questions);
        if (review.unansweredBlocking > 0)
          reasons.push(`questions:blocking:${review.unansweredBlocking}`);
      }
      if (issue.status !== "ready") reasons.push(`status:${issue.status}`);
      if (issue.claimedByAgentId && issue.claimedByAgentId !== agentId)
        reasons.push(`claim:foreign:${issue.claimedByAgentId}`);
      if (dependency.cyclic.has(issue.id)) reasons.push("dependency:cycle");
      for (const id of (dependency.brokenByIssue.get(issue.id) ?? []).sort())
        reasons.push(`dependency:broken:${id}`);
      for (const relation of dependency.byIssue.get(issue.id) ?? []) {
        const state = statusById.get(relation.dependsOnIssueId);
        if (!relation.satisfiedStatuses.includes(state))
          reasons.push(
            `dependency:pending:${relation.dependsOnIssueId}:${state}`,
          );
      }
      if (issue.deletedAt) reasons.push("issue:deleted");

      return {
        id: issue.id,
        number: issue.number,
        version: issue.version,
        status: issue.status,
        priority: issue.priority,
        claimedByAgentId: issue.claimedByAgentId ?? null,
        questionVersions: (review?.items ?? []).map(({ id, version }) => ({
          id,
          version,
        })),
        commentCount: Array.isArray(detail.comments)
          ? detail.comments.length
          : null,
        codeLinkCount: Array.isArray(detail.codeLinks)
          ? detail.codeLinks.length
          : null,
        dependencyIds: (dependency.byIssue.get(issue.id) ?? []).map(
          ({ dependsOnIssueId }) => dependsOnIssueId,
        ),
        eligible: reasons.length === 0,
        reasons,
      };
    },
  );

  const byStatus = Object.fromEntries(
    [...statuses].map((status) => [
      status,
      records.filter((record) => record.status === status).map(({ id }) => id),
    ]),
  );
  const snapshot = {
    schemaVersion: 1,
    projectId: scope.projectId,
    epicId: scope.epicId,
    epicVersion: epic.version,
    records,
    eligibleIds: records.filter(({ eligible }) => eligible).map(({ id }) => id),
    blockedIds: records
      .filter(({ reasons }) =>
        reasons.some(
          (reason) =>
            reason.startsWith("questions:") || reason.startsWith("dependency:"),
        ),
      )
      .map(({ id }) => id),
    foreignClaimIds: records
      .filter(({ reasons }) =>
        reasons.some((reason) => reason.startsWith("claim:foreign:")),
      )
      .map(({ id }) => id),
    byStatus,
  };
  return {
    ...snapshot,
    fingerprint: createHash("sha256")
      .update(JSON.stringify(snapshot))
      .digest("hex"),
  };
}
