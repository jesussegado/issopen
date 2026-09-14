import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";

it("backfills stable distinct membership versions without changing grants or prior audit", async () => {
  const folder = await mkdtemp(join(tmpdir(), "issopen-member-upgrade-"));
  const container = await new PostgreSqlContainer(
    "postgres:18.6-alpine",
  ).start();
  const connection = createDatabase(container.getConnectionUri());
  try {
    await cp("drizzle", folder, { recursive: true });
    const path = join(folder, "meta/_journal.json"),
      journal = JSON.parse(await readFile(path, "utf8"));
    journal.entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 21,
    );
    await writeFile(path, JSON.stringify(journal));
    await migrateDatabase(container.getConnectionUri(), folder);
    const owner = randomUUID(),
      member = randomUUID(),
      space = randomUUID(),
      project = randomUUID(),
      event = randomUUID();
    await connection.client`insert into "user" (id,name,email) values (${owner},'Owner',${`${owner}@example.test`}),(${member},'Member',${`${member}@example.test`})`;
    await connection.client`insert into workspace (id,owner_id,name) values (${space},${owner},'Space')`;
    await connection.client`insert into workspace_membership (workspace_id,user_id,role) values (${space},${owner},'owner'),(${space},${member},'member')`;
    await connection.client`insert into project (id,workspace_id,key,name) values (${project},${space},'PRJ','Project')`;
    await connection.client`insert into project_membership (workspace_id,project_id,user_id,permission) values (${space},${project},${member},'read')`;
    await connection.client`insert into membership_event (id,workspace_id,subject_user_id,actor_user_id,type) values (${event},${space},${member},${owner},'membership.accepted')`;
    const grants = await connection.client`select * from project_membership`,
      audit = await connection.client`select * from membership_event`;
    await migrateDatabase(container.getConnectionUri());
    const memberships =
      await connection.client`select * from workspace_membership order by user_id`;
    expect(new Set(memberships.map((row) => row.version)).size).toBe(2);
    for (const row of memberships)
      expect(row.version).toMatch(/^[0-9a-f-]{36}$/);
    expect(await connection.client`select * from project_membership`).toEqual(
      grants,
    );
    expect(await connection.client`select * from membership_event`).toEqual(
      audit.map((row) => ({
        ...row,
        previous_permission: null,
        next_permission: null,
      })),
    );
    await migrateDatabase(container.getConnectionUri());
    expect(
      await connection.client`select * from workspace_membership order by user_id`,
    ).toEqual(memberships);
  } finally {
    await connection.close();
    await container.stop();
    await rm(folder, { recursive: true, force: true });
  }
}, 120_000);
