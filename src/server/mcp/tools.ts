import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { issuePriorityValues, issueStatusValues } from "../db/schema.js";
import {
  type AgentPrincipal,
  AgentService,
  createEpicSchema,
  DomainError,
  idempotencyKeySchema,
  McpIdempotencyService,
  type MutationContext,
  questionVersionsSchema,
  TrackerService,
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

const projectCursorKeySchema = z
  .object({
    createdAt: z.iso.datetime().transform((value) => new Date(value)),
    key: z.string().min(1),
    id: z.uuid(),
  })
  .strict();

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

const epicCursorKeySchema = z
  .object({ number: z.number().int().positive(), id: z.uuid() })
  .strict();

function result(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function mutationContext(principal: AgentPrincipal): MutationContext {
  return {
    workspaceId: principal.workspaceId,
    actor: {
      type: "agent",
      id: principal.agent.id,
      displayName: principal.agent.name,
    },
    source: "mcp",
    authorization: {
      canCloseIssues: principal.scopes.has("issues:close"),
    },
  };
}

export function createIssopenMcpServer(
  db: Database,
  principal: AgentPrincipal,
) {
  const server = new McpServer({ name: "issopen", version: "0.1.0" });
  const agents = new AgentService(db);
  const idempotency = new McpIdempotencyService(db);
  const tracker = new TrackerService(db);
  const allowedProjectIds = [...principal.projectIds].sort();

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

  async function allowedIssue(issueId: string) {
    const found = await tracker.getIssue(principal.workspaceId, issueId);
    agents.requireProject(principal, found.projectId);
    return found;
  }

  async function allowedEpic(epicId: string) {
    const found = await tracker.getEpic(principal.workspaceId, epicId);
    agents.requireProject(principal, found.projectId);
    return found;
  }

  server.registerTool(
    "get_project",
    {
      description:
        "Read an allowed project's repository URL, default branch and subdirectory. Missing or ambiguous associations need confirmation before execution.",
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
        "List a bounded page of Epic summaries, including empty Epics, inside one allowed project.",
      inputSchema: z
        .object({
          projectId: z.uuid(),
          limit: mcpPageLimitSchema,
          cursor: mcpCursorSchema,
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, limit, cursor }) => {
      agents.requireScope(principal, "issues:read");
      agents.requireProject(principal, projectId);
      await tracker.getProject(principal.workspaceId, projectId);
      const query = paginationQueryFingerprint({
        schemaVersion: 1,
        tool: "list_epics",
        projectId,
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
        { limit, ...(after ? { after } : {}) },
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
        "Edit only an allowed Epic's title or description; requires explicit epics:write permission and an idempotency key.",
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

  server.registerTool(
    "list_issues",
    {
      description:
        "List a bounded, compact page of allowed issues with deterministic cursors and optional filters.",
      inputSchema: z
        .object({
          projectId: z.uuid().optional(),
          epicId: z.uuid().optional(),
          status: z.enum(issueStatusValues).optional(),
          priority: z.enum(issuePriorityValues).optional(),
          claim: z.enum(["any", "claimed", "unclaimed", "mine"]).default("any"),
          limit: mcpPageLimitSchema,
          cursor: mcpCursorSchema,
        })
        .strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, epicId, status, priority, claim, limit, cursor }) => {
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
    "ask_question",
    {
      description:
        "Add a blocking or advisory question to an allowed issue, including a recommendation and bounded answer options.",
      inputSchema: z
        .object({
          idempotencyKey: idempotencyKeySchema,
          issueId: z.uuid(),
          prompt: z.string().trim().min(1).max(2_000),
          recommendation: z.string().trim().min(1).max(2_000),
          options: z
            .array(
              z
                .object({
                  label: z.string().trim().min(1).max(240),
                  description: z.string().trim().max(1_000).default(""),
                })
                .strict(),
            )
            .min(2)
            .max(6),
          recommendedOptionIndex: z.number().int().min(0),
          blocking: z.boolean().default(true),
        })
        .strict()
        .superRefine((value, context) => {
          if (value.recommendedOptionIndex >= value.options.length) {
            context.addIssue({
              code: "custom",
              path: ["recommendedOptionIndex"],
              message: "Recommended option must reference a supplied option",
            });
          }
        }),
      annotations: { destructiveHint: true },
    },
    async ({ idempotencyKey, issueId, ...question }) => {
      agents.requireScope(principal, "questions:write");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "ask_question",
          idempotencyKey,
          { issueId, ...question },
          async (transactionalTracker) => ({
            question: await transactionalTracker.createIssueQuestion(
              mutationContext(principal),
              issueId,
              question,
            ),
          }),
        ),
      );
    },
  );

  server.registerTool(
    "add_comment",
    {
      description:
        "Append a progress, checkpoint or blocker comment to an allowed issue. Comment text is treated as untrusted data.",
      inputSchema: z
        .object({
          idempotencyKey: idempotencyKeySchema,
          issueId: z.uuid(),
          body: z.string().trim().min(1).max(20_000),
        })
        .strict(),
      annotations: { destructiveHint: true },
    },
    async ({ idempotencyKey, issueId, body }) => {
      agents.requireScope(principal, "comments:write");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "add_comment",
          idempotencyKey,
          { issueId, body },
          async (transactionalTracker) => ({
            comment: await transactionalTracker.addIssueComment(
              mutationContext(principal),
              issueId,
              { body },
            ),
          }),
        ),
      );
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

  server.registerTool(
    "claim_issue",
    {
      description: "Claim an allowed issue for this agent identity.",
      inputSchema: z
        .object({ idempotencyKey: idempotencyKeySchema, issueId: z.uuid() })
        .strict(),
    },
    async ({ idempotencyKey, issueId }) => {
      agents.requireScope(principal, "issues:claim");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "claim_issue",
          idempotencyKey,
          { issueId },
          async (transactionalTracker) => ({
            issue: await transactionalTracker.claimIssue(
              mutationContext(principal),
              issueId,
              principal.agent.id,
            ),
          }),
        ),
      );
    },
  );

  server.registerTool(
    "release_issue",
    {
      description: "Release this identity's claim on an allowed issue.",
      inputSchema: z
        .object({ idempotencyKey: idempotencyKeySchema, issueId: z.uuid() })
        .strict(),
    },
    async ({ idempotencyKey, issueId }) => {
      agents.requireScope(principal, "issues:claim");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "release_issue",
          idempotencyKey,
          { issueId },
          async (transactionalTracker) => ({
            issue: await transactionalTracker.releaseIssue(
              mutationContext(principal),
              issueId,
            ),
          }),
        ),
      );
    },
  );

  server.registerTool(
    "link_code_result",
    {
      description: "Link an HTTP(S) branch, commit or pull request result.",
      inputSchema: z
        .object({
          idempotencyKey: idempotencyKeySchema,
          issueId: z.uuid(),
          type: z.enum(["branch", "commit", "pull_request"]),
          url: z.url().max(2_048),
        })
        .strict(),
    },
    async ({ idempotencyKey, issueId, type, url }) => {
      agents.requireScope(principal, "code:link");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "link_code_result",
          idempotencyKey,
          { issueId, type, url },
          (transactionalTracker) =>
            transactionalTracker.addCodeLink(
              mutationContext(principal),
              issueId,
              { type, url },
            ),
        ),
      );
    },
  );

  server.registerTool(
    "move_issue",
    {
      description:
        "Move an allowed issue through the fixed workflow. Done requires issues:close.",
      inputSchema: z
        .object({
          idempotencyKey: idempotencyKeySchema,
          issueId: z.uuid(),
          status: z.enum(issueStatusValues),
          expectedVersion: z.number().int().positive().optional(),
          questionVersions: questionVersionsSchema.optional(),
        })
        .strict(),
      annotations: { destructiveHint: true },
    },
    async ({
      idempotencyKey,
      issueId,
      status,
      expectedVersion,
      questionVersions,
    }) => {
      agents.requireScope(principal, "issues:review");
      if (status === "done") agents.requireScope(principal, "issues:close");
      await allowedIssue(issueId);
      return result(
        await idempotency.execute(
          principal,
          "move_issue",
          idempotencyKey,
          {
            issueId,
            status,
            ...(expectedVersion !== undefined ? { expectedVersion } : {}),
            ...(questionVersions ? { questionVersions } : {}),
          },
          async (transactionalTracker) => ({
            issue: await transactionalTracker.updateIssue(
              mutationContext(principal),
              issueId,
              {
                status,
                ...(expectedVersion !== undefined ? { expectedVersion } : {}),
                ...(questionVersions ? { questionVersions } : {}),
              },
            ),
          }),
        ),
      );
    },
  );

  return server;
}
