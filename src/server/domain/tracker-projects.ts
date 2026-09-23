import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { epic, issue, issueStatusValues, project } from "../db/schema.js";
import {
  type CreateEpicInput,
  type CreateProjectInput,
  createEpicSchema,
  createProjectSchema,
  type EpicArchiveFilter,
  type MutationContext,
  mutationContextSchema,
  type UpdateEpicInput,
  type UpdateProjectInput,
  updateEpicSchema,
  updateProjectSchema,
} from "./contracts.js";
import { DomainError } from "./errors.js";
import { assertExpectedVersion, recordActivity } from "./tracker-mutations.js";
import {
  changedFields,
  isUniqueViolation,
  parseTrackerInput as parseInput,
  TrackerCapability,
} from "./tracker-support.js";

export type ProjectPageCursor = {
  createdAt: Date;
  key: string;
  id: string;
};

function emptyEpicSummary() {
  return {
    totalIssues: 0,
    doneIssues: 0,
    statusCounts: Object.fromEntries(
      issueStatusValues.map((status) => [status, 0]),
    ) as Record<(typeof issueStatusValues)[number], number>,
  };
}

export class TrackerProjectCapability extends TrackerCapability {
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
      assertExpectedVersion(
        current.version,
        expectedVersion,
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
}
