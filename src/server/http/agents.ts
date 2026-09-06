import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import { workspace } from "../db/schema.js";
import { AgentService, DomainError } from "../domain/index.js";

type AgentBindings = {
  Variables: { ownerSession: OwnerSession };
};

async function ownerWorkspaceId(db: Database, ownerSession: OwnerSession) {
  const [personalWorkspace] = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerId, ownerSession.user.id))
    .limit(1);
  if (!personalWorkspace) {
    throw new DomainError("not_found", "Workspace not found");
  }
  return personalWorkspace.id;
}

export function createAgentRouter({ db }: { db: Database }) {
  const router = new Hono<AgentBindings>();
  const agents = new AgentService(db);

  router.get("/agents", async (context) => {
    const workspaceId = await ownerWorkspaceId(db, context.get("ownerSession"));
    return context.json({ agents: await agents.listAgents(workspaceId) });
  });

  router.post("/agents", async (context) => {
    const workspaceId = await ownerWorkspaceId(db, context.get("ownerSession"));
    const input = await context.req.json().catch(() => null);
    const created = await agents.createAgent(workspaceId, input);
    return context.json(created, 201);
  });

  router.patch("/agents/:agentId/access", async (context) => {
    const parsedId = z.uuid().safeParse(context.req.param("agentId"));
    if (!parsedId.success) {
      throw new DomainError("invalid", "Invalid request", [
        { field: "agentId", message: "Must be a valid identifier" },
      ]);
    }
    const workspaceId = await ownerWorkspaceId(db, context.get("ownerSession"));
    const input = await context.req.json().catch(() => null);
    return context.json({
      agent: await agents.updateAgentAccess(workspaceId, parsedId.data, input),
    });
  });

  router.post("/agents/:agentId/revoke", async (context) => {
    const parsedId = z.uuid().safeParse(context.req.param("agentId"));
    if (!parsedId.success) {
      throw new DomainError("invalid", "Invalid request", [
        { field: "agentId", message: "Must be a valid identifier" },
      ]);
    }
    const workspaceId = await ownerWorkspaceId(db, context.get("ownerSession"));
    const agent = await agents.revokeAgentAccess(workspaceId, parsedId.data);
    return context.json({ agent, credential: agent.credential });
  });

  return router;
}
