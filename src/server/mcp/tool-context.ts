import type { McpServer } from "@modelcontextprotocol/server";
import type { Database } from "../db/client.js";
import {
  type AgentPrincipal,
  AgentService,
  McpIdempotencyService,
  type MutationContext,
  TrackerService,
} from "../domain/index.js";

export type IssopenMcpToolContext = {
  server: McpServer;
  principal: AgentPrincipal;
  agents: AgentService;
  idempotency: McpIdempotencyService;
  tracker: TrackerService;
  allowedProjectIds: string[];
};

export function createMcpToolContext(
  server: McpServer,
  db: Database,
  principal: AgentPrincipal,
): IssopenMcpToolContext {
  return {
    server,
    principal,
    agents: new AgentService(db),
    idempotency: new McpIdempotencyService(db),
    tracker: new TrackerService(db),
    allowedProjectIds: [...principal.projectIds].sort(),
  };
}

export function result(value: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

export function mutationContext(principal: AgentPrincipal): MutationContext {
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

export async function requireAllowedIssue(
  context: IssopenMcpToolContext,
  issueId: string,
) {
  const found = await context.tracker.getIssue(
    context.principal.workspaceId,
    issueId,
  );
  context.agents.requireProject(context.principal, found.projectId);
  return found;
}

export async function requireAllowedEpic(
  context: IssopenMcpToolContext,
  epicId: string,
) {
  const found = await context.tracker.getEpic(
    context.principal.workspaceId,
    epicId,
  );
  context.agents.requireProject(context.principal, found.projectId);
  return found;
}
