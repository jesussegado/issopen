import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";

it("preserves the existing PAT while enabling several named credentials", async () => {
  const folder = await mkdtemp(join(tmpdir(), "issopen-agent-key-upgrade-"));
  const container = await new PostgreSqlContainer(
    "postgres:18.6-alpine",
  ).start();
  const connection = createDatabase(container.getConnectionUri());
  try {
    await cp("drizzle", folder, { recursive: true });
    const journalPath = join(folder, "meta/_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    journal.entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 32,
    );
    await writeFile(journalPath, JSON.stringify(journal));
    await migrateDatabase(container.getConnectionUri(), folder);

    const ownerId = randomUUID();
    const workspaceId = randomUUID();
    const agentId = randomUUID();
    const credentialId = randomUUID();
    const original = {
      tokenHash: "$argon2id$synthetic-preserved-hash",
      fingerprint: "a1b2c3d4e5f60708",
      expiresAt: new Date("2027-01-02T03:04:05.000Z"),
      lastUsedAt: new Date("2026-09-16T12:30:00.000Z"),
    };
    await connection.client`insert into "user" (id, name, email) values (${ownerId}, 'Owner', ${`${ownerId}@example.test`})`;
    await connection.client`insert into workspace (id, owner_id, name) values (${workspaceId}, ${ownerId}, 'Workspace')`;
    await connection.client`insert into agent_identity (id, workspace_id, name) values (${agentId}, ${workspaceId}, 'Existing agent')`;
    await connection.client`
      insert into agent_credential
        (id, agent_id, workspace_id, token_hash, fingerprint, expires_at, last_used_at)
      values
        (${credentialId}, ${agentId}, ${workspaceId}, ${original.tokenHash},
         ${original.fingerprint}, ${original.expiresAt.toISOString()}::timestamptz,
         ${original.lastUsedAt.toISOString()}::timestamptz)
    `;

    await migrateDatabase(container.getConnectionUri());
    const [preserved] = await connection.client`
      select id, agent_id, workspace_id, label, token_hash, fingerprint,
             expires_at, revoked_at, last_used_at
      from agent_credential where id = ${credentialId}
    `;
    expect(preserved).toMatchObject({
      id: credentialId,
      agent_id: agentId,
      workspace_id: workspaceId,
      label: "Primary",
      token_hash: original.tokenHash,
      fingerprint: original.fingerprint,
      revoked_at: null,
    });
    expect(new Date(String(preserved?.expires_at))).toEqual(original.expiresAt);
    expect(new Date(String(preserved?.last_used_at))).toEqual(
      original.lastUsedAt,
    );

    await connection.client`
      insert into agent_credential
        (id, agent_id, workspace_id, label, token_hash, fingerprint)
      values
        (${randomUUID()}, ${agentId}, ${workspaceId}, 'VS Code',
         '$argon2id$synthetic-second-hash', '1029384756abcdef')
    `;
    await expect(
      connection.client`
        insert into agent_credential
          (id, agent_id, workspace_id, label, token_hash, fingerprint)
        values
          (${randomUUID()}, ${agentId}, ${workspaceId}, 'vs code',
           '$argon2id$synthetic-third-hash', 'fedcba6547382910')
      `,
    ).rejects.toThrow();
    expect(
      await connection.client`select id from agent_credential where agent_id = ${agentId}`,
    ).toHaveLength(2);
  } finally {
    await connection.close();
    await container.stop();
    await rm(folder, { recursive: true, force: true });
  }
}, 120_000);
