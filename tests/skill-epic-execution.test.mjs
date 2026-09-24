import { describe, expect, it } from "vitest";

import {
  nextExecutionAction,
  recordExecutionVerification,
  selectEpicTicket,
} from "../skills/issopen/scripts/epic-execution.mjs";

const scope = { mode: "work-epic", projectId: "project", epicId: "epic" };
const project = {
  id: "project",
  workflow: { completionStatus: "ready_for_review" },
};
const ticket = (id, number, priority = "medium") => ({
  id,
  projectId: "project",
  epicId: "epic",
  number,
  version: 1,
  status: "ready",
  priority,
  claimedByAgentId: null,
  questionSummary: { unansweredBlocking: 0 },
  questionVersions: [],
  eligible: true,
});
const inventory = {
  projectId: "project",
  epicId: "epic",
  fingerprint: "inventory-1",
  eligibleIds: ["one", "two"],
  records: [ticket("one", 2), ticket("two", 1, "urgent")],
};
const execution = selectEpicTicket({
  scope,
  project,
  inventory,
  agentId: "agent",
});
const detail = (changes = {}, extras = {}) => ({
  issue: { ...ticket("two", 1, "urgent"), ...changes },
  questions: [],
  comments: extras.comments ?? [],
  codeLinks: extras.codeLinks ?? [],
});

describe("iterative work-epic execution", () => {
  it("selects stable eligible Ready work and respects a concurrent claim", () => {
    expect(execution.issueId).toBe("two");
    expect(nextExecutionAction(execution, detail())).toMatchObject({
      tool: "claim_issue",
    });
    expect(
      nextExecutionAction(
        execution,
        detail({ claimedByAgentId: "other", version: 2 }),
      ),
    ).toEqual({ kind: "reread_inventory", reason: "claim:foreign" });
  });

  it("moves only an acknowledged own claim into progress", () => {
    const action = nextExecutionAction(
      execution,
      detail({ claimedByAgentId: "agent", version: 2 }),
    );
    expect(action).toMatchObject({
      tool: "move_issue",
      args: { status: "in_progress", expectedVersion: 2 },
    });
  });

  it("keeps a failed verification In Progress with one useful checkpoint", () => {
    const failed = recordExecutionVerification(execution, {
      passed: false,
      summary: "pnpm test failed in parser.test.ts: expected 2, received 1",
    });
    const current = detail({
      status: "in_progress",
      claimedByAgentId: "agent",
      version: 3,
    });
    const action = nextExecutionAction(failed, current);
    expect(action).toMatchObject({
      tool: "add_comment",
      args: { issueId: "two" },
    });
    expect(action.args.body).toContain("parser.test.ts");
    expect(
      nextExecutionAction(
        failed,
        detail(
          {
            status: "in_progress",
            claimedByAgentId: "agent",
            version: 3,
          },
          { comments: [{ body: action.args.body }] },
        ),
      ),
    ).toEqual({ kind: "handle_blocker", reason: "verification:failed" });
  });

  it("resumes after lost responses without duplicating evidence or transitions", () => {
    const verified = recordExecutionVerification(execution, {
      passed: true,
      summary: "18 focused tests and lint passed.",
      codeUrl: "https://github.example/commit/abc",
      codeType: "commit",
    });
    const inProgress = {
      status: "in_progress",
      claimedByAgentId: "agent",
      version: 3,
    };
    const link = nextExecutionAction(verified, detail(inProgress));
    expect(link).toMatchObject({ tool: "link_code_result" });
    const comment = nextExecutionAction(
      verified,
      detail(inProgress, {
        codeLinks: [{ type: "commit", url: verified.verification.codeUrl }],
      }),
    );
    expect(comment).toMatchObject({ tool: "add_comment" });
    const move = nextExecutionAction(
      verified,
      detail(
        { ...inProgress, version: 4 },
        {
          codeLinks: [{ type: "commit", url: verified.verification.codeUrl }],
          comments: [{ body: comment.args.body }],
        },
      ),
    );
    expect(move).toMatchObject({
      tool: "move_issue",
      args: { status: "ready_for_review", expectedVersion: 4 },
    });
    const release = nextExecutionAction(
      verified,
      detail({
        status: "ready_for_review",
        claimedByAgentId: "agent",
        version: 5,
      }),
    );
    expect(release).toMatchObject({ tool: "release_issue" });
    expect(
      nextExecutionAction(
        verified,
        detail({
          status: "ready_for_review",
          claimedByAgentId: null,
          version: 6,
        }),
      ),
    ).toEqual({ kind: "reread_inventory", reason: "ticket:delivered" });
  });

  it("uses the project workflow when human review is disabled", () => {
    const direct = selectEpicTicket({
      scope,
      project: { id: "project", workflow: { completionStatus: "done" } },
      inventory,
      agentId: "agent",
    });
    expect(direct.completionStatus).toBe("done");
  });
});
