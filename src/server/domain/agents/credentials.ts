import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { agentCredential, agentIdentity } from "../../db/schema.js";
import { DomainError } from "../errors.js";
import {
  type CreateAgentCredentialInput,
  createAgentCredentialSchema,
} from "./contracts.js";
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

const maxActiveCredentialsPerAgent = 10;

export class AgentCredentialService {
  constructor(private readonly db: Database) {}

  async create(
    workspaceId: string,
    agentId: string,
    input: CreateAgentCredentialInput,
  ) {
    const parsed = createAgentCredentialSchema.safeParse(input);
    if (!parsed.success) {
      throw new DomainError(
        "invalid",
        "Invalid credential input",
        fieldsFromError(parsed.error),
      );
    }

    const token = generateAgentToken();
    const tokenHash = await hashAgentToken(token);
    const fingerprint = agentTokenFingerprint(token);
    const now = new Date();

    try {
      const credential = await this.db.transaction(async (tx) => {
        const [identity] = await tx
          .select({
            id: agentIdentity.id,
            oauthClientId: agentIdentity.oauthClientId,
            revokedAt: agentIdentity.revokedAt,
          })
          .from(agentIdentity)
          .where(
            and(
              eq(agentIdentity.workspaceId, workspaceId),
              eq(agentIdentity.id, agentId),
            ),
          )
          .for("update")
          .limit(1);
        if (!identity) throw new DomainError("not_found", "Agent not found");
        if (identity.oauthClientId) {
          throw new DomainError("conflict", "OAuth agents do not use API keys");
        }
        if (identity.revokedAt) {
          throw new DomainError(
            "conflict",
            "Revoked agent access cannot receive new API keys",
          );
        }

        const activeCredentials = await tx
          .select({ id: agentCredential.id })
          .from(agentCredential)
          .where(
            and(
              eq(agentCredential.workspaceId, workspaceId),
              eq(agentCredential.agentId, agentId),
              isNull(agentCredential.revokedAt),
              or(
                isNull(agentCredential.expiresAt),
                gt(agentCredential.expiresAt, now),
              ),
            ),
          );
        if (activeCredentials.length >= maxActiveCredentialsPerAgent) {
          throw new DomainError(
            "conflict",
            `An agent can have at most ${maxActiveCredentialsPerAgent} active API keys`,
          );
        }

        const [created] = await tx
          .insert(agentCredential)
          .values({
            id: randomUUID(),
            agentId,
            workspaceId,
            label: parsed.data.label,
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
        if (!created)
          throw new Error("Agent credential insert returned no row");
        return created;
      });
      return { credential, token };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(
          "conflict",
          "This agent already has an API key with that label",
        );
      }
      throw error;
    }
  }

  async revoke(workspaceId: string, agentId: string, credentialId: string) {
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
    if (identity.oauthClientId) {
      throw new DomainError("conflict", "OAuth agents do not use API keys");
    }

    const [credential] = await this.db
      .select({ id: agentCredential.id })
      .from(agentCredential)
      .where(
        and(
          eq(agentCredential.workspaceId, workspaceId),
          eq(agentCredential.agentId, agentId),
          eq(agentCredential.id, credentialId),
        ),
      )
      .limit(1);
    if (!credential) throw new DomainError("not_found", "Credential not found");

    const now = new Date();
    await this.db
      .update(agentCredential)
      .set({ revokedAt: now })
      .where(
        and(
          eq(agentCredential.workspaceId, workspaceId),
          eq(agentCredential.agentId, agentId),
          eq(agentCredential.id, credentialId),
          isNull(agentCredential.revokedAt),
        ),
      );
    const [revoked] = await this.db
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
      .where(eq(agentCredential.id, credentialId))
      .limit(1);
    if (!revoked) throw new DomainError("not_found", "Credential not found");
    return revoked;
  }
}
