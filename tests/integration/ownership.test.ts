import { randomUUID } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { and, eq } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { recoverWorkspaceOwner } from "../../scripts/owner.js";
import { createApp } from "../../src/server/app.js";
import { createAuth, type IssopenAuth } from "../../src/server/auth.js";
import { loadConfig } from "../../src/server/config.js";
import {
  createDatabase,
  type DatabaseConnection,
} from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import {
  account,
  activityEvent,
  authenticationAssurance,
  issue,
  ownershipEvent,
  ownershipTransfer,
  projectMembership,
  session,
  user,
  workspace,
  workspaceMembership,
} from "../../src/server/db/schema.js";
import { TrackerService } from "../../src/server/domain/index.js";

const base = "http://localhost:8080",
  password = "synthetic-ownership-test-password";
let container: StartedPostgreSqlContainer,
  connection: DatabaseConnection,
  auth: IssopenAuth,
  app: ReturnType<typeof createApp>,
  tracker: TrackerService;
let owner: string,
  member: string,
  other: string,
  space: string,
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
    BETTER_AUTH_SECRET: "synthetic-ownership-auth-secret-for-tests",
  });
  auth = createAuth(connection.db, config);
  app = createApp({
    db: connection.db,
    auth,
    logger: pino({ level: "silent" }),
    trustedOrigins: config.trustedOrigins,
  });
  tracker = new TrackerService(connection.db);
}, 60000);
afterAll(async () => {
  await connection?.close();
  await container?.stop();
});
async function login(id: string, secret = password) {
  const r = await app.request(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({ email: `${id}@example.test`, password: secret }),
  });
  expect(r.status).toBe(200);
  cookies.set(id, r.headers.get("set-cookie")?.split(";")[0] ?? "");
}
beforeEach(async () => {
  await connection.client.unsafe('TRUNCATE "user" CASCADE');
  cookies.clear();
  owner = randomUUID();
  member = randomUUID();
  other = randomUUID();
  space = randomUUID();
  const hash = await (await auth.$context).password.hash(password);
  await connection.db.insert(user).values(
    [owner, member, other].map((id) => ({
      id,
      name:
        id === owner
          ? "Former owner"
          : id === member
            ? "Next owner"
            : "Other member",
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
  await connection.db
    .insert(workspace)
    .values({ id: space, ownerId: owner, name: "Transfer test" });
  await connection.db.insert(workspaceMembership).values(
    [owner, member, other].map((id) => ({
      workspaceId: space,
      userId: id,
      role: id === owner ? ("owner" as const) : ("member" as const),
    })),
  );
  projectId = (
    await tracker.createProject(
      {
        workspaceId: space,
        actor: { type: "human", id: owner, displayName: "Former owner" },
        source: "rest",
      },
      { name: "Private project", key: "PRIVATE" },
    )
  ).id;
  await login(owner);
  await login(member);
  await login(other);
});
function req(id: string, path = "", body?: unknown, workspaceId = space) {
  return app.request(`${base}/api/v1/workspace/ownership${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Cookie: cookies.get(id) ?? "",
      Origin: base,
      "Content-Type": "application/json",
      "X-Issopen-Workspace": workspaceId,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function input(recipient = member) {
  const [m] = await connection.db
    .select()
    .from(workspaceMembership)
    .where(
      and(
        eq(workspaceMembership.workspaceId, space),
        eq(workspaceMembership.userId, recipient),
      ),
    );
  const [w] = await connection.db
    .select()
    .from(workspace)
    .where(eq(workspace.id, space));
  return {
    recipientId: recipient,
    recipientMembershipVersion: m?.version,
    expectedWorkspaceVersion: w?.version,
    confirmation: "Transfer test",
    clientRequestId: randomUUID(),
  };
}
async function propose() {
  const r = await req(owner, "", await input());
  const b = await r.json();
  expect(r.status, JSON.stringify(b)).toBe(200);
  return b.transfer;
}
it("requires actual recent logins, never merely a new session or request timestamp", async () => {
  expect(
    await connection.db.select().from(authenticationAssurance),
  ).toHaveLength(3);
  expect((await req(owner)).headers.get("cache-control")).toBe("no-store");
  const [s] = await connection.db
    .select()
    .from(session)
    .where(eq(session.userId, owner));
  if (!s) throw Error("Session missing");
  await connection.db
    .delete(authenticationAssurance)
    .where(eq(authenticationAssurance.sessionId, s.id));
  expect(
    (
      await req(owner, "", {
        ...(await input()),
        authenticatedAt: new Date().toISOString(),
      })
    ).status,
  ).toBe(400);
  expect((await req(owner, "", await input())).status).toBe(403);
  await connection.db.insert(authenticationAssurance).values({
    sessionId: s.id,
    userId: owner,
    method: "password",
    authenticatedAt: new Date(Date.now() - 360000),
  });
  expect((await req(owner, "", await input())).status).toBe(403);
  await connection.db
    .update(authenticationAssurance)
    .set({ authenticatedAt: new Date(Date.now() + 60000) })
    .where(eq(authenticationAssurance.sessionId, s.id));
  expect((await req(owner, "", await input())).status).toBe(403);
  await login(owner);
  expect((await req(owner)).status).toBe(200);
  await propose();
});
it("scopes eligible people and proposals; rejects foreign, unverified, existing Owners and stale confirmations", async () => {
  expect((await req(member, "/people")).status).toBe(403);
  expect((await req(owner, "", await input(), randomUUID())).status).toBe(404);
  expect(
    (await req(owner, "", { ...(await input()), recipientId: owner })).status,
  ).toBe(400);
  await connection.db
    .update(user)
    .set({ emailVerified: false })
    .where(eq(user.id, member));
  expect((await req(owner, "", await input())).status).toBe(400);
  await connection.db
    .update(user)
    .set({ emailVerified: true })
    .where(eq(user.id, member));
  await connection.db
    .insert(workspace)
    .values({ id: randomUUID(), ownerId: member, name: "Other workspace" });
  expect((await req(owner, "", await input())).status).toBe(409);
  const people = (await (await req(owner, "/people")).json()).people;
  expect(people.find((p: { id: string }) => p.id === member)).toMatchObject({
    eligible: false,
    reason: "Already owns a workspace",
  });
  expect(Object.keys(people[0]).sort()).toEqual([
    "eligible",
    "id",
    "membershipVersion",
    "name",
    "reason",
  ]);
  expect(
    (
      await req(owner, "", {
        ...(await input(other)),
        expectedWorkspaceVersion: 999,
      })
    ).status,
  ).toBe(409);
  expect(
    (await req(owner, "", { ...(await input(other)), confirmation: "wrong" }))
      .status,
  ).toBe(400);
  const p = await req(owner, "", await input(other));
  expect(p.status).toBe(200);
  expect((await (await req(member)).json()).transfers).toEqual([]);
  const t = (await p.json()).transfer;
  expect(
    (
      await req(member, `/${t.id}/accept`, {
        expectedVersion: t.version,
        confirmation: "Transfer test",
      })
    ).status,
  ).toBe(404);
});
it("serializes proposal retries/cancellation, expiry and membership changes without changing ownership", async () => {
  const data = await input();
  const both = await Promise.all([req(owner, "", data), req(owner, "", data)]);
  expect(both.map((r) => r.status)).toEqual([200, 200]);
  const first = both[0];
  if (!first) throw Error("Missing proposal response");
  const t = (await first.json()).transfer;
  expect(await connection.db.select().from(ownershipTransfer)).toHaveLength(1);
  expect(await connection.db.select().from(ownershipEvent)).toHaveLength(1);
  expect((await req(owner, "", { ...data, recipientId: other })).status).toBe(
    409,
  );
  expect((await req(owner, "", await input())).status).toBe(409);
  await connection.db
    .update(workspaceMembership)
    .set({ version: randomUUID() })
    .where(
      and(
        eq(workspaceMembership.workspaceId, space),
        eq(workspaceMembership.userId, member),
      ),
    );
  expect(
    (
      await req(member, `/${t.id}/accept`, {
        expectedVersion: t.version,
        confirmation: "Transfer test",
      })
    ).status,
  ).toBe(409);
  expect(
    (await req(other, `/${t.id}/cancel`, { expectedVersion: t.version }))
      .status,
  ).toBe(404);
  for (let i = 0; i < 2; i++)
    expect(
      (await req(member, `/${t.id}/cancel`, { expectedVersion: t.version }))
        .status,
    ).toBe(200);
  expect(
    (
      await req(member, `/${t.id}/accept`, {
        expectedVersion: t.version,
        confirmation: "Transfer test",
      })
    ).status,
  ).toBe(409);
  const second = await propose();
  await connection.db
    .update(ownershipTransfer)
    .set({ expiresAt: new Date(0) })
    .where(eq(ownershipTransfer.id, second.id));
  expect(
    (
      await req(member, `/${second.id}/accept`, {
        expectedVersion: second.version,
        confirmation: "Transfer test",
      })
    ).status,
  ).toBe(409);
  expect((await (await req(owner)).json()).transfers[0].status).toBe("expired");
  expect(
    (
      await connection.db
        .select()
        .from(workspace)
        .where(eq(workspace.id, space))
    )[0]?.ownerId,
  ).toBe(owner);
});
it("invalidates consent on Owner signout and requires fresh authentication by the recipient", async () => {
  const t = await propose();
  await connection.db
    .delete(authenticationAssurance)
    .where(eq(authenticationAssurance.userId, member));
  expect(
    (
      await req(member, `/${t.id}/accept`, {
        expectedVersion: t.version,
        confirmation: "Transfer test",
      })
    ).status,
  ).toBe(403);
  await login(member);
  const response = await app.request(`${base}/api/auth/sign-out`, {
    method: "POST",
    headers: {
      Cookie: cookies.get(owner) ?? "",
      Origin: base,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  expect(response.status).toBe(200);
  expect(
    (
      await req(member, `/${t.id}/accept`, {
        expectedVersion: t.version,
        confirmation: "Transfer test",
      })
    ).status,
  ).toBe(409);
});
it("atomically transfers once, reconciles derived ownership, retains history and only prior project access", async () => {
  const ctx = {
    workspaceId: space,
    actor: { type: "human" as const, id: owner, displayName: "Former owner" },
    source: "rest" as const,
  };
  const ticket = await tracker.createIssue(ctx, {
    projectId,
    title: "History remains",
  });
  const history = await connection.db.select().from(activityEvent);
  const t = await propose();
  const results = await Promise.all([
    req(member, `/${t.id}/accept`, {
      expectedVersion: t.version,
      confirmation: "Transfer test",
    }),
    req(member, `/${t.id}/accept`, {
      expectedVersion: t.version,
      confirmation: "Transfer test",
    }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    (
      await connection.db
        .select()
        .from(workspace)
        .where(eq(workspace.id, space))
    )[0],
  ).toMatchObject({ ownerId: member, version: 2 });
  expect(
    (
      await connection.db
        .select()
        .from(workspaceMembership)
        .where(eq(workspaceMembership.role, "owner"))
    ).map((m) => m.userId),
  ).toEqual([member]);
  expect(await tracker.getIssue(space, ticket.id)).toMatchObject({
    humanOwnerId: member,
    version: ticket.version + 1,
  });
  expect(await connection.db.select().from(activityEvent)).toEqual(history);
  expect(
    (
      await connection.db
        .select()
        .from(projectMembership)
        .where(eq(projectMembership.userId, owner))
    )[0],
  ).toMatchObject({ projectId, permission: "edit" });
  expect((await req(owner, "/people")).status).toBe(403);
  expect((await req(member, "/people")).status).toBe(200);
  expect(
    (await connection.db.select().from(ownershipEvent)).filter(
      (e) => e.type === "ownership.transferred",
    ),
  ).toHaveLength(1);
  expect(await connection.db.select().from(session)).toHaveLength(3);
  const future = await tracker.createProject(
    { ...ctx, actor: { type: "human", id: member, displayName: "Next owner" } },
    { name: "Future", key: "FUTURE" },
  );
  expect(
    await connection.db
      .select()
      .from(projectMembership)
      .where(
        and(
          eq(projectMembership.userId, owner),
          eq(projectMembership.projectId, future.id),
        ),
      ),
  ).toEqual([]);
});
it("operator recovery verifies the current Owner after transfer, supports Google-only identity and revokes only that identity's web sessions", async () => {
  const t = await propose();
  expect(
    (
      await req(member, `/${t.id}/accept`, {
        expectedVersion: t.version,
        confirmation: "Transfer test",
      })
    ).status,
  ).toBe(200);
  const secret = "synthetic-recovered-owner-password";
  await expect(
    recoverWorkspaceOwner(connection.db, auth, space, {
      email: `${owner}@example.test`,
      password: secret,
    }),
  ).rejects.toThrow("could not verify");
  await connection.db.delete(account).where(eq(account.userId, member)); // Simulates a verified Google-only identity, not a real Google login.
  await recoverWorkspaceOwner(connection.db, auth, space, {
    email: `${member}@example.test`,
    password: secret,
  });
  expect(
    await connection.db
      .select()
      .from(session)
      .where(eq(session.userId, member)),
  ).toHaveLength(0);
  expect(
    await connection.db.select().from(session).where(eq(session.userId, owner)),
  ).toHaveLength(1);
  expect(
    (
      await connection.db
        .select()
        .from(ownershipEvent)
        .where(eq(ownershipEvent.type, "ownership.recovered"))
    )[0],
  ).toMatchObject({ actorUserId: null, actorName: "Infrastructure operator" });
  await login(member, secret);
  expect((await req(member, "/people")).status).toBe(200);
  expect(await connection.db.select().from(issue)).toEqual([]);
});

it("rolls back roles, grants, derived issue ownership and proposal if the audit write fails", async () => {
  const ctx = {
    workspaceId: space,
    actor: { type: "human" as const, id: owner, displayName: "Former owner" },
    source: "rest" as const,
  };
  const ticket = await tracker.createIssue(ctx, {
    projectId,
    title: "Atomic failure",
  });
  const t = await propose();
  await connection.client.unsafe(
    "CREATE FUNCTION synthetic_ownership_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type = 'ownership.transferred' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$",
  );
  await connection.client.unsafe(
    "CREATE TRIGGER synthetic_ownership_failure BEFORE INSERT ON ownership_event FOR EACH ROW EXECUTE FUNCTION synthetic_ownership_failure()",
  );
  try {
    expect(
      (
        await req(member, `/${t.id}/accept`, {
          expectedVersion: t.version,
          confirmation: "Transfer test",
        })
      ).status,
    ).toBe(500);
    expect(
      (
        await connection.db
          .select()
          .from(workspace)
          .where(eq(workspace.id, space))
      )[0],
    ).toMatchObject({ ownerId: owner, version: 1 });
    expect(
      (
        await connection.db
          .select()
          .from(workspaceMembership)
          .where(eq(workspaceMembership.role, "owner"))
      ).map((m) => m.userId),
    ).toEqual([owner]);
    expect(await connection.db.select().from(projectMembership)).toEqual([]);
    expect(await tracker.getIssue(space, ticket.id)).toMatchObject({
      humanOwnerId: owner,
      version: ticket.version,
    });
    expect(
      (
        await connection.db
          .select()
          .from(ownershipTransfer)
          .where(eq(ownershipTransfer.id, t.id))
      )[0],
    ).toMatchObject({ status: "pending", version: t.version });
  } finally {
    await connection.client.unsafe(
      "DROP TRIGGER synthetic_ownership_failure ON ownership_event",
    );
    await connection.client.unsafe(
      "DROP FUNCTION synthetic_ownership_failure()",
    );
  }
});
