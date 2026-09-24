import { describe, expect, it } from "vitest";

import {
  assertReconciliationCurrent,
  planEpicReconciliation,
} from "../skills/issopen/scripts/epic-planning.mjs";
import { planSections } from "../skills/issopen/scripts/plans.mjs";

const scope = { mode: "work-epic", projectId: "project", epicId: "epic" };
const epic = { id: "epic", projectId: "project", version: 3 };
const inventory = {
  projectId: "project",
  epicId: "epic",
  epicVersion: 3,
  fingerprint: "snapshot-a",
  records: [
    { id: "complete", version: 2 },
    { id: "partial", version: 4 },
  ],
};
const completePlan = (value) =>
  Object.fromEntries(
    Object.keys(planSections).map((key) => [key, `${value} ${key}`]),
  );
const desired = [
  {
    intentKey: "agent.onboarding",
    title: "Document agent onboarding",
    priority: "high",
    plan: completePlan("onboarding"),
    dependencyIntentKeys: [],
  },
  {
    intentKey: "agent.permissions",
    title: "Verify agent permissions",
    priority: "medium",
    plan: completePlan("permissions"),
    dependencyIntentKeys: ["agent.onboarding"],
  },
  {
    intentKey: "agent.release",
    title: "Publish the agent package",
    priority: "medium",
    plan: completePlan("release"),
    dependencyIntentKeys: ["agent.permissions"],
  },
];
const existing = [
  {
    issue: {
      id: "complete",
      version: 2,
      projectId: "project",
      epicId: "epic",
      description: "Human plan that stays intact",
    },
    intentKey: "agent.onboarding",
    coverage: "complete",
    questions: [],
  },
  {
    issue: {
      id: "partial",
      version: 4,
      projectId: "project",
      epicId: "epic",
      description: "Human partial plan that must not be deleted",
    },
    intentKey: "agent.permissions",
    coverage: "partial",
    questions: [{ id: "q1", version: 2 }],
  },
];

describe("semantic Epic plan reconciliation", () => {
  it("reuses complete work, appends partial work and creates only missing outcomes", () => {
    const result = planEpicReconciliation({
      scope,
      epic,
      inventory,
      existing,
      desired,
    });
    expect(result.actions.map(({ kind }) => kind)).toEqual([
      "reuse",
      "update",
      "create",
    ]);
    const update = result.actions[1];
    expect(update.changes.description).toContain(
      "Human partial plan that must not be deleted",
    );
    expect(update.questionVersions).toEqual([{ id: "q1", version: 2 }]);
    expect(result.actions[2]).toMatchObject({
      intentKey: "agent.release",
      expectedStatus: "backlog",
      input: { projectId: "project", epicId: "epic" },
    });
  });

  it("produces identical operations on repeated planning", () => {
    const input = { scope, epic, inventory, existing, desired };
    expect(planEpicReconciliation(input)).toEqual(
      planEpicReconciliation(input),
    );
  });

  it("treats a matching embedded intent and plan hash as already reconciled", () => {
    const standalone = { ...desired[2], dependencyIntentKeys: [] };
    const first = planEpicReconciliation({
      scope,
      epic,
      inventory: { ...inventory, records: [] },
      existing: [],
      desired: [standalone],
    });
    const created = {
      id: "created",
      version: 1,
      projectId: "project",
      epicId: "epic",
      description: first.actions[0].input.description,
    };
    const repeated = planEpicReconciliation({
      scope,
      epic,
      inventory: { ...inventory, records: [{ id: "created", version: 1 }] },
      existing: [{ issue: created, coverage: "partial", questions: [] }],
      desired: [standalone],
    });
    expect(repeated.actions).toEqual([
      {
        kind: "reuse",
        intentKey: "agent.release",
        issueId: "created",
        expectedVersion: 1,
      },
    ]);
  });

  it("stops both stale and concurrent planners until they reread", () => {
    const plan = planEpicReconciliation({
      scope,
      epic,
      inventory,
      existing,
      desired,
    });
    expect(() => assertReconciliationCurrent(plan, inventory)).not.toThrow();
    expect(() =>
      assertReconciliationCurrent(plan, {
        ...inventory,
        fingerprint: "snapshot-created-by-other-planner",
      }),
    ).toThrow("reread and reconcile");
    expect(() =>
      planEpicReconciliation({
        scope,
        epic,
        inventory: {
          ...inventory,
          records: inventory.records.map((record) =>
            record.id === "partial" ? { ...record, version: 5 } : record,
          ),
        },
        existing,
        desired,
      }),
    ).toThrow("stale");
  });

  it("rejects ambiguous intent coverage, missing dependencies and cycles", () => {
    expect(() =>
      planEpicReconciliation({
        scope,
        epic,
        inventory,
        existing: [
          existing[0],
          { ...existing[1], intentKey: "agent.onboarding" },
        ],
        desired,
      }),
    ).toThrow("multiple tickets");
    expect(() =>
      planEpicReconciliation({
        scope,
        epic,
        inventory,
        existing,
        desired: [{ ...desired[2], dependencyIntentKeys: ["missing.intent"] }],
      }),
    ).toThrow("Unknown dependency");
    expect(() =>
      planEpicReconciliation({
        scope,
        epic,
        inventory: { ...inventory, records: [] },
        existing: [],
        desired: [
          { ...desired[0], dependencyIntentKeys: ["agent.release"] },
          { ...desired[2], dependencyIntentKeys: ["agent.onboarding"] },
        ],
      }),
    ).toThrow("cycle");
  });
});
