import { McpServer } from "@modelcontextprotocol/server";
import type { Database } from "../db/client.js";
import type { AgentPrincipal } from "../domain/index.js";
import { createMcpToolContext } from "./tool-context.js";
import { registerDiscussionTools } from "./tools-discussion.js";
import { registerIssueTools } from "./tools-issues.js";
import { registerProjectTools } from "./tools-projects.js";
import { registerWorkflowTools } from "./tools-workflow.js";

export function createIssopenMcpServer(
  db: Database,
  principal: AgentPrincipal,
) {
  const server = new McpServer({ name: "issopen", version: "0.1.0" });
  const context = createMcpToolContext(server, db, principal);
  registerProjectTools(context);
  registerIssueTools(context);
  registerDiscussionTools(context);
  registerWorkflowTools(context);
  return server;
}
