import { and, eq, isNull, notInArray } from "drizzle-orm";
import type { Database } from "../../db/client.js";
import { agentIdentity, agentProject, agentScope } from "../../db/schema.js";
import { DomainError } from "../errors.js";
import type {
  AgentPrincipal,
  AgentScope,
  UpdateAgentAccessInput,
} from "./contracts.js";
import { updateAgentAccessSchema } from "./contracts.js";
import type { AgentIdentityService } from "./identities.js";
import { fieldsFromError } from "./support.js";

export class AgentGrantService {
  constructor(
    private readonly db: Database,
    private readonly identities: AgentIdentityService,
  ) {}

  async update(
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
    return this.identities.get(workspaceId, agentId);
  }

  requireScope(principal: AgentPrincipal, scope: AgentScope) {
    if (!principal.scopes.has(scope)) {
      throw new DomainError("forbidden", "Agent scope is required");
    }
  }

  requireProject(principal: AgentPrincipal, projectId: string) {
    if (!principal.projectIds.has(projectId)) {
      throw new DomainError("not_found", "Project not found");
    }
  }
}
