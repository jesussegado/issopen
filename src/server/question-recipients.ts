import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "./db/client.js";
import {
  activityEvent,
  epic,
  issue,
  issueQuestion,
  workspace,
} from "./db/schema.js";
import { questionVersionsSchema } from "./domain/contracts.js";
import { DomainError } from "./domain/errors.js";
import { TrackerService } from "./domain/tracker.js";
import {
  type HumanAccess,
  humanMutationContext,
  requireHumanAccess,
  requireProjectEdit,
  resolveHumanAccess,
} from "./human-access.js";
import { emitDirectedNotification } from "./notification-events.js";
import { CollaboratorService } from "./profiles.js";

export const recipientSchema = z
  .object({
    recipientId: z.string().min(1).max(128).nullable(),
    expectedVersion: z.number().int().positive(),
    questionVersions: questionVersionsSchema,
  })
  .strict();

export class QuestionRecipientService {
  constructor(private readonly db: Database) {}
  async set(
    access: HumanAccess,
    issueId: string,
    questionId: string,
    input: z.infer<typeof recipientSchema>,
  ) {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.id, access.workspaceId))
        .for("share");
      const fresh = requireHumanAccess(
        await resolveHumanAccess(tx, access.user, access.workspaceId),
      );
      const tracker = new TrackerService(tx);
      const found = await tracker.getIssue(access.workspaceId, issueId);
      requireProjectEdit(fresh, found.projectId);
      const current = await tracker.updateIssue(
        humanMutationContext(fresh),
        issueId,
        {
          expectedVersion: input.expectedVersion,
          questionVersions: input.questionVersions,
          title: found.title,
        },
      );
      if (current.epicId) {
        const [container] = await tx
          .select({ archivedAt: epic.archivedAt })
          .from(epic)
          .where(
            and(
              eq(epic.id, current.epicId),
              eq(epic.workspaceId, access.workspaceId),
            ),
          )
          .for("share");
        if (container?.archivedAt)
          throw new DomainError(
            "conflict",
            "Restore this Epic before changing question recipients.",
          );
      }
      const [question] = await tx
        .select()
        .from(issueQuestion)
        .where(
          and(
            eq(issueQuestion.id, questionId),
            eq(issueQuestion.issueId, issueId),
            eq(issueQuestion.workspaceId, access.workspaceId),
          ),
        );
      if (!question) throw new DomainError("not_found", "Question not found");
      const target =
        input.recipientId === null
          ? null
          : await new CollaboratorService(tx).get(
              fresh,
              current.projectId,
              input.recipientId,
              true,
            );
      if (question.recipientUserId !== input.recipientId) {
        await tx
          .update(issueQuestion)
          .set({
            recipientUserId: target?.id ?? null,
            recipientName: target?.name ?? null,
            version: sql`${issueQuestion.version} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(issueQuestion.id, questionId));
        await tx
          .update(issue)
          .set({ version: sql`${issue.version} + 1`, updatedAt: new Date() })
          .where(eq(issue.id, issueId));
        const [event] = await tx
          .insert(activityEvent)
          .values({
            id: randomUUID(),
            workspaceId: access.workspaceId,
            projectId: current.projectId,
            issueId,
            type: "issue.question_recipient_changed",
            actorType: "human",
            actorId: fresh.user.id,
            actorDisplayName: fresh.user.name,
            source: "rest",
            summary: target
              ? `Directed a question on ${current.key} to ${target.name}`
              : `Opened a question on ${current.key} to the team`,
            changes: {
              questionId,
              recipient: {
                from: question.recipientUserId
                  ? {
                      id: question.recipientUserId,
                      name: question.recipientName,
                    }
                  : null,
                to: target,
              },
            },
          })
          .returning();
        if (event) await emitDirectedNotification(tx, event);
      }
      return tracker.getIssueDetail(
        access.workspaceId,
        issueId,
        access.user.id,
      );
    });
  }
}
