import { describe, expect, it } from "vitest";
import {
  canContinueWorkEpic,
  startWorkEpic,
  workEpicFingerprint,
} from "../skills/issopen/scripts/work-epic.mjs";

const project = {
  id: "project",
  workflow: {
    completionStatus: "ready_for_review",
  },
};
const epic = {
  id: "epic",
  projectId: "project",
  number: 6,
  version: 3,
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
const input = {
  explicit: true,
  project,
  epic,
  agentContext,
  repositoryAssociation: { kind: "matched", projectId: "project" },
  skillVersion: "0.3.0",
};

describe("explicit work-epic scope", () => {
  it("creates a stable session stamp and preserves it only while context matches", () => {
    const scope = startWorkEpic(input);
    expect(scope).toMatchObject({
      mode: "work-epic",
      projectId: "project",
      epicId: "epic",
      completionStatus: "ready_for_review",
    });
    expect(workEpicFingerprint(scope)).toHaveLength(64);
    expect(canContinueWorkEpic(scope, structuredClone(scope))).toBe(true);
    expect(canContinueWorkEpic(scope, { ...scope, epicVersion: 4 })).toBe(
      false,
    );
  });

  it("stops on implicit, archived, ambiguous, unauthorized or under-scoped context", () => {
    for (const changes of [
      { explicit: false },
      { epic: { ...epic, archivedAt: "2026-09-24T00:00:00Z" } },
      { repositoryAssociation: { kind: "ambiguous", projectId: "project" } },
      { agentContext: { ...agentContext, projectIds: ["other"] } },
      {
        agentContext: {
          ...agentContext,
          scopes: agentContext.scopes.filter(
            (scope) => scope !== "issues:review",
          ),
        },
      },
    ])
      expect(() => startWorkEpic({ ...input, ...changes })).toThrow();
  });

  it("requires close scope when the project intentionally skips human review", () => {
    const direct = {
      ...project,
      workflow: { completionStatus: "done" },
    };
    expect(() => startWorkEpic({ ...input, project: direct })).toThrow(
      "issues:close",
    );
    expect(
      startWorkEpic({
        ...input,
        project: direct,
        agentContext: {
          ...agentContext,
          scopes: [...agentContext.scopes, "issues:close"],
        },
      }).completionStatus,
    ).toBe("done");
  });
});
