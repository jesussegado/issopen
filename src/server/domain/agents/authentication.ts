import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import {
  agentCredential,
  agentIdentity,
  agentProject,
  agentScope,
  project,
  workspace,
} from "../../db/schema.js";
import {
  type AgentPrincipal,
  type AgentScope,
  agentScopeSchema,
} from "./contracts.js";
import {
  agentTokenFingerprint,
  isAgentTokenShape,
  verifyAgentToken,
} from "./secrets.js";

export class AgentAuthenticationError extends Error {
  override readonly name = "AgentAuthenticationError";
}

export class AgentAuthenticationService {
  constructor(private readonly db: Database) {}

  async resolvePat(token: string): Promise<AgentPrincipal> {
    if (!isAgentTokenShape(token)) {
      throw new AgentAuthenticationError("Invalid agent credential");
    }
    const fingerprint = agentTokenFingerprint(token);
    const [found] = await this.db
      .select({
        credentialId: agentCredential.id,
        tokenHash: agentCredential.tokenHash,
        agentId: agentIdentity.id,
        agentName: agentIdentity.name,
        workspaceId: agentIdentity.workspaceId,
        identityRevokedAt: agentIdentity.revokedAt,
      })
      .from(agentCredential)
      .innerJoin(agentIdentity, eq(agentCredential.agentId, agentIdentity.id))
      .where(eq(agentCredential.fingerprint, fingerprint))
      .limit(1);
    if (!found || !(await verifyAgentToken(found.tokenHash, token))) {
      throw new AgentAuthenticationError("Invalid agent credential");
    }
    if (found.identityRevokedAt) {
      throw new AgentAuthenticationError("Agent credential is unavailable");
    }

    const now = new Date();
    const [active] = await this.db
      .update(agentCredential)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(agentCredential.id, found.credentialId),
          isNull(agentCredential.revokedAt),
          or(
            isNull(agentCredential.expiresAt),
            gt(agentCredential.expiresAt, now),
          ),
        ),
      )
      .returning({ id: agentCredential.id });
    if (!active) {
      throw new AgentAuthenticationError("Agent credential is unavailable");
    }
    const [activeIdentity] = await this.db
      .update(agentIdentity)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(agentIdentity.id, found.agentId),
          eq(agentIdentity.workspaceId, found.workspaceId),
          isNull(agentIdentity.revokedAt),
        ),
      )
      .returning({ id: agentIdentity.id });
    if (!activeIdentity) {
      throw new AgentAuthenticationError("Agent credential is unavailable");
    }

    const [scopeRows, projectRows] = await Promise.all([
      this.db
        .select({ scope: agentScope.scope })
        .from(agentScope)
        .where(
          and(
            eq(agentScope.agentId, found.agentId),
            eq(agentScope.workspaceId, found.workspaceId),
          ),
        ),
      this.db
        .select({ projectId: agentProject.projectId })
        .from(agentProject)
        .where(
          and(
            eq(agentProject.agentId, found.agentId),
            eq(agentProject.workspaceId, found.workspaceId),
          ),
        ),
    ]);
    return {
      workspaceId: found.workspaceId,
      agent: { id: found.agentId, name: found.agentName },
      scopes: new Set(scopeRows.map((row) => row.scope)),
      projectIds: new Set(projectRows.map((row) => row.projectId)),
    };
  }

  async resolveOAuth(
    ownerId: string,
    clientId: string,
    grantedScopes: readonly string[],
  ): Promise<AgentPrincipal> {
    const [personalWorkspace] = await this.db
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.ownerId, ownerId))
      .limit(1);
    if (!personalWorkspace) {
      throw new AgentAuthenticationError("OAuth owner has no workspace");
    }

    const initialProjects = await this.db
      .select({ id: project.id })
      .from(project)
      .where(eq(project.workspaceId, personalWorkspace.id));
    const tokenScopes = grantedScopes.filter(
      (scope): scope is AgentScope => agentScopeSchema.safeParse(scope).success,
    );
    const tokenScopeSet = new Set(tokenScopes);

    const resolved = await this.db.transaction(async (tx) => {
      let [found] = await tx
        .select({
          id: agentIdentity.id,
          name: agentIdentity.name,
          revokedAt: agentIdentity.revokedAt,
        })
        .from(agentIdentity)
        .where(
          and(
            eq(agentIdentity.workspaceId, personalWorkspace.id),
            eq(agentIdentity.oauthClientId, clientId),
          ),
        )
        .limit(1);
      let created = false;
      if (!found) {
        [found] = await tx
          .insert(agentIdentity)
          .values({
            id: randomUUID(),
            workspaceId: personalWorkspace.id,
            oauthClientId: clientId,
            name: "ChatGPT",
            description: "OAuth MCP client",
          })
          .onConflictDoNothing()
          .returning({
            id: agentIdentity.id,
            name: agentIdentity.name,
            revokedAt: agentIdentity.revokedAt,
          });
        created = Boolean(found);
        if (!found) {
          [found] = await tx
            .select({
              id: agentIdentity.id,
              name: agentIdentity.name,
              revokedAt: agentIdentity.revokedAt,
            })
            .from(agentIdentity)
            .where(
              and(
                eq(agentIdentity.workspaceId, personalWorkspace.id),
                eq(agentIdentity.oauthClientId, clientId),
              ),
            )
            .limit(1);
        }
      }
      if (!found) throw new Error("OAuth agent identity was not created");
      if (found.revokedAt) {
        throw new AgentAuthenticationError("OAuth agent access is revoked");
      }

      if (created && initialProjects.length > 0) {
        await tx
          .insert(agentProject)
          .values(
            initialProjects.map((item) => ({
              agentId: found.id,
              workspaceId: personalWorkspace.id,
              projectId: item.id,
            })),
          )
          .onConflictDoNothing();
      }
      if (created && tokenScopes.length > 0) {
        await tx
          .insert(agentScope)
          .values(
            tokenScopes.map((scope) => ({
              agentId: found.id,
              workspaceId: personalWorkspace.id,
              scope,
            })),
          )
          .onConflictDoNothing();
      }
      const now = new Date();
      const [active] = await tx
        .update(agentIdentity)
        .set({ lastUsedAt: now })
        .where(
          and(
            eq(agentIdentity.id, found.id),
            eq(agentIdentity.workspaceId, personalWorkspace.id),
            isNull(agentIdentity.revokedAt),
          ),
        )
        .returning({ id: agentIdentity.id, name: agentIdentity.name });
      if (!active) {
        throw new AgentAuthenticationError("OAuth agent access is revoked");
      }
      const [scopeRows, projectRows] = await Promise.all([
        tx
          .select({ scope: agentScope.scope })
          .from(agentScope)
          .where(
            and(
              eq(agentScope.agentId, found.id),
              eq(agentScope.workspaceId, personalWorkspace.id),
            ),
          ),
        tx
          .select({ projectId: agentProject.projectId })
          .from(agentProject)
          .where(
            and(
              eq(agentProject.agentId, found.id),
              eq(agentProject.workspaceId, personalWorkspace.id),
            ),
          ),
      ]);
      return { identity: active, scopeRows, projectRows };
    });

    return {
      workspaceId: personalWorkspace.id,
      agent: resolved.identity,
      scopes: new Set(
        resolved.scopeRows
          .map((row) => row.scope)
          .filter((scope) => tokenScopeSet.has(scope)),
      ),
      projectIds: new Set(resolved.projectRows.map((item) => item.projectId)),
    };
  }
}
