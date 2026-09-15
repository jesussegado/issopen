import { randomUUID } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { and, eq } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createApp } from "../../src/server/app.js";
import { createAuth } from "../../src/server/auth.js";
import { loadConfig } from "../../src/server/config.js";
import {
  createDatabase,
  type DatabaseConnection,
} from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import {
  account,
  membershipEvent,
  ownershipEvent,
  project,
  user,
  workspace,
  workspaceInvitation,
  workspaceInvitationEvent,
  workspaceMembership,
} from "../../src/server/db/schema.js";

const base = "http://localhost:8080",
  password = "synthetic-audit-test-password";
let container: StartedPostgreSqlContainer,
  connection: DatabaseConnection,
  app: ReturnType<typeof createApp>,
  hash: string;
let owner: string,
  member: string,
  other: string,
  space: string,
  foreign: string,
  projectId: string;
const cookies = new Map<string, string>();
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  await migrateDatabase(container.getConnectionUri());
  connection = createDatabase(container.getConnectionUri());
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: container.getConnectionUri(),
    ISSOPEN_BASE_URL: base,
    BETTER_AUTH_SECRET: "synthetic-audit-auth-secret-for-tests",
  });
  const auth = createAuth(connection.db, config);
  hash = await (await auth.$context).password.hash(password);
  app = createApp({
    db: connection.db,
    auth,
    logger: pino({ level: "silent" }),
    trustedOrigins: config.trustedOrigins,
  });
}, 60000);
afterAll(async () => {
  await connection?.close();
  await container?.stop();
});
beforeEach(async () => {
  await connection.client.unsafe('TRUNCATE "user" CASCADE');
  cookies.clear();
  owner = randomUUID();
  member = randomUUID();
  other = randomUUID();
  space = randomUUID();
  foreign = randomUUID();
  projectId = randomUUID();
  await connection.db.insert(user).values(
    [owner, member, other].map((id) => ({
      id,
      name:
        id === owner
          ? "Historical owner"
          : id === member
            ? "Historical member"
            : "Foreign owner",
      email: `${id}@example.test`,
      emailVerified: true,
    })),
  );
  await connection.db.insert(account).values(
    [owner, member, other].map((id) => ({
      id: randomUUID(),
      userId: id,
      accountId: id,
      issuer: "local:credential",
      providerId: "credential",
      password: hash,
    })),
  );
  await connection.db.insert(workspace).values([
    { id: space, ownerId: owner, name: "Audit" },
    { id: foreign, ownerId: other, name: "Foreign" },
  ]);
  await connection.db.insert(workspaceMembership).values([
    { workspaceId: space, userId: owner, role: "owner" },
    { workspaceId: space, userId: member, role: "member" },
    { workspaceId: foreign, userId: other, role: "owner" },
  ]);
  await connection.db.insert(project).values({
    id: projectId,
    workspaceId: space,
    key: "AUDIT",
    name: "Audited",
  });
  for (const id of [owner, member, other]) {
    const r = await app.request(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ email: `${id}@example.test`, password }),
    });
    expect(r.status).toBe(200);
    cookies.set(id, r.headers.get("set-cookie")?.split(";")[0] ?? "");
  }
});
function req(id = owner, query = "", context = space, method = "GET") {
  return app.request(`${base}/api/v1/workspace/audit${query}`, {
    method,
    headers: {
      Cookie: cookies.get(id) ?? "",
      Origin: base,
      "X-Issopen-Workspace": context,
    },
  });
}
async function read(query = "") {
  const r = await req(owner, query);
  const body = await r.json();
  expect(r.status, JSON.stringify(body)).toBe(200);
  expect(r.headers.get("cache-control")).toBe("no-store");
  return body;
}
async function event(type = "project.access_granted", createdAt = new Date()) {
  const id = randomUUID();
  await connection.db.insert(membershipEvent).values({
    id,
    workspaceId: space,
    actorUserId: owner,
    subjectUserId: member,
    projectId,
    type,
    nextPermission: "edit",
    createdAt,
  });
  return id;
}
it("reads all three existing ledgers with stable historical attribution, filters and secret-free ownership impact", async () => {
  const grant = await event();
  const invite = randomUUID();
  await connection.db.insert(workspaceInvitation).values({
    id: invite,
    workspaceId: space,
    email: "private-invitation@example.test",
    tokenHash: "a".repeat(64),
    createdByUserId: owner,
    expiresAt: new Date(Date.now() + 86400000),
  });
  await connection.db.insert(workspaceInvitationEvent).values({
    id: randomUUID(),
    workspaceId: space,
    invitationId: invite,
    actorUserId: owner,
    type: "invitation.created",
  });
  await connection.db.insert(ownershipEvent).values({
    id: randomUUID(),
    workspaceId: space,
    actorUserId: null,
    actorName: "Infrastructure operator",
    type: "ownership.recovered",
    changes: {
      subject: { id: member, name: "Historical member" },
      credential: "rotated",
      webSessions: "all_for_identity_revoked",
      password: "synthetic-never-display",
      token: "synthetic-private-token",
      unrelatedProject: randomUUID(),
    },
  });
  await connection.db
    .update(user)
    .set({ name: "Changed later" })
    .where(eq(user.id, member));
  await connection.db
    .delete(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.workspaceId, space),
        eq(workspaceMembership.userId, member),
      ),
    );
  const data = await read();
  expect(data.events).toHaveLength(3);
  expect(data.events.find((e: { id: string }) => e.id === grant)).toMatchObject(
    {
      actor: { id: owner, name: "Historical owner" },
      subject: { id: member, name: "Historical member" },
      changes: { nextPermission: "edit" },
    },
  );
  expect(JSON.stringify(data)).not.toMatch(
    /private-invitation@|synthetic-never-display|synthetic-private-token|tokenHash|Changed later/,
  );
  expect(JSON.stringify(data)).not.toContain("a".repeat(64));
  await expect(
    connection.client`update ownership_event set actor_name='rewritten'`,
  ).rejects.toThrow("immutable");
  await expect(connection.client`delete from ownership_event`).rejects.toThrow(
    "immutable",
  );
  await expect(
    connection.client`update membership_event set actor_name='rewritten'`,
  ).rejects.toThrow("immutable");
  await expect(
    connection.client`delete from workspace_invitation_event`,
  ).rejects.toThrow("immutable");
  expect(
    (await read("?action=ownership.recovered")).events[0].changes,
  ).toMatchObject({
    credential: "rotated",
    webSessions: "all_for_identity_revoked",
  });
  expect((await read("?person=Historical%20member")).events).toHaveLength(2);
  expect((await read(`?person=${member}`)).events).toHaveLength(2);
  expect((await read("?person=%25")).events).toEqual([]);
  expect((await read("?from=2000-01-01&to=2000-01-01")).events).toEqual([]);
});
it("denies Member, foreign workspace and demoted Owner without exporting or mutating records", async () => {
  await event();
  for (const [id, ctx, code] of [
    [member, space, 403],
    [owner, foreign, 404],
    [other, space, 404],
  ] as const) {
    const r = await req(id, "", ctx);
    expect(r.status).toBe(code);
    expect(r.headers.get("cache-control")).toBe("no-store");
  }
  for (const method of ["POST", "PATCH", "DELETE"])
    expect((await req(owner, "", space, method)).status).toBe(404);
  await connection.db
    .update(workspaceMembership)
    .set({ role: "member" })
    .where(
      and(
        eq(workspaceMembership.workspaceId, space),
        eq(workspaceMembership.userId, owner),
      ),
    );
  expect((await req()).status).toBe(403);
  expect(await connection.db.select().from(membershipEvent)).toHaveLength(1);
});
it("pages exact microsecond timestamps and ties once, binds cursor filters and ignores later inserts on older pages", async () => {
  const ids = [];
  for (let i = 0; i < 7; i++) {
    const id = randomUUID();
    ids.push(id);
    await connection.client`insert into membership_event (id,workspace_id,actor_user_id,subject_user_id,project_id,type,next_permission,created_at) values (${id},${space},${owner},${member},${projectId},'project.access_granted','edit','2026-09-15T00:00:00.123456Z')`;
  }
  const first = await read("?limit=2");
  expect(first.nextCursor).toBeTruthy();
  expect(
    (await req(owner, `?limit=2&person=Changed&cursor=${first.nextCursor}`))
      .status,
  ).toBe(400);
  expect(
    (await req(other, `?limit=2&cursor=${first.nextCursor}`, foreign)).status,
  ).toBe(400);
  await event("membership.revoked", new Date("2026-09-15T00:00:01Z"));
  const seen = first.events.map((e: { id: string }) => e.id);
  let cursor = first.nextCursor;
  while (cursor) {
    const next = await read(`?limit=2&cursor=${cursor}`);
    seen.push(...next.events.map((e: { id: string }) => e.id));
    cursor = next.nextCursor;
  }
  expect(seen).toHaveLength(7);
  expect(new Set(seen).size).toBe(7);
  expect([...seen].sort()).toEqual(ids.sort());
  expect(
    (await read("?from=2026-09-15&to=2026-09-15&limit=50")).events,
  ).toHaveLength(8);
  for (const query of [
    "?from=2026-02-31",
    "?from=2026-09-16&to=2026-09-15",
    "?limit=1000",
    "?cursor=garbage",
    "?action=unknown",
    "?export=true",
  ])
    expect((await req(owner, query)).status).toBe(400);
});
