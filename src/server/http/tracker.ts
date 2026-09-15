import { and, count, eq, max } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { assigneeFilterSchema } from "../assignee-projection.js";
import { AssignmentService, assignmentSchema } from "../assignments.js";
import type { IssopenAuth, OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import { activityEvent, issueStatusValues } from "../db/schema.js";
import {
  addCodeLinkSchema,
  addIssueCommentSchema,
  answerIssueQuestionSchema,
  createEpicSchema,
  createIssueQuestionSchema,
  createIssueSchema,
  createProjectSchema,
  DomainError,
  deleteIssueSchema,
  epicArchiveFilterSchema,
  type MutationContext,
  requestChangesSchema,
  reviewIssueSchema,
  TrackerService,
  updateEpicSchema,
  updateIssueSchema,
  updateProjectSchema,
} from "../domain/index.js";
import {
  canAccessProject,
  canEditProject,
  type HumanAccess,
  humanMutationContext,
  requireHumanAccess,
  requireProjectAccess,
  requireProjectEdit,
  requireWorkspaceOwner,
  resolveHumanAccess,
} from "../human-access.js";
import {
  QuestionRecipientService,
  recipientSchema,
} from "../question-recipients.js";

type TrackerBindings = {
  Variables: {
    ownerSession: OwnerSession;
    humanAccess: HumanAccess | null;
  };
};

type TrackerRouterDependencies = {
  db: Database;
  auth: IssopenAuth;
};

const identifierSchema = z.uuid();
const createEpicBodySchema = createEpicSchema.omit({ projectId: true });
const createIssueBodySchema = createIssueSchema.omit({ projectId: true });
const epicFilterSchema = z.union([z.uuid(), z.literal("unassigned")]);

function fieldsFromZod(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "request",
    message: issue.message,
  }));
}

async function parseBody<T>(
  context: Context,
  schema: z.ZodType<T>,
): Promise<T> {
  const rawText = await context.req.text();
  let input: unknown = {};
  if (rawText.trim() !== "") {
    try {
      input = JSON.parse(rawText);
    } catch {
      throw new DomainError("invalid", "Request body must be valid JSON", [
        { field: "request", message: "Request body must be valid JSON" },
      ]);
    }
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      "invalid",
      "Invalid request",
      fieldsFromZod(parsed.error),
    );
  }
  return parsed.data;
}

function parseIdentifier(value: string, field: string): string {
  const parsed = identifierSchema.safeParse(value);
  if (!parsed.success) {
    throw new DomainError("invalid", "Invalid request", [
      { field, message: "Must be a valid identifier" },
    ]);
  }
  return parsed.data;
}

function parseOptionalEpicFilter(value: string | undefined) {
  if (value === undefined) return undefined;
  const parsed = epicFilterSchema.safeParse(value);
  if (!parsed.success) {
    throw new DomainError("invalid", "Invalid request", [
      { field: "epicId", message: "Must be an Epic identifier or unassigned" },
    ]);
  }
  return parsed.data;
}

function parseEpicArchiveFilter(value: string | undefined) {
  const parsed = epicArchiveFilterSchema.safeParse(value ?? "active");
  if (!parsed.success) {
    throw new DomainError("invalid", "Invalid request", [
      {
        field: "archived",
        message: "Must be active, archived or all",
      },
    ]);
  }
  return parsed.data;
}

function parseAssigneeFilter(value: string | undefined, viewerId: string) {
  if (value === undefined) return undefined;
  if (value === "mine") return viewerId;
  const parsed = assigneeFilterSchema.safeParse(value);
  if (!parsed.success)
    throw new DomainError("invalid", "Invalid human assignee filter");
  return parsed.data;
}

async function projectActivityCursor(
  db: Database,
  workspaceId: string,
  projectId: string,
) {
  const [latest] = await db
    .select({
      events: count(activityEvent.id),
      createdAt: max(activityEvent.createdAt),
    })
    .from(activityEvent)
    .where(
      and(
        eq(activityEvent.workspaceId, workspaceId),
        eq(activityEvent.projectId, projectId),
      ),
    );
  return `${latest?.events ?? 0}:${latest?.createdAt?.getTime() ?? 0}`;
}

export function domainErrorResponse(context: Context, error: DomainError) {
  switch (error.code) {
    case "invalid":
      return context.json(
        {
          error: error.message,
          fields: error.fields ?? [],
        },
        400,
      );
    case "forbidden":
      return context.json({ error: "Action is not allowed" }, 403);
    case "not_found":
      return context.json({ error: "This page isn't available" }, 404);
    case "conflict":
      return context.json({ error: error.message }, 409);
  }
}

function humanContext(
  accessInput: HumanAccess | null,
): MutationContext & { access: HumanAccess } {
  const access = requireHumanAccess(accessInput);
  return { ...humanMutationContext(access), access };
}

export function createTrackerRouter({ db, auth }: TrackerRouterDependencies) {
  const router = new Hono<TrackerBindings>();
  const tracker = new TrackerService(db);

  router.use("*", async (context, next) => {
    try {
      await next();
    } catch (error) {
      if (error instanceof DomainError) {
        return domainErrorResponse(context, error);
      }
      throw error;
    }
  });

  router.get("/projects", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const projects = await tracker.listProjects(mutationContext.workspaceId);
    return context.json({
      projects: (mutationContext.access.projectIds === null
        ? projects
        : projects.filter((item) =>
            mutationContext.access.projectIds?.includes(item.id),
          )
      ).map((item) => ({
        ...item,
        canEdit: canEditProject(mutationContext.access, item.id),
      })),
    });
  });

  router.post("/projects", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    requireWorkspaceOwner(mutationContext.access);
    const input = await parseBody(context, createProjectSchema);
    const created = await tracker.createProject(mutationContext, input);
    return context.json({ project: created }, 201);
  });

  router.get("/projects/:projectId", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    requireProjectAccess(mutationContext.access, projectId);
    return context.json({
      project: {
        ...(await tracker.getProject(mutationContext.workspaceId, projectId)),
        canEdit: canEditProject(mutationContext.access, projectId),
      },
    });
  });

  router.patch("/projects/:projectId", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    requireWorkspaceOwner(mutationContext.access);
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    const input = await parseBody(context, updateProjectSchema);
    return context.json({
      project: await tracker.updateProject(mutationContext, projectId, input),
    });
  });

  router.get("/projects/:projectId/epics", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    requireProjectAccess(mutationContext.access, projectId);
    await tracker.getProject(mutationContext.workspaceId, projectId);
    const archiveFilter = parseEpicArchiveFilter(context.req.query("archived"));
    return context.json({
      epics: await tracker.listEpics(
        mutationContext.workspaceId,
        projectId,
        archiveFilter,
      ),
    });
  });

  router.post("/projects/:projectId/epics", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    requireProjectEdit(mutationContext.access, projectId);
    const input = await parseBody(context, createEpicBodySchema);
    const created = await tracker.createEpic(mutationContext, {
      projectId,
      ...input,
    });
    return context.json({ epic: created }, 201);
  });

  router.get("/epics/:epicId", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const epicId = parseIdentifier(context.req.param("epicId"), "epicId");
    const foundEpic = await tracker.getEpic(
      mutationContext.workspaceId,
      epicId,
    );
    requireProjectAccess(mutationContext.access, foundEpic.projectId);
    return context.json({
      ...(await tracker.getEpicDetail(mutationContext.workspaceId, epicId)),
      canEdit: canEditProject(mutationContext.access, foundEpic.projectId),
    });
  });

  router.patch("/epics/:epicId", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const epicId = parseIdentifier(context.req.param("epicId"), "epicId");
    const foundEpic = await tracker.getEpic(
      mutationContext.workspaceId,
      epicId,
    );
    requireProjectEdit(mutationContext.access, foundEpic.projectId);
    const input = await parseBody(context, updateEpicSchema);
    return context.json({
      epic: await tracker.updateEpic(mutationContext, epicId, input),
    });
  });

  router.get("/projects/:projectId/issues", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    requireProjectAccess(mutationContext.access, projectId);
    await tracker.getProject(mutationContext.workspaceId, projectId);
    const epicFilter = parseOptionalEpicFilter(context.req.query("epicId"));
    return context.json({
      issues: await tracker.listIssues(
        mutationContext.workspaceId,
        projectId,
        epicFilter === "unassigned" ? null : epicFilter,
        false,
        parseAssigneeFilter(
          context.req.query("assignee"),
          mutationContext.actor.id,
        ),
        mutationContext.actor.id,
        context.req.query("questionsFor") === "mine"
          ? mutationContext.actor.id
          : undefined,
      ),
    });
  });

  router.post("/projects/:projectId/issues", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    requireProjectEdit(mutationContext.access, projectId);
    const input = await parseBody(context, createIssueBodySchema);
    const created = await tracker.createIssue(mutationContext, {
      projectId,
      ...input,
    });
    return context.json({ issue: created }, 201);
  });

  router.get("/projects/:projectId/board", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    requireProjectAccess(mutationContext.access, projectId);
    const foundProject = await tracker.getProject(
      mutationContext.workspaceId,
      projectId,
    );
    const epicFilter = parseOptionalEpicFilter(context.req.query("epicId"));
    if (epicFilter && epicFilter !== "unassigned") {
      const foundEpic = await tracker.getEpic(
        mutationContext.workspaceId,
        epicFilter,
      );
      if (foundEpic.projectId !== projectId) {
        throw new DomainError("not_found", "Epic not found");
      }
      if (foundEpic.archivedAt) {
        throw new DomainError("not_found", "Epic not found");
      }
    }
    const issues = await tracker.listIssues(
      mutationContext.workspaceId,
      projectId,
      epicFilter === "unassigned" ? null : epicFilter,
      false,
      parseAssigneeFilter(
        context.req.query("assignee"),
        mutationContext.actor.id,
      ),
      mutationContext.actor.id,
      context.req.query("questionsFor") === "mine"
        ? mutationContext.actor.id
        : undefined,
    );
    const visibleStatuses = issueStatusValues.filter((status) => {
      if (status === "ready_for_review") return foundProject.showReviewColumn;
      if (status === "done") return foundProject.showDoneColumn;
      return true;
    });
    const visibleStatusSet = new Set(visibleStatuses);
    return context.json({
      project: {
        ...foundProject,
        canEdit: canEditProject(mutationContext.access, projectId),
      },
      epics: await tracker.listEpics(
        mutationContext.workspaceId,
        projectId,
        "all",
      ),
      epicFilter: epicFilter ?? null,
      totalIssueCount: issues.length,
      hiddenIssueCount: issues.filter(
        (item) => !visibleStatusSet.has(item.status),
      ).length,
      columns: visibleStatuses.map((status) => ({
        status,
        issues: issues.filter((item) => item.status === status),
      })),
    });
  });

  router.get("/projects/:projectId/board/events", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    requireProjectAccess(mutationContext.access, projectId);
    await tracker.getProject(mutationContext.workspaceId, projectId);
    context.header("Cache-Control", "no-cache, no-transform");
    context.header("X-Accel-Buffering", "no");

    return streamSSE(context, async (stream) => {
      let cursor = context.req.header("Last-Event-ID") ?? "";
      let quietTicks = 0;
      while (!stream.aborted) {
        // An open connection is not a durable authorization grant.
        const session = await auth.api
          .getSession({
            headers: context.req.raw.headers,
            query: { disableCookieCache: true, disableRefresh: true },
          })
          .catch(() => null);
        const access = session
          ? await resolveHumanAccess(
              db,
              session.user,
              mutationContext.workspaceId,
            ).catch(() => null)
          : null;
        if (
          !access ||
          access.workspaceId !== mutationContext.workspaceId ||
          !canAccessProject(access, projectId)
        ) {
          await stream.writeSSE({ event: "access-lost", data: "unavailable" });
          break;
        }
        const activityCursor = await projectActivityCursor(
          db,
          mutationContext.workspaceId,
          projectId,
        );
        const current = `${activityCursor}:${canEditProject(access, projectId) ? "edit" : "read"}`;
        if (current !== cursor) {
          cursor = current;
          quietTicks = 0;
          await stream.writeSSE({
            event: "board",
            id: cursor,
            data: "changed",
            retry: 2_000,
          });
        } else if (++quietTicks >= 15) {
          quietTicks = 0;
          await stream.writeSSE({ event: "keepalive", data: "ok" });
        }
        await stream.sleep(1_000);
      }
    });
  });

  router.get("/issues/:issueId", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const foundIssue = await tracker.getIssue(
      mutationContext.workspaceId,
      issueId,
    );
    requireProjectAccess(mutationContext.access, foundIssue.projectId);
    return context.json({
      ...(await tracker.getIssueDetail(
        mutationContext.workspaceId,
        issueId,
        mutationContext.actor.id,
      )),
      canEdit: canEditProject(mutationContext.access, foundIssue.projectId),
    });
  });

  router.delete("/issues/:issueId", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    requireWorkspaceOwner(mutationContext.access);
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const input = await parseBody(context, deleteIssueSchema);
    return context.json(
      await tracker.deleteIssue(mutationContext, issueId, input),
    );
  });

  router.patch("/issues/:issueId", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const foundIssue = await tracker.getIssue(
      mutationContext.workspaceId,
      issueId,
    );
    requireProjectEdit(mutationContext.access, foundIssue.projectId);
    const input = await parseBody(context, updateIssueSchema);
    return context.json({
      issue: await tracker.updateIssue(mutationContext, issueId, input),
    });
  });

  router.put("/issues/:issueId/assignee", async (context) => {
    const access = requireHumanAccess(context.get("humanAccess"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const input = await parseBody(context, assignmentSchema);
    return context.json({
      issue: await new AssignmentService(db).assign(access, issueId, input),
    });
  });

  router.put(
    "/issues/:issueId/questions/:questionId/recipient",
    async (context) => {
      const access = requireHumanAccess(context.get("humanAccess"));
      const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
      const questionId = parseIdentifier(
        context.req.param("questionId"),
        "questionId",
      );
      const input = await parseBody(context, recipientSchema);
      return context.json(
        await new QuestionRecipientService(db).set(
          access,
          issueId,
          questionId,
          input,
        ),
      );
    },
  );

  router.get("/issues/:issueId/activity", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const foundIssue = await tracker.getIssue(
      mutationContext.workspaceId,
      issueId,
    );
    requireProjectAccess(mutationContext.access, foundIssue.projectId);
    return context.json({
      activity: await tracker.listActivity(
        mutationContext.workspaceId,
        issueId,
      ),
    });
  });

  router.post("/issues/:issueId/questions", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const foundIssue = await tracker.getIssue(
      mutationContext.workspaceId,
      issueId,
    );
    requireProjectEdit(mutationContext.access, foundIssue.projectId);
    const input = await parseBody(context, createIssueQuestionSchema);
    const question = await tracker.createIssueQuestion(
      mutationContext,
      issueId,
      input,
    );
    return context.json({ question }, 201);
  });

  router.post("/issues/:issueId/comments", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const foundIssue = await tracker.getIssue(
      mutationContext.workspaceId,
      issueId,
    );
    requireProjectEdit(mutationContext.access, foundIssue.projectId);
    const input = await parseBody(context, addIssueCommentSchema);
    const comment = await tracker.addIssueComment(
      mutationContext,
      issueId,
      input,
    );
    return context.json({ comment }, 201);
  });

  router.patch(
    "/issues/:issueId/questions/:questionId/answer",
    async (context) => {
      const mutationContext = humanContext(context.get("humanAccess"));
      const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
      const foundIssue = await tracker.getIssue(
        mutationContext.workspaceId,
        issueId,
      );
      requireProjectEdit(mutationContext.access, foundIssue.projectId);
      const questionId = parseIdentifier(
        context.req.param("questionId"),
        "questionId",
      );
      const input = await parseBody(context, answerIssueQuestionSchema);
      const question = await tracker.answerIssueQuestion(
        mutationContext,
        issueId,
        questionId,
        input,
      );
      const detail = await tracker.getIssueDetail(
        mutationContext.workspaceId,
        issueId,
        mutationContext.actor.id,
      );
      return context.json({
        question:
          detail.questions.find((item) => item.id === question.id) ?? question,
        questionSummary: detail.questionSummary,
      });
    },
  );

  router.post("/issues/:issueId/code-links", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const foundIssue = await tracker.getIssue(
      mutationContext.workspaceId,
      issueId,
    );
    requireProjectEdit(mutationContext.access, foundIssue.projectId);
    const input = await parseBody(context, addCodeLinkSchema);
    return context.json(
      await tracker.addCodeLink(mutationContext, issueId, input),
      201,
    );
  });

  router.post("/issues/:issueId/review/accept", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const foundIssue = await tracker.getIssue(
      mutationContext.workspaceId,
      issueId,
    );
    requireProjectEdit(mutationContext.access, foundIssue.projectId);
    const input = await parseBody(context, reviewIssueSchema);
    return context.json({
      issue: await tracker.acceptResult(mutationContext, issueId, input),
    });
  });

  router.post("/issues/:issueId/review/request-changes", async (context) => {
    const mutationContext = humanContext(context.get("humanAccess"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const foundIssue = await tracker.getIssue(
      mutationContext.workspaceId,
      issueId,
    );
    requireProjectEdit(mutationContext.access, foundIssue.projectId);
    const input = await parseBody(context, requestChangesSchema);
    return context.json({
      issue: await tracker.requestChanges(mutationContext, issueId, input),
    });
  });

  return router;
}
