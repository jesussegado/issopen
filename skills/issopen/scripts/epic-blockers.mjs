import { createHash } from "node:crypto";

import { nextReady } from "./execution.mjs";

const blockerTypes = new Set([
  "decision",
  "dependency",
  "foreign_claim",
  "technical",
  "authorization",
]);

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function key(issueId, blockerKey, action) {
  return `work-epic:${hash(`${issueId}:${blockerKey}:${action}`).slice(0, 48)}`;
}

function normalize(value) {
  return value?.trim().replaceAll(/\s+/g, " ") ?? "";
}

function questionMatches(question, blocker) {
  return (
    normalize(question.prompt) === normalize(blocker.prompt) &&
    normalize(question.recommendation) === normalize(blocker.recommendation) &&
    question.blocking === true &&
    JSON.stringify(
      (question.options ?? []).map(({ label, description }) => ({
        label: normalize(label),
        description: normalize(description),
      })),
    ) ===
      JSON.stringify(
        blocker.options.map(({ label, description = "" }) => ({
          label: normalize(label),
          description: normalize(description),
        })),
      )
  );
}

function blockerComment(blocker) {
  const fingerprint = hash(
    JSON.stringify([
      blocker.type,
      blocker.key,
      blocker.diagnosis,
      blocker.recommendation,
      blocker.unblockCondition,
    ]),
  );
  const marker = `[work-epic:blocker:${fingerprint}]`;
  return {
    marker,
    body: [
      marker,
      `Bloqueo: ${blocker.diagnosis.trim()}`,
      `Recomendación: ${blocker.recommendation.trim()}`,
      `Se desbloquea cuando: ${blocker.unblockCondition.trim()}`,
    ].join("\n"),
  };
}

export function nextBlockerAction({ execution, detail, blocker }) {
  const issue = detail?.issue;
  if (
    !issue ||
    issue.id !== execution?.issueId ||
    issue.projectId !== execution.projectId ||
    issue.epicId !== execution.epicId ||
    !blockerTypes.has(blocker?.type) ||
    !blocker.key
  )
    throw new Error("Scoped execution and classified blocker are required");

  let represented = false;
  if (blocker.type === "decision") {
    if (
      !blocker.prompt?.trim() ||
      !blocker.recommendation?.trim() ||
      !Array.isArray(blocker.options) ||
      blocker.options.length < 2 ||
      blocker.options.length > 3 ||
      !Number.isInteger(blocker.recommendedOptionIndex) ||
      !blocker.options[blocker.recommendedOptionIndex]
    )
      throw new Error(
        "Decision blocker needs a recommendation and 2-3 options",
      );
    represented = (detail.questions ?? []).some((question) =>
      questionMatches(question, blocker),
    );
    if (!represented)
      return {
        kind: "call_tool",
        tool: "ask_question",
        args: {
          issueId: issue.id,
          prompt: blocker.prompt.trim(),
          recommendation: blocker.recommendation.trim(),
          options: blocker.options.map(({ label, description }) => ({
            label: label.trim(),
            ...(description?.trim() ? { description: description.trim() } : {}),
          })),
          recommendedOptionIndex: blocker.recommendedOptionIndex,
          blocking: true,
          idempotencyKey: key(issue.id, blocker.key, "question"),
        },
      };
  } else {
    if (
      !blocker.diagnosis?.trim() ||
      !blocker.recommendation?.trim() ||
      !blocker.unblockCondition?.trim()
    )
      throw new Error(
        "Non-decision blocker needs diagnosis and unblock condition",
      );
    const comment = blockerComment(blocker);
    represented = (detail.comments ?? []).some(({ body }) =>
      body.includes(comment.marker),
    );
    if (!represented)
      return {
        kind: "call_tool",
        tool: "add_comment",
        args: {
          issueId: issue.id,
          body: comment.body,
          idempotencyKey: key(issue.id, blocker.key, "comment"),
        },
      };
  }

  if (issue.claimedByAgentId === execution.agentId)
    return {
      kind: "call_tool",
      tool: "release_issue",
      args: {
        issueId: issue.id,
        idempotencyKey: key(issue.id, blocker.key, "release"),
      },
    };
  return {
    kind: "continue_independent",
    blockedIssueId: issue.id,
    reason: `blocker:${blocker.type}`,
  };
}

export function nextIndependentIssue(inventory, blockedIssueId, agentId) {
  if (!inventory?.records || !inventory?.eligibleIds)
    throw new Error("Current Epic inventory required");
  const eligibleIds = new Set(
    inventory.eligibleIds.filter((id) => id !== blockedIssueId),
  );
  return nextReady(inventory.records, {
    projectId: inventory.projectId,
    epicId: inventory.epicId,
    agentId,
    eligibleIds,
  });
}
