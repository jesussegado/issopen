import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import { user, workspace } from "../../src/server/db/schema.js";
import { AgentService, TrackerService } from "../../src/server/domain/index.js";

it("adds opt-in Epic scopes without altering any existing grants and keeps old queries compatible", async () => {
  const folder = await mkdtemp(join(tmpdir(), "issopen-scope-migration-"));
  const container = await new PostgreSqlContainer(
    "postgres:18.6-alpine",
  ).start();
  const connection = createDatabase(container.getConnectionUri());
  try {
    await cp("drizzle", folder, { recursive: true });
    const journalPath = join(folder, "meta/_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    journal.entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 12,
    );
    await writeFile(journalPath, JSON.stringify(journal));
    await migrateDatabase(container.getConnectionUri(), folder);
    const ownerId = randomUUID();
    const workspaceId = randomUUID();
    await connection.db
      .insert(user)
      .values({ id: ownerId, name: "Owner", email: "scopes@example.test" });
    await connection.db
      .insert(workspace)
      .values({ id: workspaceId, ownerId, name: "Scopes" });
    const tracker = new TrackerService(connection.db);
    const project = await tracker.createProject(
      {
        workspaceId,
        actor: { type: "human", id: ownerId, displayName: "Owner" },
        source: "rest",
      },
      { name: "Scopes", key: "SCOPES" },
    );
    const agents = new AgentService(connection.db);
    const existing = await agents.createAgent(workspaceId, {
      name: "Existing",
      projectIds: [project.id],
    });
    const before =
      await connection.client`SELECT * FROM agent_scope ORDER BY scope`;
    await migrateDatabase(container.getConnectionUri());
    expect(
      await connection.client`SELECT * FROM agent_scope ORDER BY scope`,
    ).toEqual(before);
    const principal = await agents.resolvePat(existing.token);
    expect([...principal.scopes]).not.toContain("epics:create");
    expect([...principal.scopes]).not.toContain("epics:write");
    // A previous binary still reads its old enum values and unchanged rows.
    expect(
      await connection.client`SELECT count(*)::int AS count FROM agent_scope WHERE scope = 'issues:read'::agent_scope_value`,
    ).toEqual([{ count: 1 }]);
    const optedIn = await agents.createAgent(workspaceId, {
      name: "Explicit",
      projectIds: [project.id],
      scopes: ["issues:read", "epics:create", "epics:write"],
    });
    expect([...(await agents.resolvePat(optedIn.token)).scopes]).toContain(
      "epics:write",
    );
    await migrateDatabase(container.getConnectionUri());
    expect(
      await connection.client`SELECT * FROM agent_scope WHERE agent_id = ${existing.agent.id} ORDER BY scope`,
    ).toEqual(before);
  } finally {
    await connection.close();
    await container.stop();
    await rm(folder, { recursive: true, force: true });
  }
}, 120_000);
