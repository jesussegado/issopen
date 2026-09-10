import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import { user, workspace } from "../../src/server/db/schema.js";
import { TrackerService } from "../../src/server/domain/index.js";

it("backfills existing Epics deterministically without changing their data or ticket links", async () => {
  const migrationFolder = await mkdtemp(
    join(tmpdir(), "issopen-epic-migration-"),
  );
  const container = await new PostgreSqlContainer(
    "postgres:18.6-alpine",
  ).start();
  const connection = createDatabase(container.getConnectionUri());
  try {
    await cp("drizzle", migrationFolder, { recursive: true });
    const journalPath = join(migrationFolder, "meta/_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    journal.entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 11,
    );
    await writeFile(journalPath, JSON.stringify(journal));
    await migrateDatabase(container.getConnectionUri(), migrationFolder);

    const ownerId = randomUUID();
    const workspaceId = randomUUID();
    const projects = [randomUUID(), randomUUID(), randomUUID()] as const;
    const context = {
      workspaceId,
      actor: {
        type: "human" as const,
        id: ownerId,
        displayName: "Migration owner",
      },
      source: "rest" as const,
    };
    await connection.db
      .insert(user)
      .values({ id: ownerId, name: "Owner", email: "migration@example.test" });
    await connection.db
      .insert(workspace)
      .values({ id: workspaceId, ownerId, name: "Migration" });
    for (const [index, projectId] of projects.entries()) {
      await connection.client`INSERT INTO project (id, workspace_id, name, key)
        VALUES (${projectId}, ${workspaceId}, ${`Project ${index}`}, ${`EP${index}`})`;
    }
    const epics = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        projectId: projects[0],
        date: "2026-09-02T00:00:00Z",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        projectId: projects[0],
        date: "2026-09-01T00:00:00Z",
      },
      {
        id: "11111111-1111-4111-8111-111111111111",
        projectId: projects[0],
        date: "2026-09-01T00:00:00Z",
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        projectId: projects[1],
        date: "2026-09-03T00:00:00Z",
      },
    ] as const;
    for (const epic of epics) {
      await connection.client`INSERT INTO epic (id, workspace_id, project_id, title, description, created_at)
        VALUES (${epic.id}, ${workspaceId}, ${epic.projectId}, ${`Original ${epic.id}`}, 'Keep me', ${epic.date})`;
    }
    const tracker = new TrackerService(connection.db);
    // Seed the historical schema directly, not through today's ORM columns.
    const issueId = randomUUID();
    await connection.client`INSERT INTO issue
      (id, workspace_id, project_id, epic_id, number, key, title, human_owner_id)
      VALUES (${issueId}, ${workspaceId}, ${projects[0]}, ${epics[0].id}, 1, 'EP0-1', 'Keep association', ${ownerId})`;
    const original = await connection.client`SELECT * FROM epic ORDER BY id`;

    await migrateDatabase(container.getConnectionUri());
    const migrated = await connection.client`SELECT * FROM epic ORDER BY id`;
    expect(migrated.map(({ number: _number, ...rest }) => rest)).toEqual([
      ...original,
    ]);
    expect(migrated.map((item) => item.number)).toEqual([1, 2, 3, 1]);
    expect(await tracker.getIssue(workspaceId, issueId)).toMatchObject({
      epicId: epics[0].id,
      deletedAt: null,
      title: "Keep association",
    });
    expect(await tracker.getProject(workspaceId, projects[0])).toMatchObject({
      showReviewColumn: true,
      showDoneColumn: true,
    });
    for (const [index, projectId] of projects.entries()) {
      expect(
        await tracker.createEpic(context, {
          projectId,
          title: "After upgrade",
        }),
      ).toMatchObject({ number: [4, 2, 1][index] });
    }
    // Running the migrator again must not renumber anything.
    await migrateDatabase(container.getConnectionUri());
    expect((await tracker.getEpic(workspaceId, epics[0].id)).number).toBe(3);
  } finally {
    await connection.close();
    await container.stop();
    await rm(migrationFolder, { recursive: true, force: true });
  }
}, 120_000);
