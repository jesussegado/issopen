import { randomUUID } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, expect, it } from "vitest";
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
  activityEvent,
  project,
  projectMembership,
  user,
  userProfile,
  workspace,
  workspaceMembership,
} from "../../src/server/db/schema.js";
import { TrackerService } from "../../src/server/domain/index.js";
import { syntheticPng } from "../fixtures/png.js";

const base = "http://localhost:8080",
  password = "synthetic-profiles-test-password";
let container: StartedPostgreSqlContainer,
  connection: DatabaseConnection,
  app: ReturnType<typeof createApp>;
const owner = randomUUID(),
  member = randomUUID(),
  hidden = randomUUID(),
  otherOwner = randomUUID(),
  sameName = randomUUID();
const space = randomUUID(),
  otherSpace = randomUUID(),
  visibleProject = randomUUID(),
  hiddenProject = randomUUID(),
  foreignProject = randomUUID();
let ownerCookie = "",
  memberCookie = "";
const png = `data:image/png;base64,${syntheticPng(true).toString("base64")}`;
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  await migrateDatabase(container.getConnectionUri());
  connection = createDatabase(container.getConnectionUri());
  const config = loadConfig({
    NODE_ENV: "test",
    PORT: "8080",
    DATABASE_URL: container.getConnectionUri(),
    ISSOPEN_BASE_URL: base,
    BETTER_AUTH_SECRET: "synthetic-profile-auth-secret-for-isolated-tests",
  });
  const auth = createAuth(connection.db, config);
  app = createApp({
    db: connection.db,
    auth,
    logger: pino({ level: "silent" }),
    trustedOrigins: config.trustedOrigins,
  });
  const hashed = await (await auth.$context).password.hash(password);
  await connection.db.insert(user).values(
    [owner, member, hidden, otherOwner, sameName].map((id) => ({
      id,
      name: id === owner ? "Owner" : "Original Member",
      email: `${id}@example.test`,
      emailVerified: true,
      image: "https://provider.example/private-pixel",
    })),
  );
  await connection.db.insert(account).values(
    [owner, member].map((id) => ({
      id: randomUUID(),
      userId: id,
      accountId: id,
      providerId: "credential",
      issuer: "local:credential",
      password: hashed,
    })),
  );
  await connection.db.insert(workspace).values([
    { id: space, name: "Profile space", ownerId: owner },
    { id: otherSpace, name: "Other space", ownerId: otherOwner },
  ]);
  await connection.db.insert(workspaceMembership).values([
    { workspaceId: space, userId: owner, role: "owner" },
    { workspaceId: otherSpace, userId: otherOwner, role: "owner" },
    ...[member, hidden, sameName].map((id) => ({
      workspaceId: space,
      userId: id,
      role: "member" as const,
    })),
  ]);
  await connection.db.insert(project).values([
    { id: visibleProject, workspaceId: space, name: "Visible", key: "VIS" },
    { id: hiddenProject, workspaceId: space, name: "Hidden", key: "HID" },
    {
      id: foreignProject,
      workspaceId: otherSpace,
      name: "Foreign",
      key: "FOR",
    },
  ]);
  await connection.db.insert(projectMembership).values([
    {
      workspaceId: space,
      projectId: visibleProject,
      userId: member,
      permission: "read",
    },
    {
      workspaceId: space,
      projectId: visibleProject,
      userId: sameName,
      permission: "edit",
    },
    {
      workspaceId: space,
      projectId: hiddenProject,
      userId: hidden,
      permission: "edit",
    },
  ]);
  for (const id of [owner, member]) {
    const response = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ email: `${id}@example.test`, password }),
    });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    if (id === owner) ownerCookie = cookie;
    else memberCookie = cookie;
  }
}, 120_000);
afterAll(async () => {
  await connection?.close();
  await container?.stop();
});
function request(
  path: string,
  body?: unknown,
  cookie = memberCookie,
  origin = base,
) {
  return app.request(path, {
    method: body === undefined ? "GET" : "PATCH",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
it("keeps profile writes own-only, versioned and separate from identity/history", async () => {
  expect(
    (await request("/api/v1/account/profile", { tooLarge: "x".repeat(140000) }))
      .status,
  ).toBe(413);
  expect((await app.request("/api/v1/account/profile")).status).toBe(401);
  const get = await request("/api/v1/account/profile");
  expect(get.headers.get("cache-control")).toBe("no-store");
  expect(await get.json()).toEqual({
    profile: { name: "Original Member", version: null, avatarPng: null },
  });
  const body = {
    expectedVersion: null,
    name: "  Ana García  ",
    avatarPng: png,
  };
  expect(
    (
      await request(
        "/api/v1/account/profile",
        body,
        memberCookie,
        "https://foreign.example",
      )
    ).status,
  ).toBe(403);
  expect(
    (await request("/api/v1/account/profile", { ...body, userId: owner }))
      .status,
  ).toBe(400);
  for (const name of [
    "<script>x</script>",
    "x".repeat(121),
    "\n",
    "Owner\u202e",
  ])
    expect(
      (await request("/api/v1/account/profile", { ...body, name })).status,
    ).toBe(400);
  await new TrackerService(connection.db).createIssue(
    {
      workspaceId: space,
      source: "rest",
      actor: { type: "human", id: member, displayName: "Original Member" },
    },
    { projectId: visibleProject, title: "Profile history fixture" },
  );
  const events = await connection.db.select().from(activityEvent),
    accounts = await connection.db.select().from(account);
  const responses = await Promise.all([
    request("/api/v1/account/profile", body),
    request("/api/v1/account/profile", body),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([
    200, 409,
  ]);
  const saved = (await (await request("/api/v1/account/profile")).json())
    .profile;
  expect(saved.name).toBe("Ana García");
  expect(saved.version).toEqual(expect.any(String));
  expect(Buffer.from(saved.avatarPng.slice(22), "base64")).toEqual(
    syntheticPng(),
  );
  expect(await connection.db.select().from(activityEvent)).toEqual(events);
  expect(await connection.db.select().from(account)).toEqual(accounts);
  expect((await (await request("/api/v1/session")).json()).user).toMatchObject({
    id: member,
    name: "Ana García",
    email: `${member}@example.test`,
  });
  expect(
    (
      await (
        await request("/api/v1/account/profile", undefined, ownerCookie)
      ).json()
    ).profile.name,
  ).toBe("Owner");
  expect(
    (
      await app.request("/api/auth/update-user", {
        method: "POST",
        headers: {
          Cookie: memberCookie,
          Origin: base,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Bypass",
          image: "https://private.example",
        }),
      })
    ).status,
  ).toBe(404);
});
it("projects expose only eligible collaborators and no email/provider secrets, with scoped stable cursors", async () => {
  const path = `/api/v1/projects/${visibleProject}/collaborators`;
  const page = await request(path);
  expect(page.status).toBe(200);
  expect(page.headers.get("cache-control")).toBe("no-store");
  const data = await page.json();
  expect(
    data.collaborators.map((row: { id: string }) => row.id).sort(),
  ).toEqual([owner, member, sameName].sort());
  expect(JSON.stringify(data)).not.toMatch(
    /email|provider|token|private-pixel|accountId/,
  );
  const person = data.collaborators.find(
    (row: { id: string }) => row.id === member,
  );
  expect(person).toMatchObject({
    name: "Ana García",
    role: "member",
    permission: "read",
  });
  const avatar = await request(person.avatarUrl);
  expect(avatar.status).toBe(200);
  expect(avatar.headers.get("content-type")).toBe("image/png");
  expect(Buffer.from(await avatar.arrayBuffer())).toEqual(syntheticPng());
  const first = await (await request(`${path}?limit=1`)).json();
  const second = await (
    await request(`${path}?limit=1&cursor=${first.nextCursor}`)
  ).json();
  expect(first.collaborators[0].id).not.toBe(second.collaborators[0].id);
  expect(
    (await request(`${path}?q=Ana&cursor=${first.nextCursor}`)).status,
  ).toBe(400);
  expect(
    (
      await request(
        `/api/v1/projects/${hiddenProject}/collaborators?cursor=${first.nextCursor}`,
        undefined,
        ownerCookie,
      )
    ).status,
  ).toBe(400);
  expect((await request(`${path}?limit=999`)).status).toBe(400);
  expect((await request(`${path}?cursor=invalid`)).status).toBe(400);
  expect((await (await request(`${path}?q=%25`)).json()).collaborators).toEqual(
    [],
  );
  for (const projectId of [hiddenProject, foreignProject])
    expect(
      (await request(`/api/v1/projects/${projectId}/collaborators`)).status,
    ).toBe(404);
  expect(
    (
      await request(
        `/api/v1/projects/${foreignProject}/collaborators`,
        undefined,
        ownerCookie,
      )
    ).status,
  ).toBe(404);
  expect((await request(`${path}/${hidden}/avatar`)).status).toBe(404);
  // Two equal display names remain distinct stable identities, never matched by name.
  await connection.db
    .update(user)
    .set({ name: "Original Member" })
    .where(eq(user.id, member));
  expect(
    (await (await request(`${path}?q=Original`)).json()).collaborators,
  ).toHaveLength(2);
  await connection.db
    .delete(workspaceMembership)
    .where(eq(workspaceMembership.userId, sameName));
  expect(
    (await (await request(path)).json()).collaborators.some(
      (row: { id: string }) => row.id === sameName,
    ),
  ).toBe(false);
  // Removing project access revokes old avatar URLs and directory reads, not own profile.
  await connection.db
    .delete(projectMembership)
    .where(eq(projectMembership.userId, member));
  expect((await request(person.avatarUrl)).status).toBe(404);
  expect((await request(path)).status).toBe(404);
  expect((await request("/api/v1/account/profile")).status).toBe(200);
  const current = (await (await request("/api/v1/account/profile")).json())
    .profile;
  const removed = await request("/api/v1/account/profile", {
    expectedVersion: current.version,
    name: current.name,
    avatarPng: null,
  });
  expect(removed.status).toBe(200);
  expect(
    (
      await connection.db
        .select()
        .from(userProfile)
        .where(eq(userProfile.userId, member))
    )[0]?.avatarPng,
  ).toBeNull();
});
