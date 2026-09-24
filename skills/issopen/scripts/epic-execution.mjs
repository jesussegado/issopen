import { createHash } from "node:crypto";

import { nextReady } from "./execution.mjs";
import { questionReview } from "./questions.mjs";

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function operationKey(issueId, action, payload = "") {
  return `work-epic:${hash(`${issueId}:${action}:${payload}`).slice(0, 48)}`;
}

function questionVersions(detail) {
  if (!Array.isArray(detail?.questions))
    throw new Error("Authoritative issue questions are required");
  return detail.questions
    .map(({ id, version }) => ({ id, version }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function sameQuestions(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function tool(toolName, args) {
  return { kind: "call_tool", tool: toolName, args };
}

export function selectEpicTicket({ scope, project, inventory, agentId }) {
  if (
    scope?.mode !== "work-epic" ||
    project?.id !== scope.projectId ||
    inventory?.projectId !== scope.projectId ||
    inventory?.epicId !== scope.epicId ||
    !inventory?.fingerprint ||
    !agentId
  )
    throw new Error("Current project, inventory and agent scope are required");
  const completionStatus = project.workflow?.completionStatus;
  if (!new Set(["ready_for_review", "done"]).has(completionStatus))
    throw new Error("Project completion workflow is required");

  const eligibleIds = new Set(inventory.eligibleIds);
  const selected = nextReady(inventory.records, {
    projectId: scope.projectId,
    epicId: scope.epicId,
    agentId,
    eligibleIds,
  });
  if (!selected) return null;
  return {
    schemaVersion: 1,
    projectId: scope.projectId,
    epicId: scope.epicId,
    inventoryFingerprint: inventory.fingerprint,
    issueId: selected.id,
    selectedIssueVersion: selected.version,
    selectedQuestionVersions: structuredClone(selected.questionVersions),
    agentId,
    completionStatus,
    verification: null,
  };
}

export function recordExecutionVerification(execution, verification) {
  if (!execution?.issueId || execution.verification)
    throw new Error("A selected unverified execution is required");
  if (
    typeof verification?.passed !== "boolean" ||
    !verification.summary?.trim()
  )
    throw new Error("Verification result and summary are required");
  if (verification.passed) {
    try {
      const url = new URL(verification.codeUrl);
      if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error();
    } catch {
      throw new Error("Passed verification requires an HTTP(S) code result");
    }
  }
  const normalized = {
    passed: verification.passed,
    summary: verification.summary.trim(),
    codeUrl: verification.passed ? verification.codeUrl : null,
    codeType: verification.codeType ?? "commit",
  };
  if (!new Set(["commit", "branch", "pull_request"]).has(normalized.codeType))
    throw new Error("Unsupported code result type");
  const fingerprint = hash(JSON.stringify(normalized));
  const marker = `[work-epic:${normalized.passed ? "evidence" : "failure"}:${fingerprint}]`;
  return {
    ...execution,
    verification: {
      ...normalized,
      fingerprint,
      marker,
      comment: `${marker}\n${normalized.summary}`,
    },
  };
}

export function nextExecutionAction(execution, detail) {
  const issue = detail?.issue;
  if (
    !issue ||
    issue.id !== execution?.issueId ||
    issue.projectId !== execution.projectId ||
    issue.epicId !== execution.epicId
  )
    throw new Error("Issue detail does not match the selected execution");
  const currentQuestions = questionVersions(detail);
  const questionsChanged = !sameQuestions(
    execution.selectedQuestionVersions,
    currentQuestions,
  );
  const review = questionReview(detail.questions);

  if (issue.status === "ready") {
    if (questionsChanged || review.unansweredBlocking > 0)
      return { kind: "reread_inventory", reason: "questions:changed" };
    if (issue.claimedByAgentId && issue.claimedByAgentId !== execution.agentId)
      return { kind: "reread_inventory", reason: "claim:foreign" };
    if (!issue.claimedByAgentId)
      return tool("claim_issue", {
        issueId: issue.id,
        idempotencyKey: operationKey(issue.id, "claim"),
      });
    return tool("move_issue", {
      issueId: issue.id,
      status: "in_progress",
      expectedVersion: issue.version,
      questionVersions: currentQuestions,
      idempotencyKey: operationKey(
        issue.id,
        "in-progress",
        String(issue.version),
      ),
    });
  }

  if (issue.status === "in_progress") {
    if (issue.claimedByAgentId !== execution.agentId)
      return { kind: "reread_inventory", reason: "claim:not-owned" };
    if (questionsChanged || review.unansweredBlocking > 0)
      return { kind: "handle_blocker", reason: "questions:changed" };
    if (!execution.verification) return { kind: "implement_and_verify" };

    const evidence = execution.verification;
    const commentExists = (detail.comments ?? []).some(({ body }) =>
      body.includes(evidence.marker),
    );
    if (!evidence.passed) {
      if (!commentExists)
        return tool("add_comment", {
          issueId: issue.id,
          body: evidence.comment,
          idempotencyKey: operationKey(
            issue.id,
            "failure",
            evidence.fingerprint,
          ),
        });
      return { kind: "handle_blocker", reason: "verification:failed" };
    }

    const codeExists = (detail.codeLinks ?? []).some(
      ({ type, url }) => type === evidence.codeType && url === evidence.codeUrl,
    );
    if (!codeExists)
      return tool("link_code_result", {
        issueId: issue.id,
        type: evidence.codeType,
        url: evidence.codeUrl,
        idempotencyKey: operationKey(issue.id, "code", evidence.fingerprint),
      });
    if (!commentExists)
      return tool("add_comment", {
        issueId: issue.id,
        body: evidence.comment,
        idempotencyKey: operationKey(
          issue.id,
          "evidence",
          evidence.fingerprint,
        ),
      });
    return tool("move_issue", {
      issueId: issue.id,
      status: execution.completionStatus,
      expectedVersion: issue.version,
      questionVersions: currentQuestions,
      idempotencyKey: operationKey(
        issue.id,
        execution.completionStatus,
        evidence.fingerprint,
      ),
    });
  }

  if (issue.status === execution.completionStatus) {
    if (issue.claimedByAgentId === execution.agentId)
      return tool("release_issue", {
        issueId: issue.id,
        idempotencyKey: operationKey(issue.id, "release"),
      });
    if (issue.claimedByAgentId)
      return {
        kind: "reread_inventory",
        reason: "claim:changed-after-delivery",
      };
    return { kind: "reread_inventory", reason: "ticket:delivered" };
  }

  return { kind: "reread_inventory", reason: `status:${issue.status}` };
}
