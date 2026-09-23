import { randomUUID } from "node:crypto";
import { and, eq, isNull, type SQL, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { activityEvent, issue, issueQuestion } from "../db/schema.js";
import { emitDirectedNotification } from "../notification-events.js";
import type { MutationContext } from "./contracts.js";
import { DomainError } from "./errors.js";

export type TrackerTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export type ActivityChanges = Record<string, unknown>;

type QuestionVersion = { id: string; version: number };

export function activeIssueMutationPredicate(
  workspaceId: string,
  issueId: string,
  ...guards: Array<SQL | undefined>
) {
  return and(
    isNull(issue.deletedAt),
    eq(issue.workspaceId, workspaceId),
    eq(issue.id, issueId),
    ...guards,
  );
}

export async function lockActiveIssue(
  tx: TrackerTransaction,
  workspaceId: string,
  issueId: string,
) {
  const [current] = await tx
    .select()
    .from(issue)
    .where(activeIssueMutationPredicate(workspaceId, issueId))
    .limit(1)
    .for("update");
  if (!current) throw new DomainError("not_found", "Issue not found");
  return current;
}

export function assertExpectedVersion(
  actual: number,
  expected: number | undefined,
  message: string,
) {
  if (expected !== undefined && actual !== expected) {
    throw new DomainError("conflict", message);
  }
}

export async function assertIssueQuestionSnapshot(
  tx: TrackerTransaction,
  input: {
    workspaceId: string;
    issueId: string;
    expected: QuestionVersion[] | undefined;
    conflictMessage: string;
  },
) {
  if (input.expected === undefined) return;
  const actual = await tx
    .select({ id: issueQuestion.id, version: issueQuestion.version })
    .from(issueQuestion)
    .where(
      and(
        eq(issueQuestion.workspaceId, input.workspaceId),
        eq(issueQuestion.issueId, input.issueId),
      ),
    );
  const expected = new Map(
    input.expected.map(({ id, version }) => [id, version]),
  );
  if (
    actual.length !== input.expected.length ||
    actual.some(({ id, version }) => expected.get(id) !== version)
  ) {
    throw new DomainError("conflict", input.conflictMessage);
  }
}

export function issueMutationStamp(updatedAt = new Date()) {
  return {
    version: sql<number>`${issue.version} + 1`,
    updatedAt,
  };
}

function boundedSummary(value: string): string {
  return value.length <= 500 ? value : `${value.slice(0, 497)}...`;
}

export async function recordActivity(
  tx: TrackerTransaction,
  context: MutationContext,
  values: {
    projectId: string;
    issueId?: string;
    type: string;
    summary: string;
    changes: ActivityChanges;
  },
) {
  const [event] = await tx
    .insert(activityEvent)
    .values({
      id: randomUUID(),
      workspaceId: context.workspaceId,
      projectId: values.projectId,
      issueId: values.issueId,
      type: values.type,
      actorType: context.actor.type,
      actorId: context.actor.id,
      actorDisplayName: context.actor.displayName,
      source: context.source,
      summary: boundedSummary(values.summary),
      changes: values.changes,
    })
    .returning();
  if (event) await emitDirectedNotification(tx, event);
}
