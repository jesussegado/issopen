import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { codeLink, issue } from "../db/schema.js";
import {
  type AddCodeLinkInput,
  addCodeLinkSchema,
  type MutationContext,
  mutationContextSchema,
  type ReviewIssueInput,
  requestChangesSchema,
  reviewIssueSchema,
} from "./contracts.js";
import { DomainError } from "./errors.js";
import {
  activeIssueMutationPredicate,
  assertExpectedVersion,
  assertIssueQuestionSnapshot,
  issueMutationStamp,
  lockActiveIssue,
  recordActivity,
} from "./tracker-mutations.js";
import {
  parseTrackerInput as parseInput,
  requireHuman,
  TrackerCapability,
} from "./tracker-support.js";

export class TrackerWorkflowCapability extends TrackerCapability {
  async listCodeLinks(workspaceId: string, issueId: string) {
    return this.db
      .select()
      .from(codeLink)
      .where(
        and(
          eq(codeLink.workspaceId, workspaceId),
          eq(codeLink.issueId, issueId),
        ),
      )
      .orderBy(asc(codeLink.createdAt));
  }

  async claimIssue(
    contextInput: MutationContext,
    issueId: string,
    agentId: string,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    const normalizedAgentId = parseInput(
      z.string().trim().min(1).max(128),
      agentId,
    );

    return this.transaction(async (tx) => {
      const current = await lockActiveIssue(tx, context.workspaceId, issueId);
      if (current.claimedByAgentId === normalizedAgentId) return current;
      if (current.claimedByAgentId) {
        throw new DomainError("conflict", "Issue is already claimed");
      }

      const claimedAt = new Date();
      const [updated] = await tx
        .update(issue)
        .set({
          claimedByAgentId: normalizedAgentId,
          claimedAt,
          ...issueMutationStamp(claimedAt),
        })
        .where(
          activeIssueMutationPredicate(
            context.workspaceId,
            issueId,
            sql`${issue.claimedByAgentId} is null`,
          ),
        )
        .returning();
      if (!updated)
        throw new DomainError("conflict", "Issue is already claimed");

      await recordActivity(tx, context, {
        projectId: current.projectId,
        issueId,
        type: "issue.claimed",
        summary: `Claimed ${current.key}`,
        changes: {
          claimedByAgentId: { from: null, to: normalizedAgentId },
        },
      });
      return updated;
    });
  }

  async releaseIssue(contextInput: MutationContext, issueId: string) {
    const context = parseInput(mutationContextSchema, contextInput);

    return this.transaction(async (tx) => {
      const current = await lockActiveIssue(tx, context.workspaceId, issueId);
      if (!current.claimedByAgentId) return current;
      if (
        context.actor.type === "agent" &&
        context.actor.id !== current.claimedByAgentId
      ) {
        throw new DomainError("forbidden", "Another agent owns this claim");
      }

      const [updated] = await tx
        .update(issue)
        .set({
          claimedByAgentId: null,
          claimedAt: null,
          ...issueMutationStamp(),
        })
        .where(activeIssueMutationPredicate(context.workspaceId, issueId))
        .returning();
      if (!updated) throw new DomainError("not_found", "Issue not found");

      await recordActivity(tx, context, {
        projectId: current.projectId,
        issueId,
        type: "issue.released",
        summary: `Released ${current.key}`,
        changes: {
          claimedByAgentId: { from: current.claimedByAgentId, to: null },
        },
      });
      return updated;
    });
  }

  async addCodeLink(
    contextInput: MutationContext,
    issueId: string,
    input: AddCodeLinkInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    const values = parseInput(addCodeLinkSchema, input);

    return this.transaction(async (tx) => {
      const current = await lockActiveIssue(tx, context.workspaceId, issueId);

      const [createdLink] = await tx
        .insert(codeLink)
        .values({
          id: randomUUID(),
          workspaceId: context.workspaceId,
          issueId,
          ...values,
        })
        .returning();
      if (!createdLink) throw new Error("Code link insert returned no row");

      const [updatedIssue] = await tx
        .update(issue)
        .set(issueMutationStamp())
        .where(activeIssueMutationPredicate(context.workspaceId, issueId))
        .returning();
      if (!updatedIssue) throw new DomainError("not_found", "Issue not found");

      await recordActivity(tx, context, {
        projectId: current.projectId,
        issueId,
        type: "code_link.added",
        summary: `Linked ${values.type} result to ${current.key}`,
        changes: {
          codeLink: { id: createdLink.id, type: values.type, url: values.url },
        },
      });
      return { codeLink: createdLink, issue: updatedIssue };
    });
  }

  async acceptResult(
    contextInput: MutationContext,
    issueId: string,
    input: ReviewIssueInput = {},
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    requireHuman(context);
    return this.review(
      context,
      issueId,
      "accepted",
      undefined,
      parseInput(reviewIssueSchema, input),
    );
  }

  async requestChanges(
    contextInput: MutationContext,
    issueId: string,
    input: { reason: string } & ReviewIssueInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    requireHuman(context);
    const { reason, ...guard } = parseInput(requestChangesSchema, input);
    return this.review(context, issueId, "changes_requested", reason, guard);
  }

  private async review(
    context: MutationContext,
    issueId: string,
    outcome: "accepted" | "changes_requested",
    reason?: string,
    guard: ReviewIssueInput = {},
  ) {
    return this.transaction(async (tx) => {
      const current = await lockActiveIssue(tx, context.workspaceId, issueId);
      if (current.status !== "ready_for_review") {
        throw new DomainError(
          "conflict",
          "Only work ready for review can receive a review decision",
        );
      }

      assertExpectedVersion(
        current.version,
        guard.expectedVersion,
        "This ticket changed. Compare the latest version before reviewing.",
      );
      await assertIssueQuestionSnapshot(tx, {
        workspaceId: context.workspaceId,
        issueId,
        expected: guard.questionVersions,
        conflictMessage:
          "This ticket's questions changed. Compare the latest decisions before reviewing.",
      });

      const status = outcome === "accepted" ? "done" : "in_progress";
      const [updated] = await tx
        .update(issue)
        .set({
          status,
          ...issueMutationStamp(),
        })
        .where(
          activeIssueMutationPredicate(
            context.workspaceId,
            issueId,
            eq(issue.status, "ready_for_review"),
          ),
        )
        .returning();
      if (!updated) throw new DomainError("conflict", "Issue status changed");

      await recordActivity(tx, context, {
        projectId: current.projectId,
        issueId,
        type:
          outcome === "accepted"
            ? "review.accepted"
            : "review.changes_requested",
        summary:
          outcome === "accepted"
            ? `Accepted result for ${current.key}`
            : `Requested changes for ${current.key}: ${reason}`,
        changes: {
          status: { from: current.status, to: status },
          ...(reason ? { reason } : {}),
        },
      });
      return updated;
    });
  }
}
