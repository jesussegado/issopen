import { Hono } from "hono";
import { z } from "zod";
import type { OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import { AgentService } from "../domain/index.js";
import {
  type HumanAccess,
  requireHumanAccess,
  requireWorkspaceOwner,
} from "../human-access.js";
import {
  parseHttpInput,
  parseIdentifier,
  readJsonInput,
} from "./validation.js";

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
    const input =
      await readJsonInput<Parameters<AgentService["createAgent"]>[1]>(context);
    const created = await agents.createAgent(workspaceId, input);
    return context.json(created, 201);
  });

  router.patch("/agents/:agentId/access", async (context) => {
    const agentId = parseIdentifier(context.req.param("agentId"), "agentId");
    const workspaceId = ownerWorkspaceId(context.get("humanAccess"));
    const input =
      await readJsonInput<Parameters<AgentService["updateAgentAccess"]>[2]>(
        context,
      );
    return context.json({
      agent: await agents.updateAgentAccess(workspaceId, agentId, input),
    });
  });

  router.post("/agents/:agentId/credentials", async (context) => {
    const agentId = parseIdentifier(context.req.param("agentId"), "agentId");
    const workspaceId = ownerWorkspaceId(context.get("humanAccess"));
    const input =
      await readJsonInput<Parameters<AgentService["createCredential"]>[2]>(
        context,
      );
    const created = await agents.createCredential(workspaceId, agentId, input);
    return context.json(created, 201);
  });

  router.post(
    "/agents/:agentId/credentials/:credentialId/revoke",
    async (context) => {
      const parsed = parseHttpInput(
        z.object({ agentId: z.uuid(), credentialId: z.uuid() }),
        {
          agentId: context.req.param("agentId"),
          credentialId: context.req.param("credentialId"),
        },
        {
          fields: [
            { field: "credentialId", message: "Must be a valid identifier" },
          ],
        },
      );
      const workspaceId = ownerWorkspaceId(context.get("humanAccess"));
      return context.json({
        credential: await agents.revokeCredential(
          workspaceId,
          parsed.agentId,
          parsed.credentialId,
        ),
      });
    },
  );

  router.post("/agents/:agentId/revoke", async (context) => {
    const agentId = parseIdentifier(context.req.param("agentId"), "agentId");
    const workspaceId = ownerWorkspaceId(context.get("humanAccess"));
    const agent = await agents.revokeAgentAccess(workspaceId, agentId);
    return context.json({ agent, credential: agent.credential });
  });

  return router;
}
