import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import {
  oauthClient,
  user,
  workspace,
  workspaceMembership,
} from "../../src/server/db/schema.js";

it("preserves pre-migration memberships and pins existing Chrome clients before enabling multiple memberships", async () => {
  const folder = await mkdtemp(
    join(tmpdir(), "issopen-multiworkspace-upgrade-"),
  );
  const container = await new PostgreSqlContainer(
    "postgres:18.6-alpine",
  ).start();
  const connection = createDatabase(container.getConnectionUri());
  try {
    await cp("drizzle", folder, { recursive: true });
    const path = join(folder, "meta/_journal.json");
    const journal = JSON.parse(await readFile(path, "utf8"));
    journal.entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 19,
    );
    await writeFile(path, JSON.stringify(journal));
    await migrateDatabase(container.getConnectionUri(), folder);
    const a = randomUUID(),
      b = randomUUID(),
      wa = randomUUID(),
      wb = randomUUID();
    await connection.db.insert(user).values([
      { id: a, name: "A", email: `${a}@example.test` },
      { id: b, name: "B", email: `${b}@example.test` },
    ]);
    await connection.db.insert(workspace).values([
      { id: wa, name: "A", ownerId: a },
      { id: wb, name: "B", ownerId: b },
    ]);
    await connection.client`insert into workspace_membership (workspace_id, user_id, role) values (${wa}, ${a}, 'owner'), (${wb}, ${b}, 'owner')`;
    const clientId = `issopen-chrome-${randomUUID()}`;
    const metadata = {
      extensionId: "abcdefghijklmnopabcdefghijklmnop",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    await connection.db.insert(oauthClient).values({
      id: randomUUID(),
      clientId,
      userId: a,
      referenceId: "issopen-chrome",
      name: "Existing Chrome",
      metadata,
      disabled: false,
      scopes: ["extension:read"],
      redirectUris: [
        "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth",
      ],
    });
    const before =
      await connection.client`select workspace_id, user_id, role, created_at, updated_at from workspace_membership order by workspace_id, user_id`;
    await expect(
      connection.client`insert into workspace_membership (workspace_id, user_id, role) values (${wb}, ${a}, 'member')`,
    ).rejects.toThrow();
    await migrateDatabase(container.getConnectionUri());
    expect(
      await connection.client`select workspace_id, user_id, role, created_at, updated_at from workspace_membership order by workspace_id, user_id`,
    ).toEqual(before);
    expect((await connection.db.select().from(oauthClient))[0]).toMatchObject({
      clientId,
      userId: a,
      disabled: false,
      scopes: ["extension:read"],
      metadata: { ...metadata, workspaceId: wa },
    });
    await connection.db
      .insert(workspaceMembership)
      .values({ workspaceId: wb, userId: a, role: "member" });
    await migrateDatabase(container.getConnectionUri());
    expect(
      (await connection.db.select().from(oauthClient))[0]?.metadata,
    ).toEqual({ ...metadata, workspaceId: wa });
    expect(await connection.db.select().from(workspaceMembership)).toHaveLength(
      3,
    );
  } finally {
    await connection.close();
    await container.stop();
    await rm(folder, { recursive: true, force: true });
  }
}, 120_000);
