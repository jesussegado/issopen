import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "./db/client.js";
import { activityEvent, epic, issue, workspace } from "./db/schema.js";
import { questionVersionsSchema } from "./domain/contracts.js";
import { DomainError, TrackerService } from "./domain/index.js";
import {
  type HumanAccess,
  humanMutationContext,
  requireHumanAccess,
  requireProjectEdit,
  resolveHumanAccess,
} from "./human-access.js";
import { CollaboratorService } from "./profiles.js";

export const assignmentSchema = z
  .object({
    assigneeId: z.string().min(1).max(128).nullable(),
    expectedVersion: z.number().int().positive(),
    questionVersions: questionVersionsSchema,
  })
  .strict();

// Web human sessions only. Old MCP/Chrome PATCH contracts deliberately remain strict.
export class AssignmentService {
  constructor(private readonly db: Database) {}
  async assign(
    access: HumanAccess,
    issueId: string,
    input: z.infer<typeof assignmentSchema>,
  ) {
    return this.db.transaction(async (tx) => {
      // Same workspace boundary as member-grant changes; serialize eligibility/revocation.
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
      // Reuse the full issue/question CAS and row lock without making a content change.
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
              eq(epic.workspaceId, access.workspaceId),
              eq(epic.id, current.epicId),
            ),
          )
          .for("share");
        if (container?.archivedAt)
          throw new DomainError(
            "conflict",
            "Restore this Epic before changing its ticket assignments.",
          );
      }
      const target =
        input.assigneeId === null
          ? null
          : await new CollaboratorService(tx).get(
              fresh,
              current.projectId,
              input.assigneeId,
            );
      if (current.humanAssigneeId === input.assigneeId)
        return tracker.getIssue(access.workspaceId, issueId);
      await tx
        .update(issue)
        .set({
          humanAssigneeId: target?.id ?? null,
          humanAssigneeName: target?.name ?? null,
          version: sql`${issue.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(issue.id, issueId));
      await tx.insert(activityEvent).values({
        id: randomUUID(),
        workspaceId: access.workspaceId,
        projectId: current.projectId,
        issueId,
        actorType: "human",
        actorId: fresh.user.id,
        actorDisplayName: fresh.user.name,
        source: "rest",
        type: "issue.assignee_changed",
        summary: target
          ? `Assigned ${current.key} to ${target.name}`
          : `Unassigned ${current.key}`,
        changes: {
          humanAssignee: {
            from: current.humanAssigneeId
              ? { id: current.humanAssigneeId, name: current.humanAssigneeName }
              : null,
            to: target,
          },
        },
      });
      return tracker.getIssue(access.workspaceId, issueId);
    });
  }
}
