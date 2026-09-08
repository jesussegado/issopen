import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { JWTPayload } from "jose";
import type { IssopenAuth } from "../auth.js";
import type { Database } from "../db/client.js";
import { agentTokenPrefix } from "../domain/agents/secrets.js";
import {
  AgentAuthenticationError,
  type AgentPrincipal,
  AgentService,
} from "../domain/index.js";
import { createIssopenMcpServer } from "./tools.js";

function bearer(request: Request) {
  const authorization = request.headers.get("Authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

function scopesFromClaims(claims: JWTPayload) {
  if (typeof claims.scope === "string")
    return claims.scope.split(" ").filter(Boolean);
  return Array.isArray(claims.scope)
    ? claims.scope.filter((scope): scope is string => typeof scope === "string")
    : [];
}

function oauthClientId(claims: JWTPayload) {
  if (typeof claims.client_id === "string") return claims.client_id;
  if (typeof claims.azp === "string") return claims.azp;
  throw new AgentAuthenticationError("OAuth token has no client identity");
}

function challenge(resource: string) {
  const metadata = new URL(
    `/.well-known/oauth-protected-resource${new URL(resource).pathname}`,
    resource,
  );
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Authentication required" },
      id: null,
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${metadata}", scope="issues:read"`,
      },
    },
  );
}

function serve(db: Database, principal: AgentPrincipal, request: Request) {
  const handler = createMcpHandler(
    () => createIssopenMcpServer(db, principal),
    // Codex native clients still use the 2025 initialize exchange. Both eras
    // remain POST-only, stateless and authenticated on every request.
    { legacy: "stateless", responseMode: "json" },
  );
  return handler.fetch(request, {
    authInfo: {
      token: "validated",
      clientId: principal.agent.id,
      scopes: [...principal.scopes],
      resource: new URL(request.url),
    },
  });
}

export function createIssopenMcpHandler({
  auth,
  db,
  resource,
}: {
  auth: IssopenAuth;
  db: Database;
  resource: string;
}) {
  const agents = new AgentService(db);
  const oauth = requireMcpAuth(
    auth,
    async (request, claims) => {
      if (typeof claims.sub !== "string") return challenge(resource);
      try {
        const principal = await agents.resolveOAuth(
          claims.sub,
          oauthClientId(claims),
          scopesFromClaims(claims),
        );
        return serve(db, principal, request);
      } catch (error) {
        if (error instanceof AgentAuthenticationError)
          return challenge(resource);
        throw error;
      }
    },
    { resource, challengeScopes: ["issues:read"] },
  );

  return async (request: Request) => {
    const token = bearer(request);
    if (token?.startsWith(agentTokenPrefix)) {
      try {
        return await serve(db, await agents.resolvePat(token), request);
      } catch (error) {
        if (error instanceof AgentAuthenticationError)
          return challenge(resource);
        throw error;
      }
    }
    return oauth(request);
  };
}
