import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { publicComment } from "./comment-projection.js";
import type { Database } from "./db/client.js";
import {
  activityEvent,
  epic,
  issue,
  issueComment,
  issueQuestion,
  notification,
  workspace,
} from "./db/schema.js";
import { addIssueCommentSchema } from "./domain/contracts.js";
import { DomainError } from "./domain/errors.js";
import {
  type HumanAccess,
  requireHumanAccess,
  requireProjectEdit,
  resolveHumanAccess,
} from "./human-access.js";
import { emitDirectedNotification } from "./notification-events.js";
import { CollaboratorService } from "./profiles.js";

export const inboxQuerySchema = z
  .object({
    status: z.enum(["all", "unread"]).default("all"),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(1024).optional(),
  })
  .strict();
export const notificationReadSchema = z.object({ read: z.boolean() }).strict();
export const webCommentSchema = addIssueCommentSchema
  .extend({
    mentionIds: z.array(z.string().min(1).max(128)).max(8).default([]),
    clientRequestId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (v) => v.mentionIds.length === 0 || v.clientRequestId,
    "Mentioned comments require a retry identifier",
  );
const cursorSchema = z
  .object({
    workspace: z.string(),
    recipient: z.string(),
    status: z.enum(["all", "unread"]),
    at: z.iso.datetime(),
    id: z.uuid(),
  })
  .strict();

// Fully qualified correlation: a grant in another project/workspace never qualifies.
function visible(access: HumanAccess) {
  return and(
    eq(notification.workspaceId, access.workspaceId),
    eq(notification.recipientId, access.user.id),
    sql`exists (select 1 from issue i left join epic e on e.id = i.epic_id
      join workspace_membership m on m.workspace_id = i.workspace_id and m.user_id = ${access.user.id}
      join workspace w on w.id = i.workspace_id
      where i.id = "notification"."issue_id" and i.workspace_id = "notification"."workspace_id"
      and i.project_id = "notification"."project_id" and i.deleted_at is null and e.archived_at is null
      and ((m.role = 'owner' and w.owner_id = m.user_id) or (m.role = 'member' and exists
        (select 1 from project_membership p where p.workspace_id = i.workspace_id and p.project_id = i.project_id and p.user_id = m.user_id))))`,
  );
}
const actionable = sql<boolean>`"notification"."obsolete_at" is null and "issue"."status" <> 'done' and case
  when "notification"."kind" = 'question' then "issue_question"."recipient_user_id" = "notification"."recipient_id"
    and "issue_question"."answered_at" is null and "issue_question"."version" = "notification"."question_version"
    and exists (select 1 from workspace_membership m join workspace w on w.id = m.workspace_id
      where m.workspace_id = "notification"."workspace_id" and m.user_id = "notification"."recipient_id"
      and ((m.role = 'owner' and w.owner_id = m.user_id) or exists (select 1 from project_membership p
        where p.workspace_id = m.workspace_id and p.project_id = "notification"."project_id" and p.user_id = m.user_id and p.permission = 'edit')))
  when "notification"."kind" = 'assignment' then "issue"."human_assignee_id" = "notification"."recipient_id"
  when "notification"."kind" = 'review' then "issue"."human_assignee_id" = "notification"."recipient_id" and "issue"."status" = 'ready_for_review'
    and exists (select 1 from workspace_membership m join workspace w on w.id = m.workspace_id
      where m.workspace_id = "notification"."workspace_id" and m.user_id = "notification"."recipient_id"
      and ((m.role = 'owner' and w.owner_id = m.user_id) or exists (select 1 from project_membership p
        where p.workspace_id = m.workspace_id and p.project_id = "notification"."project_id" and p.user_id = m.user_id and p.permission = 'edit')))
  else true end`;

export class NotificationService {
  constructor(private readonly db: Database) {}
  private async withAccess<T>(
    access: HumanAccess,
    work: (db: Database, fresh: HumanAccess) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.id, access.workspaceId))
        .for("share");
      const fresh = requireHumanAccess(
        await resolveHumanAccess(tx, access.user, access.workspaceId),
      );
      return work(tx, fresh);
    });
  }
  async list(access: HumanAccess, input: z.infer<typeof inboxQuerySchema>) {
    let after: z.infer<typeof cursorSchema> | undefined;
    if (input.cursor) {
      try {
        after = cursorSchema.parse(
          JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")),
        );
        if (
          after.workspace !== access.workspaceId ||
          after.recipient !== access.user.id ||
          after.status !== input.status
        )
          throw Error("context");
      } catch {
        throw new DomainError(
          "invalid",
          "Invalid notification cursor. Refresh this inbox.",
        );
      }
    }
    return this.withAccess(access, async (db, fresh) => {
      const [unread] = await db
        .select({ value: count() })
        .from(notification)
        .where(and(visible(fresh), isNull(notification.readAt)));
      const rows = await db
        .select({
          id: notification.id,
          kind: notification.kind,
          issueId: notification.issueId,
          number: issue.number,
          title: issue.title,
          actorName: activityEvent.actorDisplayName,
          questionId: notification.questionId,
          createdAt: notification.createdAt,
          readAt: notification.readAt,
          actionable,
        })
        .from(notification)
        .innerJoin(issue, eq(issue.id, notification.issueId))
        .innerJoin(activityEvent, eq(activityEvent.id, notification.eventId))
        .leftJoin(issueQuestion, eq(issueQuestion.id, notification.questionId))
        .where(
          and(
            visible(fresh),
            input.status === "unread" ? isNull(notification.readAt) : undefined,
            after
              ? or(
                  lt(notification.createdAt, new Date(after.at)),
                  and(
                    eq(notification.createdAt, new Date(after.at)),
                    lt(notification.id, after.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(notification.createdAt), desc(notification.id))
        .limit(input.limit + 1);
      const page = rows.slice(0, input.limit),
        last = page.at(-1);
      return {
        notifications: page.map((row) => ({
          ...row,
          actionable: row.actionable === true,
        })),
        unread: unread?.value ?? 0,
        nextCursor:
          rows.length > input.limit && last
            ? Buffer.from(
                JSON.stringify({
                  workspace: fresh.workspaceId,
                  recipient: fresh.user.id,
                  status: input.status,
                  at: last.createdAt.toISOString(),
                  id: last.id,
                }),
              ).toString("base64url")
            : null,
      };
    });
  }
  async mark(access: HumanAccess, id: string, read: boolean) {
    return this.withAccess(access, async (db, fresh) => {
      const [changed] = await db
        .update(notification)
        .set({
          readAt: read ? sql`coalesce(${notification.readAt}, now())` : null,
        })
        .where(and(visible(fresh), eq(notification.id, id)))
        .returning({ id: notification.id, readAt: notification.readAt });
      if (!changed)
        throw new DomainError("not_found", "Notification not found");
      return changed;
    });
  }
  async comment(
    access: HumanAccess,
    issueId: string,
    input: z.infer<typeof webCommentSchema>,
  ) {
    return this.withAccess(access, async (db, fresh) => {
      const [ticket] = await db
        .select()
        .from(issue)
        .where(
          and(
            eq(issue.workspaceId, fresh.workspaceId),
            eq(issue.id, issueId),
            isNull(issue.deletedAt),
          ),
        )
        .for("update");
      if (!ticket) throw new DomainError("not_found", "Issue not found");
      requireProjectEdit(fresh, ticket.projectId);
      const ids = [...new Set(input.mentionIds)].sort();
      const hash = createHash("sha256")
        .update(JSON.stringify({ body: input.body, ids }))
        .digest("hex");
      if (input.clientRequestId) {
        const [previous] = await db
          .select()
          .from(issueComment)
          .where(
            and(
              eq(issueComment.issueId, issueId),
              eq(issueComment.workspaceId, fresh.workspaceId),
              eq(issueComment.authorId, fresh.user.id),
              eq(issueComment.webRequestId, input.clientRequestId),
            ),
          );
        if (previous) {
          if (previous.webRequestHash !== hash)
            throw new DomainError(
              "conflict",
              "This retry identifier was already used for another comment. Refresh before sending new content.",
            );
          return publicComment(previous);
        }
      }
      if (ticket.epicId) {
        const [container] = await db
          .select()
          .from(epic)
          .where(eq(epic.id, ticket.epicId))
          .for("share");
        if (container?.archivedAt)
          throw new DomainError(
            "conflict",
            "Restore this Epic before adding a comment.",
          );
      }
      const mentions: Array<{ id: string; name: string }> = [];
      for (const id of ids) {
        const person = await new CollaboratorService(db).get(
          fresh,
          ticket.projectId,
          id,
        );
        mentions.push({ id: person.id, name: person.name });
      }
      const [comment] = await db
        .insert(issueComment)
        .values({
          id: randomUUID(),
          workspaceId: fresh.workspaceId,
          issueId,
          body: input.body,
          authorType: "human",
          authorId: fresh.user.id,
          authorDisplayName: fresh.user.name,
          source: "rest",
          mentions,
          webRequestId: input.clientRequestId,
          webRequestHash: input.clientRequestId ? hash : null,
        })
        .returning();
      if (!comment) throw Error("Comment insert returned no row");
      const [event] = await db
        .insert(activityEvent)
        .values({
          id: randomUUID(),
          workspaceId: fresh.workspaceId,
          projectId: ticket.projectId,
          issueId,
          actorType: "human",
          actorId: fresh.user.id,
          actorDisplayName: fresh.user.name,
          source: "rest",
          type: "issue.comment_added",
          summary: `Commented on ${ticket.key}`,
          changes: { commentId: comment.id, mentionIds: ids },
        })
        .returning();
      if (event) await emitDirectedNotification(db, event);
      return publicComment(comment);
    });
  }
}
