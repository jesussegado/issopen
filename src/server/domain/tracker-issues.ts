import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNotNull,
  isNull,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { assigneeColumns, assigneePredicate } from "../assignee-projection.js";
import {
  epic,
  issue,
  issueQuestion,
  project,
  workspace,
} from "../db/schema.js";
import {
  type CreateIssueInput,
  createIssueSchema,
  type DeleteIssueInput,
  deleteIssueSchema,
  type MutationContext,
  mutationContextSchema,
  type UpdateIssueInput,
  updateIssueSchema,
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
  changedFields,
  parseTrackerInput as parseInput,
  requireHuman,
  TrackerCapability,
} from "./tracker-support.js";

export type IssuePageCursor = {
  projectId: string;
  number: number;
  id: string;
};

export type IssueClaimFilter = "any" | "claimed" | "unclaimed" | "mine";

export class TrackerIssueCapability extends TrackerCapability {
  async createIssue(contextInput: MutationContext, input: CreateIssueInput) {
    const context = parseInput(mutationContextSchema, contextInput);
    const values = parseInput(createIssueSchema, input);

    return this.transaction(async (tx) => {
      const [owner] = await tx
        .select({ ownerId: workspace.ownerId })
        .from(workspace)
        .where(eq(workspace.id, context.workspaceId))
        .limit(1);
      if (!owner) throw new DomainError("not_found", "Workspace not found");

      const [numberedProject] = await tx
        .update(project)
        .set({ nextIssueNumber: sql`${project.nextIssueNumber} + 1` })
        .where(
          and(
            eq(project.workspaceId, context.workspaceId),
            eq(project.id, values.projectId),
          ),
        )
        .returning({
          id: project.id,
          key: project.key,
          number: sql<number>`${project.nextIssueNumber} - 1`,
        });
      if (!numberedProject) {
        throw new DomainError("not_found", "Project not found");
      }

      if (values.epicId) {
        const [foundEpic] = await tx
          .select({ id: epic.id, archivedAt: epic.archivedAt })
          .from(epic)
          .where(
            and(
              eq(epic.workspaceId, context.workspaceId),
              eq(epic.projectId, numberedProject.id),
              eq(epic.id, values.epicId),
            ),
          )
          .limit(1)
          .for("share");
        if (!foundEpic) throw new DomainError("not_found", "Epic not found");
        if (foundEpic.archivedAt)
          throw new DomainError(
            "conflict",
            "Archived Epics cannot accept new tickets",
          );
      }

      const [created] = await tx
        .insert(issue)
        .values({
          id: randomUUID(),
          workspaceId: context.workspaceId,
          projectId: numberedProject.id,
          epicId: values.epicId ?? null,
          number: numberedProject.number,
          key: `${numberedProject.key}-${numberedProject.number}`,
          title: values.title,
          description: values.description,
          priority: values.priority,
          status: values.status,
          humanOwnerId: owner.ownerId,
        })
        .returning();
      if (!created) throw new Error("Issue insert returned no row");

      await recordActivity(tx, context, {
        projectId: created.projectId,
        issueId: created.id,
        type: "issue.created",
        summary: `Created ${created.key}`,
        changes: {
          key: { from: null, to: created.key },
          title: { from: null, to: created.title },
          priority: { from: null, to: created.priority },
          status: { from: null, to: created.status },
          epicId: { from: null, to: created.epicId },
        },
      });
      return created;
    });
  }

  async listIssues(
    workspaceId: string,
    projectId?: string,
    epicId?: string | null,
    includeArchivedEpicIssues = false,
    assignee?: string,
    viewerId?: string,
    questionsFor?: string,
  ) {
    const predicate = and(
      isNull(issue.deletedAt),
      eq(issue.workspaceId, workspaceId),
      projectId ? eq(issue.projectId, projectId) : undefined,
      assigneePredicate(assignee),
      questionsFor
        ? sql`exists (select 1 from issue_question q where q.issue_id = ${issue.id} and q.workspace_id = ${issue.workspaceId} and q.recipient_user_id = ${questionsFor} and q.answered_at is null)`
        : undefined,
      epicId === null
        ? isNull(issue.epicId)
        : epicId
          ? eq(issue.epicId, epicId)
          : undefined,
      includeArchivedEpicIssues
        ? undefined
        : notExists(
            this.db
              .select({ id: epic.id })
              .from(epic)
              .where(
                and(
                  eq(epic.workspaceId, workspaceId),
                  eq(epic.id, issue.epicId),
                  isNotNull(epic.archivedAt),
                ),
              ),
          ),
    );
    const issues = await this.db
      .select({ ...getTableColumns(issue), ...assigneeColumns })
      .from(issue)
      .where(predicate)
      .orderBy(asc(issue.projectId), asc(issue.number));
    if (issues.length === 0) return [];

    const counts = await this.db
      .select({
        issueId: issueQuestion.issueId,
        total: sql<number>`count(*)::int`,
        answered: sql<number>`count(${issueQuestion.answeredAt})::int`,
        unansweredBlocking: sql<number>`count(*) filter (where ${issueQuestion.blocking} and ${issueQuestion.answeredAt} is null)::int`,
        directedUnanswered: sql<number>`count(*) filter (where ${issueQuestion.recipientUserId} = ${viewerId ?? null} and ${issueQuestion.answeredAt} is null)::int`,
      })
      .from(issueQuestion)
      .where(
        and(
          eq(issueQuestion.workspaceId, workspaceId),
          inArray(
            issueQuestion.issueId,
            issues.map((item) => item.id),
          ),
        ),
      )
      .groupBy(issueQuestion.issueId);
    const byIssue = new Map(
      counts.map(({ issueId, ...summary }) => [issueId, summary]),
    );
    return issues.map((item) => ({
      ...item,
      questionSummary: byIssue.get(item.id) ?? {
        total: 0,
        answered: 0,
        unansweredBlocking: 0,
        directedUnanswered: 0,
      },
    }));
  }

  async listIssuePage(
    workspaceId: string,
    options: {
      projectIds: string[];
      projectId?: string;
      epicId?: string;
      status?: (typeof issue.$inferSelect)["status"];
      priority?: (typeof issue.$inferSelect)["priority"];
      claim: IssueClaimFilter;
      agentId: string;
      assignee?: string;
      limit: number;
      after?: IssuePageCursor;
    },
  ) {
    if (options.projectIds.length === 0) {
      return { items: [], hasMore: false };
    }
    const after = options.after;
    const claimPredicate =
      options.claim === "claimed"
        ? isNotNull(issue.claimedByAgentId)
        : options.claim === "unclaimed"
          ? isNull(issue.claimedByAgentId)
          : options.claim === "mine"
            ? eq(issue.claimedByAgentId, options.agentId)
            : undefined;
    const rows = await this.db
      .select({
        id: issue.id,
        projectId: issue.projectId,
        epicId: issue.epicId,
        number: issue.number,
        key: issue.key,
        title: issue.title,
        priority: issue.priority,
        status: issue.status,
        claimedByAgentId: issue.claimedByAgentId,
        claimedAt: issue.claimedAt,
        ...assigneeColumns,
        version: issue.version,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      })
      .from(issue)
      .where(
        and(
          isNull(issue.deletedAt),
          eq(issue.workspaceId, workspaceId),
          inArray(issue.projectId, options.projectIds),
          options.projectId
            ? eq(issue.projectId, options.projectId)
            : undefined,
          options.epicId ? eq(issue.epicId, options.epicId) : undefined,
          options.status ? eq(issue.status, options.status) : undefined,
          options.priority ? eq(issue.priority, options.priority) : undefined,
          claimPredicate,
          assigneePredicate(options.assignee),
          notExists(
            this.db
              .select({ id: epic.id })
              .from(epic)
              .where(
                and(
                  eq(epic.workspaceId, workspaceId),
                  eq(epic.id, issue.epicId),
                  isNotNull(epic.archivedAt),
                ),
              ),
          ),
          after
            ? or(
                gt(issue.projectId, after.projectId),
                and(
                  eq(issue.projectId, after.projectId),
                  gt(issue.number, after.number),
                ),
                and(
                  eq(issue.projectId, after.projectId),
                  eq(issue.number, after.number),
                  gt(issue.id, after.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(issue.projectId), asc(issue.number), asc(issue.id))
      .limit(options.limit + 1);
    const pageItems = rows.slice(0, options.limit);
    if (pageItems.length === 0) {
      return { items: [], hasMore: false };
    }
    const counts = await this.db
      .select({
        issueId: issueQuestion.issueId,
        total: sql<number>`count(*)::int`,
        answered: sql<number>`count(${issueQuestion.answeredAt})::int`,
        unansweredBlocking: sql<number>`count(*) filter (where ${issueQuestion.blocking} and ${issueQuestion.answeredAt} is null)::int`,
      })
      .from(issueQuestion)
      .where(
        and(
          eq(issueQuestion.workspaceId, workspaceId),
          inArray(
            issueQuestion.issueId,
            pageItems.map((item) => item.id),
          ),
        ),
      )
      .groupBy(issueQuestion.issueId);
    const byIssue = new Map(
      counts.map(({ issueId, ...summary }) => [issueId, summary]),
    );
    return {
      items: pageItems.map((item) => ({
        ...item,
        questionSummary: byIssue.get(item.id) ?? {
          total: 0,
          answered: 0,
          unansweredBlocking: 0,
        },
      })),
      hasMore: rows.length > options.limit,
    };
  }

  async getIssue(workspaceId: string, issueId: string) {
    const [found] = await this.db
      .select({ ...getTableColumns(issue), ...assigneeColumns })
      .from(issue)
      .where(
        and(
          isNull(issue.deletedAt),
          eq(issue.workspaceId, workspaceId),
          eq(issue.id, issueId),
        ),
      )
      .limit(1);
    if (!found) throw new DomainError("not_found", "Issue not found");
    return found;
  }

  async updateIssue(
    contextInput: MutationContext,
    issueId: string,
    input: UpdateIssueInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    const { expectedVersion, questionVersions, ...values } = parseInput(
      updateIssueSchema,
      input,
    );

    if (
      context.actor.type === "agent" &&
      values.status === "done" &&
      context.authorization?.canCloseIssues !== true
    ) {
      throw new DomainError(
        "forbidden",
        "Closing issues requires explicit permission",
      );
    }

    return this.transaction(async (tx) => {
      const current = await lockActiveIssue(tx, context.workspaceId, issueId);
      assertExpectedVersion(
        current.version,
        expectedVersion,
        "This issue changed. Your draft is preserved; read the latest version before merging and retrying.",
      );
      await assertIssueQuestionSnapshot(tx, {
        workspaceId: context.workspaceId,
        issueId,
        expected: questionVersions,
        conflictMessage:
          "Questions or answers changed. Your draft is preserved; read the current answers before merging and retrying.",
      });

      if (values.epicId && values.epicId !== current.epicId) {
        const [foundEpic] = await tx
          .select({ id: epic.id, archivedAt: epic.archivedAt })
          .from(epic)
          .where(
            and(
              eq(epic.workspaceId, context.workspaceId),
              eq(epic.projectId, current.projectId),
              eq(epic.id, values.epicId),
            ),
          )
          .limit(1)
          .for("share");
        if (!foundEpic) throw new DomainError("not_found", "Epic not found");
        if (foundEpic.archivedAt)
          throw new DomainError(
            "conflict",
            "Archived Epics cannot accept new tickets",
          );
      }

      if (
        values.status === "ready_for_review" &&
        current.status !== "ready_for_review"
      ) {
        const [currentProject] = await tx
          .select({ showReviewColumn: project.showReviewColumn })
          .from(project)
          .where(
            and(
              eq(project.workspaceId, context.workspaceId),
              eq(project.id, current.projectId),
            ),
          )
          .limit(1)
          .for("share");
        if (!currentProject)
          throw new DomainError("not_found", "Project not found");
        if (!currentProject.showReviewColumn) {
          throw new DomainError(
            "conflict",
            "This project skips Ready for Human Review. Move the issue directly to Done.",
          );
        }
        const [unansweredBlockingQuestion] = await tx
          .select({ id: issueQuestion.id })
          .from(issueQuestion)
          .where(
            and(
              eq(issueQuestion.workspaceId, context.workspaceId),
              eq(issueQuestion.issueId, issueId),
              eq(issueQuestion.blocking, true),
              isNull(issueQuestion.answeredAt),
            ),
          )
          .limit(1);
        if (unansweredBlockingQuestion) {
          throw new DomainError(
            "conflict",
            "Answer all blocking questions before moving this issue to Ready for Human Review",
          );
        }
      }

      const changes = changedFields(current, values);
      if (Object.keys(changes).length === 0) return current;

      const [updated] = await tx
        .update(issue)
        .set({
          ...values,
          ...issueMutationStamp(),
        })
        .where(
          activeIssueMutationPredicate(
            context.workspaceId,
            issueId,
            eq(issue.version, expectedVersion ?? current.version),
          ),
        )
        .returning();
      if (!updated)
        throw new DomainError(
          "conflict",
          "Issue changed; read it again before retrying",
        );

      await recordActivity(tx, context, {
        projectId: current.projectId,
        issueId,
        type: values.status ? "issue.status_changed" : "issue.updated",
        summary: values.status
          ? `Moved ${current.key} to ${values.status}`
          : `Updated ${current.key}`,
        changes,
      });
      return updated;
    });
  }

  async deleteIssue(
    contextInput: MutationContext,
    issueId: string,
    input: DeleteIssueInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    requireHuman(context);
    if (context.source !== "rest")
      throw new DomainError(
        "forbidden",
        "Deletion is only available on the web",
      );
    const values = parseInput(deleteIssueSchema, input);
    return this.transaction(async (tx) => {
      const [ownedWorkspace] = await tx
        .select({ id: workspace.id })
        .from(workspace)
        .where(
          and(
            eq(workspace.id, context.workspaceId),
            eq(workspace.ownerId, context.actor.id),
          ),
        );
      if (!ownedWorkspace) throw new DomainError("forbidden", "Owner required");
      // Include tombstones here only: a lost DELETE response can be retried safely.
      const [current] = await tx
        .select()
        .from(issue)
        .where(
          and(
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        )
        .limit(1)
        .for("update");
      if (!current) throw new DomainError("not_found", "Issue not found");
      const result = { deleted: true, issueId, projectId: current.projectId };
      if (current.deletedAt) return result;
      assertExpectedVersion(
        current.version,
        values.expectedVersion,
        "This ticket changed. Reload and review it before deleting.",
      );
      await assertIssueQuestionSnapshot(tx, {
        workspaceId: context.workspaceId,
        issueId,
        expected: values.questionVersions,
        conflictMessage:
          "Questions or answers changed. Reload and review them before deleting.",
      });
      const now = new Date();
      await tx
        .update(issue)
        .set({
          deletedAt: now,
          ...issueMutationStamp(now),
          claimedAt: null,
          claimedByAgentId: null,
        })
        .where(
          and(
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        );
      await recordActivity(tx, context, {
        projectId: current.projectId,
        issueId,
        type: "issue.deleted",
        summary: `Deleted ${current.key}`,
        changes: {
          deletedAt: { from: null, to: now.toISOString() },
          claimedByAgentId: { from: current.claimedByAgentId, to: null },
        },
      });
      return result;
    });
  }
}
