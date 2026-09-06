import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  notInArray,
  or,
} from "drizzle-orm";
import type { ZodError } from "zod";
import type { Database } from "../../db/client.js";
import {
  agentCredential,
  agentIdentity,
  agentProject,
  agentScope,
  oauthAccessToken,
  oauthConsent,
  oauthRefreshToken,
  project,
  workspace,
} from "../../db/schema.js";
import { DomainError } from "../errors.js";
import {
  type AgentPrincipal,
  type AgentScope,
  agentScopeSchema,
  type CreateAgentInput,
  createAgentSchema,
  type UpdateAgentAccessInput,
  updateAgentAccessSchema,
} from "./contracts.js";
import {
  agentTokenFingerprint,
  generateAgentToken,
  hashAgentToken,
  isAgentTokenShape,
  verifyAgentToken,
} from "./secrets.js";

export class AgentAuthenticationError extends Error {
  override readonly name = "AgentAuthenticationError";
}

function fieldsFromError(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "request",
    message: issue.message,
  }));
}

function expiresAt(days: 7 | 30 | 90 | null, now: Date) {
  return days === null ? null : new Date(now.getTime() + days * 86_400_000);
}

export class AgentService {
  constructor(private readonly db: Database) {}

  async createAgent(workspaceId: string, input: CreateAgentInput) {
    const parsed = createAgentSchema.safeParse(input);
    if (!parsed.success) {
      throw new DomainError(
        "invalid",
        "Invalid agent input",
        fieldsFromError(parsed.error),
      );
    }

    const allowedProjects = await this.db
      .select({ id: project.id })
      .from(project)
      .where(
        and(
          eq(project.workspaceId, workspaceId),
          inArray(project.id, parsed.data.projectIds),
        ),
      );
    if (allowedProjects.length !== parsed.data.projectIds.length) {
      throw new DomainError("not_found", "Project not found");
    }

    const token = generateAgentToken();
    const tokenHash = await hashAgentToken(token);
    const fingerprint = agentTokenFingerprint(token);
    const now = new Date();

    try {
      const created = await this.db.transaction(async (tx) => {
        const [identity] = await tx
          .insert(agentIdentity)
          .values({
            id: randomUUID(),
            workspaceId,
            name: parsed.data.name,
            description: parsed.data.description,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!identity) throw new Error("Agent identity insert returned no row");

        await tx.insert(agentProject).values(
          parsed.data.projectIds.map((projectId) => ({
            agentId: identity.id,
            workspaceId,
            projectId,
          })),
        );
        await tx.insert(agentScope).values(
          parsed.data.scopes.map((scope) => ({
            agentId: identity.id,
            workspaceId,
            scope,
          })),
        );
        const [credential] = await tx
          .insert(agentCredential)
          .values({
            id: randomUUID(),
            agentId: identity.id,
            workspaceId,
            tokenHash,
            fingerprint,
            expiresAt: expiresAt(parsed.data.expiresInDays, now),
            createdAt: now,
          })
          .returning({
            id: agentCredential.id,
            fingerprint: agentCredential.fingerprint,
            expiresAt: agentCredential.expiresAt,
            revokedAt: agentCredential.revokedAt,
            lastUsedAt: agentCredential.lastUsedAt,
            createdAt: agentCredential.createdAt,
          });
        if (!credential)
          throw new Error("Agent credential insert returned no row");
        return { identity, credential };
      });

      return {
        agent: {
          id: created.identity.id,
          name: created.identity.name,
          description: created.identity.description,
          projectIds: parsed.data.projectIds,
          scopes: parsed.data.scopes,
          credential: created.credential,
          createdAt: created.identity.createdAt,
        },
        token,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new DomainError("conflict", "Agent name is already in use");
      }
      throw error;
    }
  }

  async listAgents(workspaceId: string) {
    const [personalWorkspace] = await this.db
      .select({ ownerId: workspace.ownerId })
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1);
    const identities = await this.db
      .select({
        id: agentIdentity.id,
        name: agentIdentity.name,
        description: agentIdentity.description,
        oauthClientId: agentIdentity.oauthClientId,
        lastUsedAt: agentIdentity.lastUsedAt,
        revokedAt: agentIdentity.revokedAt,
        createdAt: agentIdentity.createdAt,
      })
      .from(agentIdentity)
      .where(eq(agentIdentity.workspaceId, workspaceId))
      .orderBy(asc(agentIdentity.createdAt), asc(agentIdentity.name));

    return Promise.all(
      identities.map(async (identity) => {
        const [projects, scopes, credentials, oauthTokens] = await Promise.all([
          this.db
            .select({ id: project.id, name: project.name, key: project.key })
            .from(agentProject)
            .innerJoin(project, eq(agentProject.projectId, project.id))
            .where(
              and(
                eq(agentProject.workspaceId, workspaceId),
                eq(agentProject.agentId, identity.id),
              ),
            )
            .orderBy(asc(project.name)),
          this.db
            .select({ scope: agentScope.scope })
            .from(agentScope)
            .where(
              and(
                eq(agentScope.workspaceId, workspaceId),
                eq(agentScope.agentId, identity.id),
              ),
            ),
          this.db
            .select({
              id: agentCredential.id,
              fingerprint: agentCredential.fingerprint,
              expiresAt: agentCredential.expiresAt,
              revokedAt: agentCredential.revokedAt,
              lastUsedAt: agentCredential.lastUsedAt,
              createdAt: agentCredential.createdAt,
            })
            .from(agentCredential)
            .where(
              and(
                eq(agentCredential.workspaceId, workspaceId),
                eq(agentCredential.agentId, identity.id),
              ),
            )
            .limit(1),
          identity.oauthClientId && personalWorkspace
            ? this.db
                .select({
                  expiresAt: oauthAccessToken.expiresAt,
                  revokedAt: oauthAccessToken.revoked,
                  createdAt: oauthAccessToken.createdAt,
                })
                .from(oauthAccessToken)
                .where(
                  and(
                    eq(oauthAccessToken.clientId, identity.oauthClientId),
                    eq(oauthAccessToken.userId, personalWorkspace.ownerId),
                  ),
                )
                .orderBy(desc(oauthAccessToken.createdAt))
                .limit(1)
            : Promise.resolve([]),
        ]);
        const credential = credentials[0] ?? null;
        const oauthToken = oauthTokens[0] ?? null;
        const kind = identity.oauthClientId ? "oauth" : "pat";
        return {
          id: identity.id,
          name: identity.name,
          description: identity.description,
          projects,
          projectIds: projects.map((item) => item.id),
          scopes: scopes.map((item) => item.scope),
          credential,
          access: {
            kind,
            expiresAt: credential?.expiresAt ?? oauthToken?.expiresAt ?? null,
            revokedAt:
              identity.revokedAt ??
              credential?.revokedAt ??
              oauthToken?.revokedAt ??
              null,
            lastUsedAt: identity.lastUsedAt ?? credential?.lastUsedAt ?? null,
          },
          createdAt: identity.createdAt,
        };
      }),
    );
  }

  async getAgent(workspaceId: string, agentId: string) {
    const found = (await this.listAgents(workspaceId)).find(
      (agent) => agent.id === agentId,
    );
    if (!found) throw new DomainError("not_found", "Agent not found");
    return found;
  }

  async updateAgentAccess(
    workspaceId: string,
    agentId: string,
    input: UpdateAgentAccessInput,
  ) {
    const parsed = updateAgentAccessSchema.safeParse(input);
    if (!parsed.success) {
      throw new DomainError(
        "invalid",
        "Invalid agent access",
        fieldsFromError(parsed.error),
      );
    }

    const [identity] = await this.db
      .select({ id: agentIdentity.id, revokedAt: agentIdentity.revokedAt })
      .from(agentIdentity)
      .where(
        and(
          eq(agentIdentity.workspaceId, workspaceId),
          eq(agentIdentity.id, agentId),
        ),
      )
      .limit(1);
    if (!identity) throw new DomainError("not_found", "Agent not found");
    if (identity.revokedAt) {
      throw new DomainError(
        "conflict",
        "Revoked agent access cannot be edited",
      );
    }

    const [currentProjects, currentScopes] = await Promise.all([
      this.db
        .select({ projectId: agentProject.projectId })
        .from(agentProject)
        .where(
          and(
            eq(agentProject.workspaceId, workspaceId),
            eq(agentProject.agentId, agentId),
          ),
        ),
      this.db
        .select({ scope: agentScope.scope })
        .from(agentScope)
        .where(
          and(
            eq(agentScope.workspaceId, workspaceId),
            eq(agentScope.agentId, agentId),
          ),
        ),
    ]);
    const currentProjectIds = new Set(
      currentProjects.map((item) => item.projectId),
    );
    const currentScopeValues = new Set(currentScopes.map((item) => item.scope));
    if (
      parsed.data.projectIds.some(
        (projectId) => !currentProjectIds.has(projectId),
      ) ||
      parsed.data.scopes.some((scope) => !currentScopeValues.has(scope))
    ) {
      throw new DomainError(
        "forbidden",
        "Existing access may only be reduced; create a new grant to expand it",
      );
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(agentProject)
        .where(
          and(
            eq(agentProject.workspaceId, workspaceId),
            eq(agentProject.agentId, agentId),
            notInArray(agentProject.projectId, parsed.data.projectIds),
          ),
        );
      await tx
        .delete(agentScope)
        .where(
          and(
            eq(agentScope.workspaceId, workspaceId),
            eq(agentScope.agentId, agentId),
            notInArray(agentScope.scope, parsed.data.scopes),
          ),
        );
      await tx
        .update(agentIdentity)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(agentIdentity.workspaceId, workspaceId),
            eq(agentIdentity.id, agentId),
            isNull(agentIdentity.revokedAt),
          ),
        );
    });
    return this.getAgent(workspaceId, agentId);
  }

  async revokeAgentAccess(workspaceId: string, agentId: string) {
    const [identity] = await this.db
      .select({
        id: agentIdentity.id,
        oauthClientId: agentIdentity.oauthClientId,
      })
      .from(agentIdentity)
      .where(
        and(
          eq(agentIdentity.workspaceId, workspaceId),
          eq(agentIdentity.id, agentId),
        ),
      )
      .limit(1);
    if (!identity) throw new DomainError("not_found", "Agent not found");
    const [personalWorkspace] = await this.db
      .select({ ownerId: workspace.ownerId })
      .from(workspace)
      .where(eq(workspace.id, workspaceId))
      .limit(1);
    if (!personalWorkspace)
      throw new DomainError("not_found", "Workspace not found");

    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(agentIdentity)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(agentIdentity.workspaceId, workspaceId),
            eq(agentIdentity.id, agentId),
            isNull(agentIdentity.revokedAt),
          ),
        );
      await tx
        .update(agentCredential)
        .set({ revokedAt: now })
        .where(
          and(
            eq(agentCredential.workspaceId, workspaceId),
            eq(agentCredential.agentId, agentId),
            isNull(agentCredential.revokedAt),
          ),
        );
      if (identity.oauthClientId) {
        await Promise.all([
          tx
            .update(oauthAccessToken)
            .set({ revoked: now })
            .where(
              and(
                eq(oauthAccessToken.clientId, identity.oauthClientId),
                eq(oauthAccessToken.userId, personalWorkspace.ownerId),
                isNull(oauthAccessToken.revoked),
              ),
            ),
          tx
            .update(oauthRefreshToken)
            .set({ revoked: now })
            .where(
              and(
                eq(oauthRefreshToken.clientId, identity.oauthClientId),
                eq(oauthRefreshToken.userId, personalWorkspace.ownerId),
                isNull(oauthRefreshToken.revoked),
              ),
            ),
          tx
            .delete(oauthConsent)
            .where(
              and(
                eq(oauthConsent.clientId, identity.oauthClientId),
                eq(oauthConsent.userId, personalWorkspace.ownerId),
              ),
            ),
        ]);
      }
    });
    return this.getAgent(workspaceId, agentId);
  }

  async revokeCredential(workspaceId: string, agentId: string) {
    const revoked = await this.revokeAgentAccess(workspaceId, agentId);
    if (!revoked.credential) {
      throw new DomainError("not_found", "Credential not found");
    }
    return revoked.credential;
  }

  async resolvePat(token: string): Promise<AgentPrincipal> {
    if (!isAgentTokenShape(token))
      throw new AgentAuthenticationError("Invalid agent credential");
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
    if (!active)
      throw new AgentAuthenticationError("Agent credential is unavailable");
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
    if (!personalWorkspace)
      throw new AgentAuthenticationError("OAuth owner has no workspace");

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

  requireScope(principal: AgentPrincipal, scope: AgentScope) {
    if (!principal.scopes.has(scope))
      throw new DomainError("forbidden", "Agent scope is required");
  }

  requireProject(principal: AgentPrincipal, projectId: string) {
    if (!principal.projectIds.has(projectId))
      throw new DomainError("not_found", "Project not found");
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;
    if ("code" in error && error.code === "23505") return true;
    return "cause" in error && this.isUniqueViolation(error.cause);
  }
}
