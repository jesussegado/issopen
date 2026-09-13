import { randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import {
  membershipEvent,
  project,
  projectMembership,
  user,
  workspace,
  workspaceMembership,
} from "../../src/server/db/schema.js";
import { resolveHumanAccess } from "../../src/server/human-access.js";

it("backfills the owner without data loss and remains compatible with a binary rollback", async () => {
  const folder = await mkdtemp(join(tmpdir(), "issopen-membership-migration-"));
  const container = await new PostgreSqlContainer(
    "postgres:18.6-alpine",
  ).start();
  const connection = createDatabase(container.getConnectionUri());
  try {
    await cp("drizzle", folder, { recursive: true });
    const journalPath = join(folder, "meta/_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8"));
    journal.entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 17,
    );
    await writeFile(journalPath, JSON.stringify(journal));
    await migrateDatabase(container.getConnectionUri(), folder);

    const ownerId = randomUUID();
    const workspaceId = randomUUID();
    const projectId = randomUUID();
    const owner = {
      id: ownerId,
      name: "Existing owner",
      email: "membership-migration@example.test",
    };
    await connection.db.insert(user).values(owner);
    await connection.db.insert(workspace).values({
      id: workspaceId,
      ownerId,
      name: "Existing workspace",
    });
    await connection.db.insert(project).values({
      id: projectId,
      workspaceId,
      name: "Existing project",
      key: "EXIST",
    });
    const original = await connection.client`
      SELECT w.id, w.owner_id, w.name, p.id AS project_id, p.name AS project_name
      FROM workspace w JOIN project p ON p.workspace_id = w.id
      WHERE w.id = ${workspaceId}`;

    await migrateDatabase(container.getConnectionUri());

    expect(
      await connection.db
        .select()
        .from(workspaceMembership)
        .where(eq(workspaceMembership.workspaceId, workspaceId)),
    ).toMatchObject([{ workspaceId, userId: ownerId, role: "owner" }]);
    expect(
      await connection.db
        .select()
        .from(membershipEvent)
        .where(eq(membershipEvent.workspaceId, workspaceId)),
    ).toMatchObject([
      {
        workspaceId,
        subjectUserId: ownerId,
        actorUserId: ownerId,
        type: "membership.backfilled",
        previousRole: null,
        nextRole: "owner",
      },
    ]);
    expect(await resolveHumanAccess(connection.db, owner)).toMatchObject({
      workspaceId,
      role: "owner",
      projectIds: null,
    });

    const member = {
      id: randomUUID(),
      name: "Assigned member",
      email: "assigned-member@example.test",
    };
    await connection.db.insert(user).values(member);
    await connection.db.insert(workspaceMembership).values({
      workspaceId,
      userId: member.id,
      role: "member",
    });
    await connection.db.insert(projectMembership).values({
      workspaceId,
      projectId,
      userId: member.id,
    });
    expect(await resolveHumanAccess(connection.db, member)).toMatchObject({
      workspaceId,
      role: "member",
      projectIds: [projectId],
    });

    // The migration is additive: rolling the application binary back does not
    // require rolling the schema back, and its former queries still see the
    // exact owner/workspace/project rows.
    expect(
      await connection.client`
        SELECT w.id, w.owner_id, w.name, p.id AS project_id, p.name AS project_name
        FROM workspace w JOIN project p ON p.workspace_id = w.id
        WHERE w.id = ${workspaceId}`,
    ).toEqual(original);
    await migrateDatabase(container.getConnectionUri());
    expect(
      await connection.db
        .select()
        .from(membershipEvent)
        .where(eq(membershipEvent.workspaceId, workspaceId)),
    ).toHaveLength(1);
  } finally {
    await connection.close();
    await container.stop();
    await rm(folder, { recursive: true, force: true });
  }
}, 120_000);
