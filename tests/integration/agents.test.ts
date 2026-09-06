import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDatabase,
  type DatabaseConnection,
} from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import {
  agentCredential,
  project,
  user,
  workspace,
} from "../../src/server/db/schema.js";
import {
  AgentAuthenticationError,
  AgentService,
  defaultCodexScopes,
} from "../../src/server/domain/index.js";

let container: StartedPostgreSqlContainer;
let connection: DatabaseConnection;
let agents: AgentService;

const ownerId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  await migrateDatabase(container.getConnectionUri());
  connection = createDatabase(container.getConnectionUri());
  agents = new AgentService(connection.db);
}, 120_000);

beforeEach(async () => {
  await connection.client.unsafe(
    'TRUNCATE TABLE "activity_event", "code_link", "issue", "agent_project", "agent_scope", "agent_credential", "agent_identity", "project", "workspace", "user" CASCADE',
  );
  await connection.db.insert(user).values({
    id: ownerId,
    name: "Private Owner",
    email: "owner-agents@example.test",
  });
  await connection.db.insert(workspace).values({
    id: workspaceId,
    ownerId,
    name: "Private workspace",
  });
  await connection.db.insert(project).values({
    id: projectId,
    workspaceId,
    name: "Issopen",
    key: "ISS",
  });
});

afterAll(async () => {
  await connection?.close();
  await container?.stop();
});

describe("agent identities and credentials", () => {
  it("reveals a PAT once, stores only Argon2id material and attributes last use", async () => {
    const created = await agents.createAgent(workspaceId, {
      name: "Codex",
      description: "Dogfood coding agent",
      projectIds: [projectId],
    });
    expect(created.token).toMatch(/^issopen_pat_[A-Za-z0-9_-]{43}$/);
    expect(created.agent.scopes).toEqual(defaultCodexScopes);
    expect(created.agent.scopes).not.toContain("issues:close");

    const [stored] = await connection.db
      .select()
      .from(agentCredential)
      .where(eq(agentCredential.agentId, created.agent.id));
    expect(stored?.tokenHash).toMatch(/^\$argon2id\$/);
    expect(stored?.tokenHash).not.toContain(created.token);

    const safeList = await agents.listAgents(workspaceId);
    expect(JSON.stringify(safeList)).not.toContain(created.token);
    expect(JSON.stringify(safeList)).not.toContain("tokenHash");
    expect(safeList[0]).toMatchObject({
      name: "Codex",
      projectIds: [projectId],
      credential: { lastUsedAt: null },
      access: {
        kind: "pat",
        lastUsedAt: null,
        revokedAt: null,
      },
    });

    const principal = await agents.resolvePat(created.token);
    expect(principal.agent).toMatchObject({
      id: created.agent.id,
      name: "Codex",
    });
    expect(principal.projectIds.has(projectId)).toBe(true);
    expect(principal.scopes.has("issues:close")).toBe(false);
    expect(
      (await agents.listAgents(workspaceId))[0]?.credential?.lastUsedAt,
    ).toBeInstanceOf(Date);
    expect(
      (await agents.listAgents(workspaceId))[0]?.access.lastUsedAt,
    ).toBeInstanceOf(Date);
  });

  it("only reduces persisted projects and scopes and applies them on the next PAT resolution", async () => {
    const secondProjectId = "77777777-7777-4777-8777-777777777777";
    await connection.db.insert(project).values({
      id: secondProjectId,
      workspaceId,
      name: "Second project",
      key: "SEC",
    });
    const created = await agents.createAgent(workspaceId, {
      name: "Reducible agent",
      projectIds: [projectId, secondProjectId],
      scopes: ["issues:read", "issues:write", "issues:claim"],
    });
    expect((await agents.resolvePat(created.token)).projectIds.size).toBe(2);

    const reduced = await agents.updateAgentAccess(
      workspaceId,
      created.agent.id,
      {
        projectIds: [projectId],
        scopes: ["issues:read"],
      },
    );
    expect(reduced.projectIds).toEqual([projectId]);
    expect(reduced.scopes).toEqual(["issues:read"]);
    const nextRequest = await agents.resolvePat(created.token);
    expect([...nextRequest.projectIds]).toEqual([projectId]);
    expect([...nextRequest.scopes]).toEqual(["issues:read"]);

    await expect(
      agents.updateAgentAccess(workspaceId, created.agent.id, {
        projectIds: [projectId, secondProjectId],
        scopes: ["issues:read"],
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      agents.updateAgentAccess(workspaceId, created.agent.id, {
        projectIds: [projectId],
        scopes: ["issues:read", "issues:write"],
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const revoked = await agents.revokeAgentAccess(
      workspaceId,
      created.agent.id,
    );
    expect(revoked.access.revokedAt).toBeInstanceOf(Date);
    expect(revoked.name).toBe("Reducible agent");
    await expect(agents.resolvePat(created.token)).rejects.toBeInstanceOf(
      AgentAuthenticationError,
    );
    await expect(
      agents.updateAgentAccess(workspaceId, created.agent.id, {
        projectIds: [projectId],
        scopes: ["issues:read"],
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects expired and revoked credentials immediately while retaining attribution", async () => {
    const expired = await agents.createAgent(workspaceId, {
      name: "Expired agent",
      projectIds: [projectId],
      expiresInDays: 7,
    });
    await connection.db
      .update(agentCredential)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(agentCredential.agentId, expired.agent.id));
    await expect(agents.resolvePat(expired.token)).rejects.toBeInstanceOf(
      AgentAuthenticationError,
    );

    const active = await agents.createAgent(workspaceId, {
      name: "Revoked agent",
      projectIds: [projectId],
    });
    const revoked = await agents.revokeCredential(workspaceId, active.agent.id);
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    await expect(agents.resolvePat(active.token)).rejects.toBeInstanceOf(
      AgentAuthenticationError,
    );
    expect(
      (await agents.listAgents(workspaceId)).find(
        (item) => item.id === active.agent.id,
      )?.credential?.revokedAt,
    ).toBeInstanceOf(Date);
  });

  it("refuses projects outside the owner's workspace", async () => {
    const foreignOwnerId = "44444444-4444-4444-8444-444444444444";
    const foreignWorkspaceId = "55555555-5555-4555-8555-555555555555";
    const foreignProjectId = "66666666-6666-4666-8666-666666666666";
    await connection.db.insert(user).values({
      id: foreignOwnerId,
      name: "Other",
      email: "other-agents@example.test",
    });
    await connection.db.insert(workspace).values({
      id: foreignWorkspaceId,
      ownerId: foreignOwnerId,
      name: "Other",
    });
    await connection.db.insert(project).values({
      id: foreignProjectId,
      workspaceId: foreignWorkspaceId,
      name: "Other",
      key: "OTH",
    });
    await expect(
      agents.createAgent(workspaceId, {
        name: "Escalating",
        projectIds: [foreignProjectId],
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
