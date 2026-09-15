import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "./db/client.js";
import {
  type activityEvent,
  issue,
  issueQuestion,
  notification,
} from "./db/schema.js";

// Trusted server events only. No text parsing, email lookup, grants or replay job.
// Caller must be inside the same transaction as the immutable event insertion.
export async function emitDirectedNotification(
  db: Database,
  event: typeof activityEvent.$inferSelect,
) {
  if (!event.issueId) return;
  if (
    !event.changes.status &&
    event.type !== "issue.assignee_changed" &&
    event.type !== "issue.question_recipient_changed" &&
    !(
      event.type === "issue.comment_added" &&
      Array.isArray(event.changes.mentionIds) &&
      event.changes.mentionIds.length
    )
  )
    return;
  const [existing] = await db
    .select({ id: notification.id })
    .from(notification)
    .where(eq(notification.eventId, event.id))
    .limit(1);
  if (existing) return;
  const [ticket] = await db
    .select()
    .from(issue)
    .where(
      and(
        eq(issue.id, event.issueId),
        eq(issue.workspaceId, event.workspaceId),
        isNull(issue.deletedAt),
      ),
    );
  if (!ticket) return;
  const targets: Array<{
    id: string;
    kind: typeof notification.$inferSelect.kind;
    questionId?: string;
    questionVersion?: number;
  }> = [];
  if (event.type === "issue.assignee_changed") {
    await db
      .update(notification)
      .set({ obsoleteAt: new Date() })
      .where(
        and(
          eq(notification.issueId, ticket.id),
          sql`${notification.kind} in ('assignment','review')`,
          isNull(notification.obsoleteAt),
        ),
      );
    if (ticket.humanAssigneeId)
      targets.push({ id: ticket.humanAssigneeId, kind: "assignment" });
  }
  if (
    event.type === "issue.question_recipient_changed" &&
    typeof event.changes.questionId === "string"
  ) {
    await db
      .update(notification)
      .set({ obsoleteAt: new Date() })
      .where(
        and(
          eq(notification.issueId, ticket.id),
          eq(notification.questionId, event.changes.questionId),
          isNull(notification.obsoleteAt),
        ),
      );
    const [q] = await db
      .select()
      .from(issueQuestion)
      .where(
        and(
          eq(issueQuestion.id, event.changes.questionId),
          eq(issueQuestion.issueId, ticket.id),
        ),
      );
    if (q?.recipientUserId && !q.answeredAt)
      targets.push({
        id: q.recipientUserId,
        kind: "question",
        questionId: q.id,
        questionVersion: q.version,
      });
  }
  if (
    event.type === "issue.comment_added" &&
    Array.isArray(event.changes.mentionIds)
  ) {
    for (const id of new Set(event.changes.mentionIds))
      if (typeof id === "string") targets.push({ id, kind: "mention" });
  }
  const status = event.changes.status as
    | { to?: unknown; from?: unknown }
    | undefined;
  if (status && status.to !== status.from) {
    await db
      .update(notification)
      .set({ obsoleteAt: new Date() })
      .where(
        and(
          eq(notification.issueId, ticket.id),
          eq(notification.kind, "review"),
          isNull(notification.obsoleteAt),
        ),
      );
    if (status.to === "ready_for_review" && ticket.humanAssigneeId)
      targets.push({ id: ticket.humanAssigneeId, kind: "review" });
  }
  for (const target of targets) {
    if (event.actorType === "human" && event.actorId === target.id) continue;
    const edit = target.kind === "question" || target.kind === "review";
    // Canonical owner or a current grant in precisely this workspace/project.
    const eligible =
      await db.execute(sql`select 1 from workspace_membership m join workspace w on w.id = m.workspace_id
      where m.workspace_id = ${ticket.workspaceId} and m.user_id = ${target.id}
      and ((m.role = 'owner' and w.owner_id = m.user_id) or (m.role = 'member' and exists
        (select 1 from project_membership p where p.workspace_id = m.workspace_id and p.user_id = m.user_id
          and p.project_id = ${ticket.projectId} and (${!edit} or p.permission = 'edit'))))`);
    if (!eligible.length) continue;
    await db
      .insert(notification)
      .values({
        id: randomUUID(),
        workspaceId: ticket.workspaceId,
        projectId: ticket.projectId,
        issueId: ticket.id,
        eventId: event.id,
        recipientId: target.id,
        kind: target.kind,
        questionId: target.questionId,
        questionVersion: target.questionVersion,
        createdAt: event.createdAt,
      })
      .onConflictDoNothing();
  }
}
