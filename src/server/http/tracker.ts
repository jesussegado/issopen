import { eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { z } from "zod";
import type { OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import { issueStatusValues, workspace } from "../db/schema.js";
import {
  addCodeLinkSchema,
  addIssueCommentSchema,
  answerIssueQuestionSchema,
  createEpicSchema,
  createIssueQuestionSchema,
  createIssueSchema,
  createProjectSchema,
  DomainError,
  type MutationContext,
  requestChangesSchema,
  TrackerService,
  updateEpicSchema,
  updateIssueSchema,
  updateProjectSchema,
} from "../domain/index.js";

type TrackerBindings = {
  Variables: {
    ownerSession: OwnerSession;
  };
};

type TrackerRouterDependencies = {
  db: Database;
};

const identifierSchema = z.uuid();
const emptyBodySchema = z.object({}).strict();
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

async function ownerContext(
  db: Database,
  ownerSession: OwnerSession,
): Promise<MutationContext> {
  const [personalWorkspace] = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerId, ownerSession.user.id))
    .limit(1);
  if (!personalWorkspace) {
    throw new DomainError("not_found", "Workspace not found");
  }

  return {
    workspaceId: personalWorkspace.id,
    actor: {
      type: "human",
      id: ownerSession.user.id,
      displayName: ownerSession.user.name,
    },
    source: "rest",
  };
}

export function createTrackerRouter({ db }: TrackerRouterDependencies) {
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
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    return context.json({
      projects: await tracker.listProjects(mutationContext.workspaceId),
    });
  });

  router.post("/projects", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const input = await parseBody(context, createProjectSchema);
    const created = await tracker.createProject(mutationContext, input);
    return context.json({ project: created }, 201);
  });

  router.get("/projects/:projectId", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    return context.json({
      project: await tracker.getProject(mutationContext.workspaceId, projectId),
    });
  });

  router.patch("/projects/:projectId", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
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
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    await tracker.getProject(mutationContext.workspaceId, projectId);
    return context.json({
      epics: await tracker.listEpics(mutationContext.workspaceId, projectId),
    });
  });

  router.post("/projects/:projectId/epics", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    const input = await parseBody(context, createEpicBodySchema);
    const created = await tracker.createEpic(mutationContext, {
      projectId,
      ...input,
    });
    return context.json({ epic: created }, 201);
  });

  router.get("/epics/:epicId", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const epicId = parseIdentifier(context.req.param("epicId"), "epicId");
    return context.json(
      await tracker.getEpicDetail(mutationContext.workspaceId, epicId),
    );
  });

  router.patch("/epics/:epicId", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const epicId = parseIdentifier(context.req.param("epicId"), "epicId");
    const input = await parseBody(context, updateEpicSchema);
    return context.json({
      epic: await tracker.updateEpic(mutationContext, epicId, input),
    });
  });

  router.get("/projects/:projectId/issues", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    await tracker.getProject(mutationContext.workspaceId, projectId);
    const epicFilter = parseOptionalEpicFilter(context.req.query("epicId"));
    return context.json({
      issues: await tracker.listIssues(
        mutationContext.workspaceId,
        projectId,
        epicFilter === "unassigned" ? null : epicFilter,
      ),
    });
  });

  router.post("/projects/:projectId/issues", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
    const input = await parseBody(context, createIssueBodySchema);
    const created = await tracker.createIssue(mutationContext, {
      projectId,
      ...input,
    });
    return context.json({ issue: created }, 201);
  });

  router.get("/projects/:projectId/board", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const projectId = parseIdentifier(
      context.req.param("projectId"),
      "projectId",
    );
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
    }
    const issues = await tracker.listIssues(
      mutationContext.workspaceId,
      projectId,
      epicFilter === "unassigned" ? null : epicFilter,
    );
    return context.json({
      project: foundProject,
      epics: await tracker.listEpics(mutationContext.workspaceId, projectId),
      epicFilter: epicFilter ?? null,
      columns: issueStatusValues.map((status) => ({
        status,
        issues: issues.filter((item) => item.status === status),
      })),
    });
  });

  router.get("/issues/:issueId", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    return context.json(
      await tracker.getIssueDetail(mutationContext.workspaceId, issueId),
    );
  });

  router.patch("/issues/:issueId", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const input = await parseBody(context, updateIssueSchema);
    return context.json({
      issue: await tracker.updateIssue(mutationContext, issueId, input),
    });
  });

  router.get("/issues/:issueId/activity", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    return context.json({
      activity: await tracker.listActivity(
        mutationContext.workspaceId,
        issueId,
      ),
    });
  });

  router.post("/issues/:issueId/questions", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const input = await parseBody(context, createIssueQuestionSchema);
    const question = await tracker.createIssueQuestion(
      mutationContext,
      issueId,
      input,
    );
    return context.json({ question }, 201);
  });

  router.post("/issues/:issueId/comments", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
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
      const mutationContext = await ownerContext(
        db,
        context.get("ownerSession"),
      );
      const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
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
      );
      return context.json({
        question,
        questionSummary: detail.questionSummary,
      });
    },
  );

  router.post("/issues/:issueId/code-links", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const input = await parseBody(context, addCodeLinkSchema);
    return context.json(
      await tracker.addCodeLink(mutationContext, issueId, input),
      201,
    );
  });

  router.post("/issues/:issueId/review/accept", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    await parseBody(context, emptyBodySchema);
    return context.json({
      issue: await tracker.acceptResult(mutationContext, issueId),
    });
  });

  router.post("/issues/:issueId/review/request-changes", async (context) => {
    const mutationContext = await ownerContext(db, context.get("ownerSession"));
    const issueId = parseIdentifier(context.req.param("issueId"), "issueId");
    const input = await parseBody(context, requestChangesSchema);
    return context.json({
      issue: await tracker.requestChanges(mutationContext, issueId, input),
    });
  });

  return router;
}
