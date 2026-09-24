import { describe, expect, it } from "vitest";

import {
  nextBlockerAction,
  nextIndependentIssue,
} from "../skills/issopen/scripts/epic-blockers.mjs";

const execution = {
  issueId: "blocked",
  projectId: "project",
  epicId: "epic",
  agentId: "agent",
};
const issue = {
  id: "blocked",
  projectId: "project",
  epicId: "epic",
  status: "in_progress",
  claimedByAgentId: "agent",
};
const decision = {
  type: "decision",
  key: "storage-provider",
  prompt: "¿Dónde se deben guardar los adjuntos?",
  recommendation: "Usar el almacenamiento privado existente.",
  options: [
    { label: "Almacenamiento existente", description: "Sin servicio nuevo." },
    { label: "S3 externo", description: "Añade otro proveedor." },
  ],
  recommendedOptionIndex: 0,
};

describe("work-epic blocker handling", () => {
  it("asks one real blocking question and releases only after it exists", () => {
    const detail = { issue, questions: [], comments: [] };
    const ask = nextBlockerAction({ execution, detail, blocker: decision });
    expect(ask).toMatchObject({
      tool: "ask_question",
      args: { blocking: true, recommendedOptionIndex: 0 },
    });
    const release = nextBlockerAction({
      execution,
      detail: {
        ...detail,
        questions: [
          {
            ...ask.args,
            options: decision.options,
            blocking: true,
          },
        ],
      },
      blocker: decision,
    });
    expect(release).toMatchObject({ tool: "release_issue" });
  });

  it("deduplicates a technical checkpoint before releasing its own claim", () => {
    const blocker = {
      type: "technical",
      key: "tests-failed",
      diagnosis: "The parser regression still fails.",
      recommendation: "Fix the fixture before delivery.",
      unblockCondition: "The focused parser suite passes.",
    };
    const comment = nextBlockerAction({
      execution,
      detail: { issue, questions: [], comments: [] },
      blocker,
    });
    expect(comment).toMatchObject({ tool: "add_comment" });
    expect(comment.args.body).toContain("Se desbloquea cuando");
    const release = nextBlockerAction({
      execution,
      detail: {
        issue,
        questions: [],
        comments: [{ body: comment.args.body }],
      },
      blocker,
    });
    expect(release).toMatchObject({ tool: "release_issue" });
  });

  it("never releases a foreign claim and continues independent work", () => {
    const detail = {
      issue: { ...issue, claimedByAgentId: "other" },
      questions: [
        {
          prompt: decision.prompt,
          recommendation: decision.recommendation,
          options: decision.options,
          blocking: true,
        },
      ],
      comments: [],
    };
    expect(nextBlockerAction({ execution, detail, blocker: decision })).toEqual(
      {
        kind: "continue_independent",
        blockedIssueId: "blocked",
        reason: "blocker:decision",
      },
    );
  });

  it("selects another independent Ready ticket without selecting Backlog", () => {
    const ready = {
      id: "ready",
      projectId: "project",
      epicId: "epic",
      number: 2,
      version: 1,
      status: "ready",
      priority: "high",
      claimedByAgentId: null,
      questionSummary: { unansweredBlocking: 0 },
    };
    const backlog = { ...ready, id: "backlog", status: "backlog", number: 1 };
    const inventory = {
      projectId: "project",
      epicId: "epic",
      eligibleIds: ["blocked", "ready"],
      records: [{ ...ready, id: "blocked", number: 1 }, ready, backlog],
    };
    expect(nextIndependentIssue(inventory, "blocked", "agent").id).toBe(
      "ready",
    );
  });

  it("sees a changed answer only through the next authoritative inventory", () => {
    const before = {
      projectId: "project",
      epicId: "epic",
      eligibleIds: [],
      records: [],
    };
    const answered = {
      ...before,
      eligibleIds: ["ready"],
      records: [
        {
          id: "ready",
          projectId: "project",
          epicId: "epic",
          number: 1,
          status: "ready",
          priority: "medium",
          claimedByAgentId: null,
          questionSummary: { unansweredBlocking: 0 },
        },
      ],
    };
    expect(nextIndependentIssue(before, "blocked", "agent")).toBeNull();
    expect(nextIndependentIssue(answered, "blocked", "agent").id).toBe("ready");
  });
});
