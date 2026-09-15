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
import { z } from "zod";
import { assigneeColumns, assigneePredicate } from "../assignee-projection.js";
import type { Database } from "../db/client.js";
import {
  activityEvent,
  codeLink,
  epic,
  issue,
  issueComment,
  issueQuestion,
  issueStatusValues,
  project,
  workspace,
} from "../db/schema.js";
import {
  type AddCodeLinkInput,
  type AddIssueCommentInput,
  type AnswerIssueQuestionInput,
  addCodeLinkSchema,
  addIssueCommentSchema,
  answerIssueQuestionSchema,
  type CreateEpicInput,
  type CreateIssueInput,
  type CreateIssueQuestionInput,
  type CreateProjectInput,
  createEpicSchema,
  createIssueQuestionSchema,
  createIssueSchema,
  createProjectSchema,
  type DeleteIssueInput,
  deleteIssueSchema,
  type EpicArchiveFilter,
  type MutationContext,
  mutationContextSchema,
  type ReviewIssueInput,
  requestChangesSchema,
  reviewIssueSchema,
  type UpdateEpicInput,
  type UpdateIssueInput,
  type UpdateProjectInput,
  updateEpicSchema,
  updateIssueSchema,
  updateProjectSchema,
} from "./contracts.js";
import { DomainError } from "./errors.js";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type TrackerDatabase = Database | Transaction;
type ActivityChanges = Record<string, unknown>;

export type ProjectPageCursor = {
  createdAt: Date;
  key: string;
  id: string;
};

export type IssuePageCursor = {
  projectId: string;
  number: number;
  id: string;
};

export type ActivityPageCursor = {
  createdAt: Date;
  id: string;
};

export type IssueClaimFilter = "any" | "claimed" | "unclaimed" | "mine";

function validationFields(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      "invalid",
      "Invalid tracker input",
      validationFields(parsed.error),
    );
  }
  return parsed.data;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

function boundedSummary(value: string): string {
  return value.length <= 500 ? value : `${value.slice(0, 497)}...`;
}

function changedFields(
  previousInput: object,
  nextInput: object,
): ActivityChanges {
  const previous = previousInput as Record<string, unknown>;
  const next = nextInput as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(next)
      .filter(([field, value]) => value !== previous[field])
      .map(([field, value]) => [
        field,
        { from: previous[field] ?? null, to: value ?? null },
      ]),
  );
}

async function recordActivity(
  tx: Transaction,
  context: MutationContext,
  values: {
    projectId: string;
    issueId?: string;
    type: string;
    summary: string;
    changes: ActivityChanges;
  },
) {
  await tx.insert(activityEvent).values({
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
  });
}

function requireHuman(context: MutationContext) {
  if (context.actor.type !== "human") {
    throw new DomainError("forbidden", "Human review is required");
  }
}

function summarizeQuestions(
  questions: Array<typeof issueQuestion.$inferSelect>,
) {
  const answered = questions.filter((item) => item.answeredAt !== null).length;
  const unansweredBlocking = questions.filter(
    (item) => item.blocking && item.answeredAt === null,
  ).length;
  return { total: questions.length, answered, unansweredBlocking };
}

function emptyEpicSummary() {
  return {
    totalIssues: 0,
    doneIssues: 0,
    statusCounts: Object.fromEntries(
      issueStatusValues.map((status) => [status, 0]),
    ) as Record<(typeof issueStatusValues)[number], number>,
  };
}

export class TrackerService {
  constructor(private readonly db: TrackerDatabase) {}

  private transaction<T>(callback: (tx: Transaction) => Promise<T>) {
    if ("transaction" in this.db) return this.db.transaction(callback);
    return callback(this.db);
  }

  async createProject(
    contextInput: MutationContext,
    input: CreateProjectInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    const values = parseInput(createProjectSchema, input);

    try {
      return await this.transaction(async (tx) => {
        const [created] = await tx
          .insert(project)
          .values({
            id: randomUUID(),
            workspaceId: context.workspaceId,
            ...values,
          })
          .returning();
        if (!created) throw new Error("Project insert returned no row");

        await recordActivity(tx, context, {
          projectId: created.id,
          type: "project.created",
          summary: `Created project ${created.key}`,
          changes: {
            name: { from: null, to: created.name },
            key: { from: null, to: created.key },
          },
        });
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError("conflict", "Project key is already in use");
      }
      throw error;
    }
  }

  async listProjects(workspaceId: string) {
    return this.db
      .select()
      .from(project)
      .where(eq(project.workspaceId, workspaceId))
      .orderBy(asc(project.createdAt), asc(project.key));
  }

  async listProjectPage(
    workspaceId: string,
    options: {
      projectIds: string[];
      limit: number;
      after?: ProjectPageCursor;
    },
  ) {
    if (options.projectIds.length === 0) {
      return { items: [], hasMore: false };
    }
    const after = options.after;
    const rows = await this.db
      .select({
        id: project.id,
        key: project.key,
        name: project.name,
        version: project.version,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })
      .from(project)
      .where(
        and(
          eq(project.workspaceId, workspaceId),
          inArray(project.id, options.projectIds),
          after
            ? or(
                gt(project.createdAt, after.createdAt),
                and(
                  eq(project.createdAt, after.createdAt),
                  gt(project.key, after.key),
                ),
                and(
                  eq(project.createdAt, after.createdAt),
                  eq(project.key, after.key),
                  gt(project.id, after.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(project.createdAt), asc(project.key), asc(project.id))
      .limit(options.limit + 1);
    return {
      items: rows.slice(0, options.limit),
      hasMore: rows.length > options.limit,
    };
  }

  async getProject(workspaceId: string, projectId: string) {
    const [found] = await this.db
      .select()
      .from(project)
      .where(
        and(eq(project.workspaceId, workspaceId), eq(project.id, projectId)),
      )
      .limit(1);
    if (!found) throw new DomainError("not_found", "Project not found");
    return found;
  }

  async updateProject(
    contextInput: MutationContext,
    projectId: string,
    input: UpdateProjectInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    const values = parseInput(updateProjectSchema, input);

    return this.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(project)
        .where(
          and(
            eq(project.workspaceId, context.workspaceId),
            eq(project.id, projectId),
          ),
        )
        .limit(1);
      if (!current) throw new DomainError("not_found", "Project not found");

      const changes = changedFields(current, values);
      if (Object.keys(changes).length === 0) return current;

      const [updated] = await tx
        .update(project)
        .set({
          ...values,
          version: sql`${project.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(project.workspaceId, context.workspaceId),
            eq(project.id, projectId),
          ),
        )
        .returning();
      if (!updated) throw new DomainError("not_found", "Project not found");

      await recordActivity(tx, context, {
        projectId,
        type: "project.updated",
        summary: `Updated project ${current.key}`,
        changes,
      });
      return updated;
    });
  }

  async createEpic(contextInput: MutationContext, input: CreateEpicInput) {
    const context = parseInput(mutationContextSchema, contextInput);
    const values = parseInput(createEpicSchema, input);

    return this.transaction(async (tx) => {
      const [numberedProject] = await tx
        .update(project)
        .set({ nextEpicNumber: sql`${project.nextEpicNumber} + 1` })
        .where(
          and(
            eq(project.workspaceId, context.workspaceId),
            eq(project.id, values.projectId),
          ),
        )
        .returning({ number: sql<number>`${project.nextEpicNumber} - 1` });
      if (!numberedProject)
        throw new DomainError("not_found", "Project not found");

      const [created] = await tx
        .insert(epic)
        .values({
          id: randomUUID(),
          workspaceId: context.workspaceId,
          ...values,
          number: numberedProject.number,
        })
        .returning();
      if (!created) throw new Error("Epic insert returned no row");

      await recordActivity(tx, context, {
        projectId: created.projectId,
        type: "epic.created",
        summary: `Created epic ${created.number}/${created.title}`,
        changes: {
          epicId: { from: null, to: created.id },
          number: { from: null, to: created.number },
          title: { from: null, to: created.title },
        },
      });
      return { ...created, summary: emptyEpicSummary() };
    });
  }

  async listEpics(
    workspaceId: string,
    projectId: string,
    archive: EpicArchiveFilter = "active",
  ) {
    const epics = await this.db
      .select()
      .from(epic)
      .where(
        and(
          eq(epic.workspaceId, workspaceId),
          eq(epic.projectId, projectId),
          archive === "active"
            ? isNull(epic.archivedAt)
            : archive === "archived"
              ? isNotNull(epic.archivedAt)
              : undefined,
        ),
      )
      .orderBy(asc(epic.number));
    if (epics.length === 0) return [];

    const counts = await this.db
      .select({
        epicId: issue.epicId,
        status: issue.status,
        count: sql<number>`count(*)::int`,
      })
      .from(issue)
      .where(
        and(
          isNull(issue.deletedAt),
          eq(issue.workspaceId, workspaceId),
          eq(issue.projectId, projectId),
          inArray(
            issue.epicId,
            epics.map((item) => item.id),
          ),
        ),
      )
      .groupBy(issue.epicId, issue.status);
    const summaries = new Map<string, ReturnType<typeof emptyEpicSummary>>();
    for (const row of counts) {
      if (!row.epicId) continue;
      const summary = summaries.get(row.epicId) ?? emptyEpicSummary();
      summary.statusCounts[row.status] = row.count;
      summary.totalIssues += row.count;
      if (row.status === "done") summary.doneIssues += row.count;
      summaries.set(row.epicId, summary);
    }
    return epics.map((item) => ({
      ...item,
      summary: summaries.get(item.id) ?? emptyEpicSummary(),
    }));
  }

  async getEpic(workspaceId: string, epicId: string) {
    const [found] = await this.db
      .select()
      .from(epic)
      .where(and(eq(epic.workspaceId, workspaceId), eq(epic.id, epicId)))
      .limit(1);
    if (!found) throw new DomainError("not_found", "Epic not found");
    return found;
  }

  async listEpicPage(
    workspaceId: string,
    projectId: string,
    options: {
      limit: number;
      archive?: EpicArchiveFilter;
      after?: { number: number; id: string };
    },
  ) {
    const archive = options.archive ?? "active";
    const rows = await this.db
      .select({
        id: epic.id,
        projectId: epic.projectId,
        number: epic.number,
        title: epic.title,
        archivedAt: epic.archivedAt,
        version: epic.version,
        createdAt: epic.createdAt,
        updatedAt: epic.updatedAt,
      })
      .from(epic)
      .where(
        and(
          eq(epic.workspaceId, workspaceId),
          eq(epic.projectId, projectId),
          archive === "active"
            ? isNull(epic.archivedAt)
            : archive === "archived"
              ? isNotNull(epic.archivedAt)
              : undefined,
          options.after
            ? or(
                gt(epic.number, options.after.number),
                and(
                  eq(epic.number, options.after.number),
                  gt(epic.id, options.after.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(epic.number), asc(epic.id))
      .limit(options.limit + 1);
    return {
      items: rows.slice(0, options.limit),
      hasMore: rows.length > options.limit,
    };
  }

  async getEpicSummary(workspaceId: string, epicId: string) {
    const found = await this.getEpic(workspaceId, epicId);
    const counts = await this.db
      .select({ status: issue.status, count: sql<number>`count(*)::int` })
      .from(issue)
      .where(
        and(
          isNull(issue.deletedAt),
          eq(issue.workspaceId, workspaceId),
          eq(issue.projectId, found.projectId),
          eq(issue.epicId, epicId),
        ),
      )
      .groupBy(issue.status);
    const summary = emptyEpicSummary();
    for (const row of counts) {
      summary.statusCounts[row.status] = row.count;
      summary.totalIssues += row.count;
      if (row.status === "done") summary.doneIssues += row.count;
    }
    return { ...found, summary };
  }

  async getEpicDetail(workspaceId: string, epicId: string) {
    const foundEpic = await this.getEpic(workspaceId, epicId);
    const [issues, detailedEpic] = await Promise.all([
      this.listIssues(workspaceId, foundEpic.projectId, foundEpic.id, true),
      this.getEpicSummary(workspaceId, epicId),
    ]);
    return {
      epic: detailedEpic,
      issues,
    };
  }

  async updateEpic(
    contextInput: MutationContext,
    epicId: string,
    input: UpdateEpicInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    const { expectedVersion, archived, ...editableValues } = parseInput(
      updateEpicSchema,
      input,
    );

    return this.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(epic)
        .where(
          and(eq(epic.workspaceId, context.workspaceId), eq(epic.id, epicId)),
        )
        .limit(1)
        .for("update");
      if (!current) throw new DomainError("not_found", "Epic not found");
      if (expectedVersion !== undefined && current.version !== expectedVersion)
        throw new DomainError(
          "conflict",
          "This Epic changed. Your draft is preserved; read the latest version before merging and retrying.",
        );
      const archiveChanged =
        archived !== undefined && archived !== (current.archivedAt !== null);
      const changes = changedFields(current, editableValues);
      if (archiveChanged) {
        changes.archived = {
          from: current.archivedAt !== null,
          to: archived,
        };
      }
      if (Object.keys(changes).length === 0) return current;

      const [updated] = await tx
        .update(epic)
        .set({
          ...editableValues,
          ...(archiveChanged
            ? { archivedAt: archived ? new Date() : null }
            : {}),
          version: sql`${epic.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(epic.workspaceId, context.workspaceId),
            eq(epic.id, epicId),
            eq(epic.version, expectedVersion ?? current.version),
          ),
        )
        .returning();
      if (!updated)
        throw new DomainError(
          "conflict",
          "Epic changed; read it again before retrying",
        );

      await recordActivity(tx, context, {
        projectId: current.projectId,
        type: archiveChanged
          ? archived
            ? "epic.archived"
            : "epic.restored"
          : "epic.updated",
        summary: archiveChanged
          ? `${archived ? "Archived" : "Restored"} epic ${updated.number}/${updated.title}`
          : `Updated epic ${updated.number}/${updated.title}`,
        changes: { epicId, ...changes },
      });
      return updated;
    });
  }

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
  ) {
    const predicate = and(
      isNull(issue.deletedAt),
      eq(issue.workspaceId, workspaceId),
      projectId ? eq(issue.projectId, projectId) : undefined,
      assigneePredicate(assignee),
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

  async getIssueDetail(workspaceId: string, issueId: string) {
    const foundIssue = await this.getIssue(workspaceId, issueId);
    const [links, questions, comments, foundEpic] = await Promise.all([
      this.db
        .select()
        .from(codeLink)
        .where(
          and(
            eq(codeLink.workspaceId, workspaceId),
            eq(codeLink.issueId, issueId),
          ),
        )
        .orderBy(asc(codeLink.createdAt)),
      this.listIssueQuestions(workspaceId, issueId),
      this.listIssueComments(workspaceId, issueId),
      foundIssue.epicId
        ? this.getEpic(workspaceId, foundIssue.epicId)
        : Promise.resolve(null),
    ]);
    return {
      issue: { ...foundIssue, questionSummary: summarizeQuestions(questions) },
      codeLinks: links,
      questions,
      comments,
      epic: foundEpic,
      questionSummary: summarizeQuestions(questions),
    };
  }

  async listIssueComments(workspaceId: string, issueId: string) {
    await this.getIssue(workspaceId, issueId);
    return this.db
      .select()
      .from(issueComment)
      .where(
        and(
          eq(issueComment.workspaceId, workspaceId),
          eq(issueComment.issueId, issueId),
        ),
      )
      .orderBy(asc(issueComment.createdAt), asc(issueComment.id));
  }

  async addIssueComment(
    contextInput: MutationContext,
    issueId: string,
    input: AddIssueCommentInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    const values = parseInput(addIssueCommentSchema, input);

    return this.transaction(async (tx) => {
      const [currentIssue] = await tx
        .select()
        .from(issue)
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        )
        .limit(1)
        .for("update");
      if (!currentIssue) throw new DomainError("not_found", "Issue not found");

      const [created] = await tx
        .insert(issueComment)
        .values({
          id: randomUUID(),
          workspaceId: context.workspaceId,
          issueId,
          body: values.body,
          authorType: context.actor.type,
          authorId: context.actor.id,
          authorDisplayName: context.actor.displayName,
          source: context.source,
        })
        .returning();
      if (!created) throw new Error("Issue comment insert returned no row");

      await recordActivity(tx, context, {
        projectId: currentIssue.projectId,
        issueId,
        type: "issue.comment_added",
        summary: `Commented on ${currentIssue.key}`,
        changes: { commentId: created.id },
      });
      return created;
    });
  }

  async listIssueQuestions(workspaceId: string, issueId: string) {
    await this.getIssue(workspaceId, issueId);
    return this.db
      .select()
      .from(issueQuestion)
      .where(
        and(
          eq(issueQuestion.workspaceId, workspaceId),
          eq(issueQuestion.issueId, issueId),
        ),
      )
      .orderBy(asc(issueQuestion.createdAt), asc(issueQuestion.id));
  }

  async createIssueQuestion(
    contextInput: MutationContext,
    issueId: string,
    input: CreateIssueQuestionInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    const values = parseInput(createIssueQuestionSchema, input);

    return this.transaction(async (tx) => {
      const [currentIssue] = await tx
        .select()
        .from(issue)
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        )
        .limit(1)
        .for("update");
      if (!currentIssue) throw new DomainError("not_found", "Issue not found");

      const options = values.options.map((option) => ({
        id: randomUUID(),
        label: option.label,
        description: option.description,
      }));
      const recommended = options[values.recommendedOptionIndex];
      if (!recommended) {
        throw new DomainError("invalid", "Recommended option is invalid");
      }
      const [created] = await tx
        .insert(issueQuestion)
        .values({
          id: randomUUID(),
          workspaceId: context.workspaceId,
          issueId,
          prompt: values.prompt,
          recommendation: values.recommendation,
          options,
          recommendedOptionId: recommended.id,
          blocking: values.blocking,
        })
        .returning();
      if (!created) throw new Error("Issue question insert returned no row");

      await recordActivity(tx, context, {
        projectId: currentIssue.projectId,
        issueId,
        type: "issue.question_added",
        summary: `Added ${created.blocking ? "a blocking" : "an advisory"} question to ${currentIssue.key}`,
        changes: {
          questionId: created.id,
          blocking: created.blocking,
          prompt: created.prompt,
        },
      });
      return created;
    });
  }

  async answerIssueQuestion(
    contextInput: MutationContext,
    issueId: string,
    questionId: string,
    input: AnswerIssueQuestionInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    requireHuman(context);
    const answer = parseInput(answerIssueQuestionSchema, input);

    return this.transaction(async (tx) => {
      const [currentIssue] = await tx
        .select()
        .from(issue)
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        )
        .limit(1)
        .for("update");
      if (!currentIssue) throw new DomainError("not_found", "Issue not found");

      const [current] = await tx
        .select()
        .from(issueQuestion)
        .where(
          and(
            eq(issueQuestion.workspaceId, context.workspaceId),
            eq(issueQuestion.issueId, issueId),
            eq(issueQuestion.id, questionId),
          ),
        )
        .limit(1);
      if (!current) throw new DomainError("not_found", "Question not found");

      if (
        answer.expectedVersion !== undefined &&
        current.version !== answer.expectedVersion
      ) {
        throw new DomainError(
          "conflict",
          "This answer changed. Compare the latest response before saving your draft.",
        );
      }

      if (
        answer.kind === "option" &&
        !current.options.some((option) => option.id === answer.optionId)
      ) {
        throw new DomainError("invalid", "Answer option is not available", [
          {
            field: "optionId",
            message: "Choose one of this question's options",
          },
        ]);
      }

      const next =
        answer.kind === "option"
          ? { answerOptionId: answer.optionId, answerOtherText: null }
          : { answerOptionId: null, answerOtherText: answer.text };
      if (
        current.answerOptionId === next.answerOptionId &&
        current.answerOtherText === next.answerOtherText
      ) {
        return current;
      }

      const answeredAt = new Date();
      const [updated] = await tx
        .update(issueQuestion)
        .set({
          ...next,
          answeredByUserId: context.actor.id,
          answeredAt,
          version: sql`${issueQuestion.version} + 1`,
          updatedAt: answeredAt,
        })
        .where(
          and(
            eq(issueQuestion.workspaceId, context.workspaceId),
            eq(issueQuestion.issueId, issueId),
            eq(issueQuestion.id, questionId),
          ),
        )
        .returning();
      if (!updated) throw new DomainError("not_found", "Question not found");

      await recordActivity(tx, context, {
        projectId: currentIssue.projectId,
        issueId,
        type: current.answeredAt
          ? "issue.question_answer_changed"
          : "issue.question_answered",
        summary: `${current.answeredAt ? "Changed an answer" : "Answered a question"} on ${currentIssue.key}`,
        changes: {
          questionId,
          answer: {
            from: current.answerOptionId
              ? { kind: "option", optionId: current.answerOptionId }
              : current.answerOtherText
                ? { kind: "other", text: current.answerOtherText }
                : null,
            to:
              answer.kind === "option"
                ? { kind: "option", optionId: answer.optionId }
                : { kind: "other", text: answer.text },
          },
        },
      });
      return updated;
    });
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
      const [current] = await tx
        .select()
        .from(issue)
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        )
        .limit(1)
        .for("update");
      if (!current) throw new DomainError("not_found", "Issue not found");
      if (expectedVersion !== undefined && current.version !== expectedVersion)
        throw new DomainError(
          "conflict",
          "This issue changed. Your draft is preserved; read the latest version before merging and retrying.",
        );
      if (questionVersions !== undefined) {
        const actual = await tx
          .select({ id: issueQuestion.id, version: issueQuestion.version })
          .from(issueQuestion)
          .where(
            and(
              eq(issueQuestion.workspaceId, context.workspaceId),
              eq(issueQuestion.issueId, issueId),
            ),
          );
        const versions = new Map(
          questionVersions.map((item) => [item.id, item.version]),
        );
        if (
          actual.length !== questionVersions.length ||
          actual.some((item) => versions.get(item.id) !== item.version)
        )
          throw new DomainError(
            "conflict",
            "Questions or answers changed. Your draft is preserved; read the current answers before merging and retrying.",
          );
      }

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
          version: sql`${issue.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
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
      if (current.version !== values.expectedVersion)
        throw new DomainError(
          "conflict",
          "This ticket changed. Reload and review it before deleting.",
        );
      const actual = await tx
        .select({ id: issueQuestion.id, version: issueQuestion.version })
        .from(issueQuestion)
        .where(
          and(
            eq(issueQuestion.workspaceId, context.workspaceId),
            eq(issueQuestion.issueId, issueId),
          ),
        );
      const versions = new Map(
        values.questionVersions.map(({ id, version }) => [id, version]),
      );
      if (
        actual.length !== versions.size ||
        actual.some(({ id, version }) => versions.get(id) !== version)
      )
        throw new DomainError(
          "conflict",
          "Questions or answers changed. Reload and review them before deleting.",
        );
      const now = new Date();
      await tx
        .update(issue)
        .set({
          deletedAt: now,
          updatedAt: now,
          version: sql`${issue.version} + 1`,
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
      const [current] = await tx
        .select()
        .from(issue)
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        )
        .limit(1)
        .for("update");
      if (!current) throw new DomainError("not_found", "Issue not found");
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
          version: sql`${issue.version} + 1`,
          updatedAt: claimedAt,
        })
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
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
      const [current] = await tx
        .select()
        .from(issue)
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        )
        .limit(1)
        .for("update");
      if (!current) throw new DomainError("not_found", "Issue not found");
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
          version: sql`${issue.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        )
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
      const [current] = await tx
        .select()
        .from(issue)
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        )
        .limit(1)
        .for("update");
      if (!current) throw new DomainError("not_found", "Issue not found");

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
        .set({ version: sql`${issue.version} + 1`, updatedAt: new Date() })
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        )
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

  async listActivity(workspaceId: string, issueId: string) {
    await this.getIssue(workspaceId, issueId);
    return this.db
      .select()
      .from(activityEvent)
      .where(
        and(
          eq(activityEvent.workspaceId, workspaceId),
          eq(activityEvent.issueId, issueId),
        ),
      )
      .orderBy(asc(activityEvent.createdAt), asc(activityEvent.id));
  }

  async listActivityPage(
    workspaceId: string,
    issueId: string,
    options: { limit: number; after?: ActivityPageCursor },
  ) {
    await this.getIssue(workspaceId, issueId);
    const after = options.after;
    const rows = await this.db
      .select({
        id: activityEvent.id,
        type: activityEvent.type,
        actorType: activityEvent.actorType,
        actorId: activityEvent.actorId,
        actorDisplayName: activityEvent.actorDisplayName,
        source: activityEvent.source,
        summary: activityEvent.summary,
        createdAt: activityEvent.createdAt,
      })
      .from(activityEvent)
      .where(
        and(
          eq(activityEvent.workspaceId, workspaceId),
          eq(activityEvent.issueId, issueId),
          after
            ? or(
                gt(activityEvent.createdAt, after.createdAt),
                and(
                  eq(activityEvent.createdAt, after.createdAt),
                  gt(activityEvent.id, after.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(activityEvent.createdAt), asc(activityEvent.id))
      .limit(options.limit + 1);
    return {
      items: rows.slice(0, options.limit),
      hasMore: rows.length > options.limit,
    };
  }

  private async review(
    context: MutationContext,
    issueId: string,
    outcome: "accepted" | "changes_requested",
    reason?: string,
    guard: ReviewIssueInput = {},
  ) {
    return this.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(issue)
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
          ),
        )
        .limit(1)
        .for("update");
      if (!current) throw new DomainError("not_found", "Issue not found");
      if (current.status !== "ready_for_review") {
        throw new DomainError(
          "conflict",
          "Only work ready for review can receive a review decision",
        );
      }

      if (
        guard.expectedVersion !== undefined &&
        current.version !== guard.expectedVersion
      ) {
        throw new DomainError(
          "conflict",
          "This ticket changed. Compare the latest version before reviewing.",
        );
      }
      if (guard.questionVersions !== undefined) {
        const actual = await tx
          .select({ id: issueQuestion.id, version: issueQuestion.version })
          .from(issueQuestion)
          .where(
            and(
              eq(issueQuestion.workspaceId, context.workspaceId),
              eq(issueQuestion.issueId, issueId),
            ),
          );
        const expected = new Map(
          guard.questionVersions.map((item) => [item.id, item.version]),
        );
        if (
          actual.length !== expected.size ||
          actual.some((item) => expected.get(item.id) !== item.version)
        ) {
          throw new DomainError(
            "conflict",
            "This ticket's questions changed. Compare the latest decisions before reviewing.",
          );
        }
      }

      const status = outcome === "accepted" ? "done" : "in_progress";
      const [updated] = await tx
        .update(issue)
        .set({
          status,
          version: sql`${issue.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            isNull(issue.deletedAt),
            eq(issue.workspaceId, context.workspaceId),
            eq(issue.id, issueId),
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
