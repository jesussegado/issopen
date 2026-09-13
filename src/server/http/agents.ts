import { Hono } from "hono";
import { z } from "zod";
import type { OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import { AgentService, DomainError } from "../domain/index.js";
import {
  type HumanAccess,
  requireHumanAccess,
  requireWorkspaceOwner,
} from "../human-access.js";

type AgentBindings = {
  Variables: {
    ownerSession: OwnerSession;
    humanAccess: HumanAccess | null;
  };
};

function ownerWorkspaceId(accessInput: HumanAccess | null) {
  const access = requireHumanAccess(accessInput);
  requireWorkspaceOwner(access);
  return access.workspaceId;
}

export function createAgentRouter({ db }: { db: Database }) {
  const router = new Hono<AgentBindings>();
  const agents = new AgentService(db);

  router.get("/agents", async (context) => {
    const workspaceId = ownerWorkspaceId(context.get("humanAccess"));
    return context.json({ agents: await agents.listAgents(workspaceId) });
  });

  router.post("/agents", async (context) => {
    const workspaceId = ownerWorkspaceId(context.get("humanAccess"));
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
    const workspaceId = ownerWorkspaceId(context.get("humanAccess"));
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
    const workspaceId = ownerWorkspaceId(context.get("humanAccess"));
    const agent = await agents.revokeAgentAccess(workspaceId, parsedId.data);
    return context.json({ agent, credential: agent.credential });
  });

  return router;
}
