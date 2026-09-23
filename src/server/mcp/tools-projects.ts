import { z } from "zod";
import {
  createEpicSchema,
  epicArchiveFilterSchema,
  idempotencyKeySchema,
  updateEpicSchema,
} from "../domain/index.js";
import {
  decodeMcpCursor,
  encodeMcpCursor,
  mcpCursorSchema,
  mcpPage,
  mcpPageLimitSchema,
  paginationQueryFingerprint,
} from "./pagination.js";
import {
  type IssopenMcpToolContext,
  mutationContext,
  requireAllowedEpic,
  result,
} from "./tool-context.js";

const projectCursorKeySchema = z
  .object({
    createdAt: z.iso.datetime().transform((value) => new Date(value)),
    key: z.string().min(1),
    id: z.uuid(),
  })
  .strict();

const epicCursorKeySchema = z
  .object({ number: z.number().int().positive(), id: z.uuid() })
  .strict();

export function registerProjectTools(context: IssopenMcpToolContext) {
  const { server, agents, idempotency, tracker, principal, allowedProjectIds } =
    context;
  const allowedEpic = (epicId: string) => requireAllowedEpic(context, epicId);

  server.registerTool(
    "get_agent_context",
    {
      description:
        "Return only this authenticated agent's effective identity, scopes and project allowlist. Tool discovery is not permission to execute tools.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
    },
    async () =>
      result({
        schemaVersion: 1,
        agent: principal.agent,
        workspaceId: principal.workspaceId,
        scopes: [...principal.scopes].sort(),
        projectIds: allowedProjectIds,
      }),
  );

  server.registerTool(
    "get_project",
    {
      description:
        "Read an allowed project's repository context and effective completion workflow. Missing or ambiguous associations need confirmation before execution.",
      inputSchema: z.object({ projectId: z.uuid() }).strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId }) => {
      agents.requireScope(principal, "issues:read");
      agents.requireProject(principal, projectId);
      const found = await tracker.getProject(principal.workspaceId, projectId);
      const {
        id,
        key,
        name,
        description,
        repositoryUrl,
        defaultBranch,
        repositorySubdirectory,
        showReviewColumn,
        showDoneColumn,
        version,
        createdAt,
        updatedAt,
      } = found;
      return result({
        schemaVersion: 1,
        project: {
          id,
          key,
          name,
          description,
          repositoryUrl,
          defaultBranch,
          repositorySubdirectory,
          showReviewColumn,
          showDoneColumn,
          workflow: {
            humanReviewRequired: showReviewColumn,
            completionStatus: showReviewColumn ? "ready_for_review" : "done",
            completionRequiresScope: showReviewColumn
              ? "issues:review"
              : "issues:close",
          },
          version,
          createdAt,
          updatedAt,
        },
      });
    },
  );

  server.registerTool(
    "list_epics",
    {
      description:
        "List a bounded page of Epic summaries, including empty Epics, inside one allowed project. Active Epics are returned by default; request archived or all explicitly.",
      inputSchema: z
        .object({
          projectId: z.uuid(),
          archived: epicArchiveFilterSchema.default("active"),
          limit: mcpPageLimitSchema,
          cursor: mcpCursorSchema,
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, archived, limit, cursor }) => {
      agents.requireScope(principal, "issues:read");
      agents.requireProject(principal, projectId);
      await tracker.getProject(principal.workspaceId, projectId);
      const query = paginationQueryFingerprint({
        schemaVersion: 1,
        tool: "list_epics",
        projectId,
        archived,
        allowedProjectIds,
      });
      const after = decodeMcpCursor(
        cursor,
        "epics",
        query,
        epicCursorKeySchema,
      );
      const page = await tracker.listEpicPage(
        principal.workspaceId,
        projectId,
        { limit, archive: archived, ...(after ? { after } : {}) },
      );
      const last = page.items.at(-1);
      const nextCursor =
        page.hasMore && last
          ? encodeMcpCursor("epics", query, {
              number: last.number,
              id: last.id,
            })
          : null;
      return result({
        schemaVersion: 1,
        epics: page.items,
        page: mcpPage(page.items, limit, nextCursor),
      });
    },
  );

  server.registerTool(
    "get_epic",
    {
      description:
        "Read one allowed Epic and aggregate progress; page its tickets separately with list_issues(epicId).",
      inputSchema: z.object({ epicId: z.uuid() }).strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ epicId }) => {
      agents.requireScope(principal, "issues:read");
      await allowedEpic(epicId);
      return result({
        schemaVersion: 1,
        epic: await tracker.getEpicSummary(principal.workspaceId, epicId),
      });
    },
  );

  server.registerTool(
    "create_epic",
    {
      description:
        "Create an Epic in one allowed project; requires explicit epics:create permission and an idempotency key.",
      inputSchema: z
        .object({
          ...createEpicSchema.shape,
          idempotencyKey: idempotencyKeySchema,
        })
        .strict(),
    },
    async ({ idempotencyKey, ...input }) => {
      agents.requireScope(principal, "epics:create");
      agents.requireProject(principal, input.projectId);
      return result(
        await idempotency.execute(
          principal,
          "create_epic",
          idempotencyKey,
          input,
          async (transactionalTracker) => ({
            epic: await transactionalTracker.createEpic(
              mutationContext(principal),
              input,
            ),
          }),
        ),
      );
    },
  );

  server.registerTool(
    "update_epic",
    {
      description:
        "Edit an allowed Epic's title, description or archived state; requires explicit epics:write permission and an idempotency key.",
      inputSchema: z
        .object({
          ...updateEpicSchema.shape,
          epicId: z.uuid(),
          idempotencyKey: idempotencyKeySchema,
        })
        .strict(),
    },
    async ({ epicId, idempotencyKey, ...input }) => {
      agents.requireScope(principal, "epics:write");
      await allowedEpic(epicId);
      return result(
        await idempotency.execute(
          principal,
          "update_epic",
          idempotencyKey,
          { epicId, ...input },
          async (transactionalTracker) => ({
            epic: await transactionalTracker.updateEpic(
              mutationContext(principal),
              epicId,
              input,
            ),
          }),
        ),
      );
    },
  );

  server.registerTool(
    "list_projects",
    {
      description:
        "List a bounded page of projects this identity may access. Continue only with the returned opaque cursor.",
      inputSchema: z
        .object({ limit: mcpPageLimitSchema, cursor: mcpCursorSchema })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ limit, cursor }) => {
      agents.requireScope(principal, "issues:read");
      const query = paginationQueryFingerprint({
        schemaVersion: 1,
        tool: "list_projects",
        allowedProjectIds,
      });
      const after = decodeMcpCursor(
        cursor,
        "projects",
        query,
        projectCursorKeySchema,
      );
      const page = await tracker.listProjectPage(principal.workspaceId, {
        projectIds: allowedProjectIds,
        limit,
        ...(after ? { after } : {}),
      });
      const last = page.items.at(-1);
      const nextCursor =
        page.hasMore && last
          ? encodeMcpCursor("projects", query, {
              createdAt: last.createdAt,
              key: last.key,
              id: last.id,
            })
          : null;
      return result({
        schemaVersion: 1,
        projects: page.items,
        page: mcpPage(page.items, limit, nextCursor),
      });
    },
  );
}
