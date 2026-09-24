import { describe, expect, it } from "vitest";
import {
  nextExecutionAction,
  recordExecutionVerification,
  selectEpicTicket,
} from "../skills/issopen/scripts/epic-execution.mjs";
import {
  buildEpicInventory,
  readEpicIssueDetails,
} from "../skills/issopen/scripts/epic-inventory.mjs";
import { planEpicReconciliation } from "../skills/issopen/scripts/epic-planning.mjs";
import {
  createEpicCheckpoint,
  evaluateEpicLoop,
  resumeEpicSession,
  summarizeEpicRun,
} from "../skills/issopen/scripts/epic-session.mjs";
import { planSections } from "../skills/issopen/scripts/plans.mjs";
import {
  assertTicketFirstDecision,
  guardTicketFirst,
} from "../skills/issopen/scripts/ticket-first.mjs";
import { startWorkEpic } from "../skills/issopen/scripts/work-epic.mjs";

const project = {
  id: "project",
  workflow: { completionStatus: "ready_for_review" },
};
const epic = {
  id: "epic",
  projectId: "project",
  number: 6,
  version: 1,
  archivedAt: null,
};
const agentContext = {
  projectIds: ["project"],
  scopes: [
    "issues:read",
    "issues:create",
    "issues:write",
    "questions:write",
    "epics:write",
    "issues:claim",
    "comments:write",
    "code:link",
    "issues:review",
  ],
};
const plan = Object.fromEntries(
  Object.keys(planSections).map((key) => [key, `Fixture ${key}`]),
);

function issue(id, number, status = "ready") {
  return {
    id,
    projectId: "project",
    epicId: "epic",
    number,
    version: 1,
    status,
    priority: "medium",
    claimedByAgentId: null,
    deletedAt: null,
  };
}

function detail(value, extras = {}) {
  return {
    issue: value,
    questions: extras.questions ?? [],
    comments: extras.comments ?? [],
    codeLinks: extras.codeLinks ?? [],
  };
}

describe("complete controlled work-epic flow", () => {
  it("plans, gates, executes, resumes and stops without leaving its Epic", async () => {
    const scope = startWorkEpic({
      explicit: true,
      project,
      epic,
      agentContext,
      repositoryAssociation: { kind: "confirmed", projectId: "project" },
      skillVersion: "0.3.0",
    });
    const ready = issue("ready", 1);
    const blocked = issue("blocked", 2, "backlog");
    const pages = [
      { issues: [ready], page: { nextCursor: "page-2" } },
      { issues: [blocked], page: { nextCursor: null } },
    ];
    let page = 0;
    const details = await readEpicIssueDetails({
      epicId: epic.id,
      limit: 1,
      listPage: async () => pages[page++],
      getIssue: async ({ issueId }) =>
        detail(issueId === ready.id ? ready : blocked),
    });
    const inventory = buildEpicInventory({
      scope,
      epic,
      agentId: "agent",
      details,
    });
    expect(inventory.eligibleIds).toEqual(["ready"]);

    const reconciliation = planEpicReconciliation({
      scope,
      epic,
      inventory,
      existing: [
        {
          issue: { ...blocked, description: "Partial human plan" },
          intentKey: "fixture.blocked",
          coverage: "complete",
          questions: [],
        },
      ],
      desired: [
        {
          intentKey: "fixture.blocked",
          title: "Existing result",
          priority: "medium",
          plan,
        },
        {
          intentKey: "fixture.missing",
          title: "Missing result",
          priority: "medium",
          plan,
        },
      ],
    });
    expect(reconciliation.actions.map(({ kind }) => kind)).toEqual([
      "reuse",
      "create",
    ]);

    const query = guardTicketFirst({
      scope,
      requestKind: "query",
      mcpAvailable: true,
    });
    expect(query.decision).toBe("proceed_without_ticket");
    const code = guardTicketFirst({
      scope,
      requestKind: "code",
      mcpAvailable: true,
      inventory,
      trackedIssueId: ready.id,
    });
    expect(() => assertTicketFirstDecision(code)).not.toThrow();

    let execution = selectEpicTicket({
      scope,
      project,
      inventory,
      agentId: "agent",
    });
    expect(nextExecutionAction(execution, detail(ready))).toMatchObject({
      tool: "claim_issue",
    });
    const inProgress = {
      ...ready,
      status: "in_progress",
      version: 3,
      claimedByAgentId: "agent",
    };
    execution = recordExecutionVerification(execution, {
      passed: true,
      summary: "Controlled fixture passed focused tests.",
      codeUrl: "https://github.example/commit/fixture",
    });
    const link = nextExecutionAction(execution, detail(inProgress));
    const comment = nextExecutionAction(
      execution,
      detail(inProgress, {
        codeLinks: [{ type: "commit", url: link.args.url }],
      }),
    );
    const delivered = nextExecutionAction(
      execution,
      detail(
        { ...inProgress, version: 4 },
        {
          codeLinks: [{ type: "commit", url: link.args.url }],
          comments: [{ body: comment.args.body }],
        },
      ),
    );
    expect(delivered).toMatchObject({
      tool: "move_issue",
      args: { status: "ready_for_review" },
    });

    const finalInventory = {
      ...inventory,
      fingerprint: "final-inventory",
      eligibleIds: [],
      records: inventory.records.map((record) =>
        record.id === ready.id
          ? {
              ...record,
              status: "ready_for_review",
              eligible: false,
              reasons: ["status:ready_for_review"],
            }
          : record,
      ),
    };
    const summary = summarizeEpicRun(finalInventory, {
      createdIds: [blocked.id],
      completedIds: [ready.id],
    });
    const checkpoint = createEpicCheckpoint({
      scope,
      inventory: finalInventory,
      gitState: { head: "fixture", worktreeFingerprint: "clean-fixture" },
      summary,
      reason: "simulated client restart",
      nextStep: "Reread authoritative state",
      createdAt: 10,
    });
    expect(
      resumeEpicSession({
        scope,
        checkpoint,
        inventory: finalInventory,
        gitState: { head: "fixture", worktreeFingerprint: "clean-fixture" },
        now: 11,
      }),
    ).toMatchObject({ decision: "derive_from_authoritative_state" });
    expect(
      evaluateEpicLoop({
        scope,
        inventory: finalInventory,
        agentId: "agent",
        summary,
      }),
    ).toMatchObject({
      decision: "stop",
      reason: "no_eligible_work",
      summary: {
        completedIds: ["ready"],
        createdIds: ["blocked"],
      },
    });
    expect(
      finalInventory.records.every(({ epicId }) => epicId === "epic"),
    ).toBe(true);
  });
});
