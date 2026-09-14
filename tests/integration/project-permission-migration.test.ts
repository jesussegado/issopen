import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";

it("upgrades existing project grants to edit without adding memberships and preserves later read grants", async () => {
  const folder = await mkdtemp(join(tmpdir(), "issopen-permission-upgrade-"));
  const container = await new PostgreSqlContainer(
    "postgres:18.6-alpine",
  ).start();
  const connection = createDatabase(container.getConnectionUri());
  try {
    await cp("drizzle", folder, { recursive: true });
    const path = join(folder, "meta/_journal.json");
    const journal = JSON.parse(await readFile(path, "utf8"));
    journal.entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 20,
    );
    await writeFile(path, JSON.stringify(journal));
    await migrateDatabase(container.getConnectionUri(), folder);
    const owner = randomUUID(),
      member = randomUUID(),
      space = randomUUID(),
      project = randomUUID();
    await connection.client`insert into "user" (id, name, email) values (${owner}, 'Owner', ${`${owner}@example.test`}), (${member}, 'Member', ${`${member}@example.test`})`;
    await connection.client`insert into workspace (id, owner_id, name) values (${space}, ${owner}, 'Workspace')`;
    await connection.client`insert into workspace_membership (workspace_id, user_id, role) values (${space}, ${owner}, 'owner'), (${space}, ${member}, 'member')`;
    await connection.client`insert into project (id, workspace_id, key, name) values (${project}, ${space}, 'READ', 'Project')`;
    await connection.client`insert into project_membership (workspace_id, project_id, user_id) values (${space}, ${project}, ${member})`;
    const before = await connection.client`select * from project_membership`;
    await migrateDatabase(container.getConnectionUri());
    const upgraded = await connection.client`select * from project_membership`;
    expect(upgraded).toEqual(
      before.map((row) => ({ ...row, permission: "edit" })),
    );
    await connection.client`update project_membership set permission = 'read' where user_id = ${member}`;
    await migrateDatabase(container.getConnectionUri());
    expect(
      (await connection.client`select permission from project_membership`)[0]
        ?.permission,
    ).toBe("read");
    await expect(
      connection.client`update project_membership set permission = 'admin' where user_id = ${member}`,
    ).rejects.toThrow();
    expect(
      await connection.client`select * from workspace_membership`,
    ).toHaveLength(2);
  } finally {
    await connection.close();
    await container.stop();
    await rm(folder, { recursive: true, force: true });
  }
}, 120_000);
