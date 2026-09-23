import type { Database } from "../../db/client.js";
import { AgentAuthenticationService } from "./authentication.js";
import type {
  AgentPrincipal,
  AgentScope,
  CreateAgentCredentialInput,
  CreateAgentInput,
  UpdateAgentAccessInput,
} from "./contracts.js";
import { AgentCredentialService } from "./credentials.js";
import { AgentGrantService } from "./grants.js";
import { AgentIdentityService } from "./identities.js";

export { AgentAuthenticationError } from "./authentication.js";

/**
 * Stable application facade for agent administration and authentication.
 * Capability services own their database rules; HTTP and MCP adapters only
 * depend on this public surface.
 */
export class AgentService {
  private readonly authentication: AgentAuthenticationService;
  private readonly credentials: AgentCredentialService;
  private readonly grants: AgentGrantService;
  private readonly identities: AgentIdentityService;

  constructor(db: Database) {
    this.identities = new AgentIdentityService(db);
    this.credentials = new AgentCredentialService(db);
    this.grants = new AgentGrantService(db, this.identities);
    this.authentication = new AgentAuthenticationService(db);
  }

  async createAgent(workspaceId: string, input: CreateAgentInput) {
    return this.identities.create(workspaceId, input);
  }

  async listAgents(workspaceId: string) {
    return this.identities.list(workspaceId);
  }

  async getAgent(workspaceId: string, agentId: string) {
    return this.identities.get(workspaceId, agentId);
  }

  async updateAgentAccess(
    workspaceId: string,
    agentId: string,
    input: UpdateAgentAccessInput,
  ) {
    return this.grants.update(workspaceId, agentId, input);
  }

  async revokeAgentAccess(workspaceId: string, agentId: string) {
    return this.identities.revoke(workspaceId, agentId);
  }

  async createCredential(
    workspaceId: string,
    agentId: string,
    input: CreateAgentCredentialInput,
  ) {
    return this.credentials.create(workspaceId, agentId, input);
  }

  async revokeCredential(
    workspaceId: string,
    agentId: string,
    credentialId: string,
  ) {
    return this.credentials.revoke(workspaceId, agentId, credentialId);
  }

  async resolvePat(token: string): Promise<AgentPrincipal> {
    return this.authentication.resolvePat(token);
  }

  async resolveOAuth(
    ownerId: string,
    clientId: string,
    grantedScopes: readonly string[],
  ): Promise<AgentPrincipal> {
    return this.authentication.resolveOAuth(ownerId, clientId, grantedScopes);
  }

  requireScope(principal: AgentPrincipal, scope: AgentScope) {
    this.grants.requireScope(principal, scope);
  }

  requireProject(principal: AgentPrincipal, projectId: string) {
    this.grants.requireProject(principal, projectId);
  }
}
