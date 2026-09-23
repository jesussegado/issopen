import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
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
import { type CreateAgentInput, createAgentSchema } from "./contracts.js";
import {
  agentTokenFingerprint,
  generateAgentToken,
  hashAgentToken,
} from "./secrets.js";
import {
  agentCredentialExpiresAt,
  fieldsFromError,
  isUniqueViolation,
} from "./support.js";

export class AgentIdentityService {
  constructor(private readonly db: Database) {}

  async create(workspaceId: string, input: CreateAgentInput) {
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
            label: "Primary",
            tokenHash,
            fingerprint,
            expiresAt: agentCredentialExpiresAt(parsed.data.expiresInDays, now),
            createdAt: now,
          })
          .returning({
            id: agentCredential.id,
            label: agentCredential.label,
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
          credentials: [created.credential],
          createdAt: created.identity.createdAt,
        },
        token,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError("conflict", "Agent name is already in use");
      }
      throw error;
    }
  }

  async list(workspaceId: string) {
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
              label: agentCredential.label,
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
            .orderBy(asc(agentCredential.createdAt)),
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
          credentials,
          access: {
            kind,
            expiresAt:
              kind === "oauth" ? (oauthToken?.expiresAt ?? null) : null,
            revokedAt:
              identity.revokedAt ??
              (kind === "oauth" ? (oauthToken?.revokedAt ?? null) : null),
            lastUsedAt: identity.lastUsedAt ?? null,
          },
          createdAt: identity.createdAt,
        };
      }),
    );
  }

  async get(workspaceId: string, agentId: string) {
    const found = (await this.list(workspaceId)).find(
      (agent) => agent.id === agentId,
    );
    if (!found) throw new DomainError("not_found", "Agent not found");
    return found;
  }

  async revoke(workspaceId: string, agentId: string) {
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
    return this.get(workspaceId, agentId);
  }
}
