import { z } from "zod";
import { assigneeFilterSchema } from "../assignee-projection.js";
import { issuePriorityValues, issueStatusValues } from "../db/schema.js";
import {
  DomainError,
  idempotencyKeySchema,
  questionVersionsSchema,
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
  requireAllowedIssue,
  result,
} from "./tool-context.js";

const issueCursorKeySchema = z
  .object({
    projectId: z.uuid(),
    number: z.number().int().positive(),
    id: z.uuid(),
  })
  .strict();

const activityCursorKeySchema = z
  .object({
    createdAt: z.iso.datetime().transform((value) => new Date(value)),
    id: z.string().min(1),
  })
  .strict();

export function registerIssueTools(context: IssopenMcpToolContext) {
  const { server, agents, idempotency, tracker, principal, allowedProjectIds } =
    context;
  const allowedIssue = (issueId: string) =>
    requireAllowedIssue(context, issueId);

  server.registerTool(
    "list_issues",
    {
      description:
        "List a bounded, compact page of active allowed issues with deterministic cursors and optional filters. Tickets inherited from an archived Epic are omitted until that Epic is restored.",
      inputSchema: z
        .object({
          projectId: z.uuid().optional(),
          epicId: z.uuid().optional(),
          status: z.enum(issueStatusValues).optional(),
          priority: z.enum(issuePriorityValues).optional(),
          claim: z.enum(["any", "claimed", "unclaimed", "mine"]).default("any"),
          assignee: assigneeFilterSchema
            .optional()
            .describe(
              "Human user ID or unassigned. Distinct from the agent claim; does not grant access.",
            ),
          limit: mcpPageLimitSchema,
          cursor: mcpCursorSchema,
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async ({
      projectId,
      epicId,
      status,
      priority,
      claim,
      assignee,
      limit,
      cursor,
    }) => {
      agents.requireScope(principal, "issues:read");
      if (projectId) agents.requireProject(principal, projectId);
      if (epicId) {
        const foundEpic = await tracker.getEpic(principal.workspaceId, epicId);
        agents.requireProject(principal, foundEpic.projectId);
        if (projectId && foundEpic.projectId !== projectId) {
          throw new DomainError("not_found", "Epic not found");
        }
      }
      const query = paginationQueryFingerprint({
        schemaVersion: 1,
        tool: "list_issues",
        allowedProjectIds,
        projectId: projectId ?? null,
        epicId: epicId ?? null,
        status: status ?? null,
        priority: priority ?? null,
        claim,
        assignee: assignee ?? null,
        agentId: claim === "mine" ? principal.agent.id : null,
      });
      const after = decodeMcpCursor(
        cursor,
        "issues",
        query,
        issueCursorKeySchema,
      );
      const page = await tracker.listIssuePage(principal.workspaceId, {
        projectIds: allowedProjectIds,
        claim,
        agentId: principal.agent.id,
        ...(assignee ? { assignee } : {}),
        limit,
        ...(projectId ? { projectId } : {}),
        ...(epicId ? { epicId } : {}),
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(after ? { after } : {}),
      });
      const last = page.items.at(-1);
      const nextCursor =
        page.hasMore && last
          ? encodeMcpCursor("issues", query, {
              projectId: last.projectId,
              number: last.number,
              id: last.id,
            })
          : null;
      return result({
        schemaVersion: 1,
        issues: page.items,
        page: mcpPage(page.items, limit, nextCursor),
      });
    },
  );

  server.registerTool(
    "create_issue",
    {
      description:
        "Create a backlog issue in one allowed project. The authenticated agent is recorded as the author.",
      inputSchema: z
        .object({
          idempotencyKey: idempotencyKeySchema,
          projectId: z.uuid(),
          epicId: z.uuid().nullable().optional(),
          title: z.string().trim().min(1).max(240),
          description: z.string().trim().max(50_000).default(""),
          priority: z.enum(issuePriorityValues).default("medium"),
        })
        .strict(),
      annotations: { destructiveHint: true },
    },
    async ({
      idempotencyKey,
      projectId,
      epicId,
      title,
      description,
      priority,
    }) => {
      agents.requireScope(principal, "issues:create");
      agents.requireProject(principal, projectId);
      if (epicId) {
        const foundEpic = await tracker.getEpic(principal.workspaceId, epicId);
        agents.requireProject(principal, foundEpic.projectId);
        if (foundEpic.projectId !== projectId) {
          throw new DomainError("not_found", "Epic not found");
        }
      }
      return result(
        await idempotency.execute(
          principal,
          "create_issue",
          idempotencyKey,
          { projectId, epicId: epicId ?? null, title, description, priority },
          async (transactionalTracker) => ({
            issue: await transactionalTracker.createIssue(
              mutationContext(principal),
              {
                projectId,
                epicId: epicId ?? null,
                title,
                description,
                priority,
                status: "backlog",
              },
            ),
          }),
        ),
      );
    },
  );

  server.registerTool(
    "get_issue",
    {
      description: "Get one allowed issue and its linked code results.",
      inputSchema: z.object({ issueId: z.uuid() }).strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ issueId }) => {
      agents.requireScope(principal, "issues:read");
      await allowedIssue(issueId);
      return result(
        await tracker.getIssueDetail(principal.workspaceId, issueId),
      );
    },
  );

  server.registerTool(
    "list_activity",
    {
      description:
        "List a bounded page of compact attributed activity for one allowed issue. Detailed changes remain outside list responses.",
      inputSchema: z
        .object({
          issueId: z.uuid(),
          limit: mcpPageLimitSchema,
          cursor: mcpCursorSchema,
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ issueId, limit, cursor }) => {
      agents.requireScope(principal, "issues:read");
      await allowedIssue(issueId);
      const query = paginationQueryFingerprint({
        schemaVersion: 1,
        tool: "list_activity",
        issueId,
      });
      const after = decodeMcpCursor(
        cursor,
        "activity",
        query,
        activityCursorKeySchema,
      );
      const page = await tracker.listActivityPage(
        principal.workspaceId,
        issueId,
        { limit, ...(after ? { after } : {}) },
      );
      const last = page.items.at(-1);
      const nextCursor =
        page.hasMore && last
          ? encodeMcpCursor("activity", query, {
              createdAt: last.createdAt,
              id: last.id,
            })
          : null;
      return result({
        schemaVersion: 1,
        activity: page.items,
        page: mcpPage(page.items, limit, nextCursor),
      });
    },
  );

  server.registerTool(
    "update_issue",
    {
      description:
        "Update bounded issue fields with expectedVersion and the complete questionVersions snapshot to reject stale plans. Use move_issue for workflow status.",
      inputSchema: z
        .object({
          idempotencyKey: idempotencyKeySchema,
          issueId: z.uuid(),
          title: z.string().trim().min(1).max(240).optional(),
          description: z.string().trim().max(50_000).optional(),
          priority: z.enum(issuePriorityValues).optional(),
          epicId: z.uuid().nullable().optional(),
          expectedVersion: z.number().int().positive().optional(),
          questionVersions: questionVersionsSchema.optional(),
        })
        .strict()
        .refine(
          ({
            issueId: _issueId,
            idempotencyKey: _idempotencyKey,
            ...changes
          }) =>
            Object.keys(changes).some(
              (key) => key !== "expectedVersion" && key !== "questionVersions",
            ),
          "At least one issue field is required",
        ),
      annotations: { destructiveHint: true },
    },
    async ({ idempotencyKey, issueId, ...changes }) => {
      agents.requireScope(principal, "issues:write");
      const foundIssue = await allowedIssue(issueId);
      if (changes.epicId) {
        const foundEpic = await tracker.getEpic(
          principal.workspaceId,
          changes.epicId,
        );
        agents.requireProject(principal, foundEpic.projectId);
        if (foundEpic.projectId !== foundIssue.projectId) {
          throw new DomainError("not_found", "Epic not found");
        }
      }
      return result(
        await idempotency.execute(
          principal,
          "update_issue",
          idempotencyKey,
          { issueId, ...changes },
          async (transactionalTracker) => ({
            issue: await transactionalTracker.updateIssue(
              mutationContext(principal),
              issueId,
              changes,
            ),
          }),
        ),
      );
    },
  );
}
