import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import { syntheticPng } from "../fixtures/png.js";

it("adds optional local profiles without rewriting identities, memberships or history", async () => {
  const folder = await mkdtemp(join(tmpdir(), "issopen-profile-upgrade-"));
  const container = await new PostgreSqlContainer(
    "postgres:18.6-alpine",
  ).start();
  const connection = createDatabase(container.getConnectionUri());
  try {
    await cp("drizzle", folder, { recursive: true });
    const path = join(folder, "meta/_journal.json"),
      journal = JSON.parse(await readFile(path, "utf8"));
    journal.entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 22,
    );
    await writeFile(path, JSON.stringify(journal));
    await migrateDatabase(container.getConnectionUri(), folder);
    const owner = randomUUID(),
      member = randomUUID(),
      space = randomUUID(),
      projectId = randomUUID();
    await connection.client`insert into "user" (id,name,email,image) values (${owner},'Owner',${`${owner}@example.test`},'https://provider.example/image'),(${member},'Member',${`${member}@example.test`},null)`;
    await connection.client`insert into workspace (id,owner_id,name) values (${space},${owner},'Space')`;
    await connection.client`insert into workspace_membership (workspace_id,user_id,role) values (${space},${owner},'owner'),(${space},${member},'member')`;
    await connection.client`insert into project (id,workspace_id,key,name) values (${projectId},${space},'PRJ','Project')`;
    await connection.client`insert into project_membership (workspace_id,project_id,user_id,permission) values (${space},${projectId},${member},'read')`;
    const people = await connection.client`select * from "user" order by id`,
      memberships =
        await connection.client`select * from workspace_membership order by user_id`,
      grants = await connection.client`select * from project_membership`;
    await migrateDatabase(container.getConnectionUri());
    expect(await connection.client`select * from "user" order by id`).toEqual(
      people,
    );
    expect(
      await connection.client`select * from workspace_membership order by user_id`,
    ).toEqual(memberships);
    expect(await connection.client`select * from project_membership`).toEqual(
      grants,
    );
    expect(await connection.client`select * from user_profile`).toEqual([]);
    const png = `data:image/png;base64,${syntheticPng().toString("base64")}`;
    await connection.client`insert into user_profile (user_id,avatar_png) values (${member},${png})`;
    const saved = await connection.client`select * from user_profile`;
    await migrateDatabase(container.getConnectionUri());
    expect(await connection.client`select * from user_profile`).toEqual(saved);
    await expect(
      connection.client`update user_profile set avatar_png=${"x".repeat(131095)} where user_id=${member}`,
    ).rejects.toThrow();
  } finally {
    await connection.close();
    await container.stop();
    await rm(folder, { recursive: true, force: true });
  }
}, 120_000);
