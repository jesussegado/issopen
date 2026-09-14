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
  project,
  projectMembership,
  user,
  workspace,
  workspaceInvitation,
  workspaceMembership,
} from "../../src/server/db/schema.js";
import { InvitationService } from "../../src/server/invitations.js";

const base = "http://localhost:8080";
let container: StartedPostgreSqlContainer;
let connection: DatabaseConnection;
let app: ReturnType<typeof createApp>;
let auth: ReturnType<typeof createAuth>;
const ownerA = randomUUID(),
  ownerB = randomUUID(),
  member = randomUUID();
const workspaceA = randomUUID(),
  workspaceB = randomUUID();
const projectA = randomUUID(),
  projectB = randomUUID();
let cookie: string;
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  await migrateDatabase(container.getConnectionUri());
  connection = createDatabase(container.getConnectionUri());
  const config = loadConfig({
    NODE_ENV: "test",
    PORT: "8080",
    DATABASE_URL: container.getConnectionUri(),
    ISSOPEN_BASE_URL: base,
    BETTER_AUTH_SECRET: "synthetic-multiworkspace-auth-secret-only",
  });
  auth = createAuth(connection.db, config);
  app = createApp({
    db: connection.db,
    auth,
    logger: pino({ level: "silent" }),
    trustedOrigins: config.trustedOrigins,
  });
  const password = await (await auth.$context).password.hash(
    "synthetic-multiworkspace-password",
  );
  await connection.db.insert(user).values(
    [ownerA, ownerB, member].map((id, index) => ({
      id,
      name: `Person ${index}`,
      email: `${id}@example.test`,
      emailVerified: true,
    })),
  );
  await connection.db.insert(account).values({
    id: randomUUID(),
    userId: member,
    accountId: member,
    providerId: "credential",
    issuer: "local:credential",
    password,
  });
  await connection.db.insert(workspace).values([
    { id: workspaceA, ownerId: ownerA, name: "Workspace A" },
    { id: workspaceB, ownerId: ownerB, name: "Workspace B" },
  ]);
  await connection.db.insert(workspaceMembership).values([
    { workspaceId: workspaceA, userId: ownerA, role: "owner" },
    { workspaceId: workspaceB, userId: ownerB, role: "owner" },
    { workspaceId: workspaceA, userId: member, role: "member" },
  ]);
  await connection.db.insert(project).values([
    { id: projectA, workspaceId: workspaceA, name: "Project A", key: "PRJA" },
    { id: projectB, workspaceId: workspaceB, name: "Project B", key: "PRJB" },
  ]);
  await connection.db
    .insert(projectMembership)
    .values({ workspaceId: workspaceA, projectId: projectA, userId: member });
  const signedIn = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `${member}@example.test`,
      password: "synthetic-multiworkspace-password",
    }),
  });
  expect(signedIn.status).toBe(200);
  cookie = signedIn.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
}, 120_000);
afterAll(async () => {
  await connection?.close();
  await container?.stop();
});

function request(path: string, workspaceId?: string, body?: unknown) {
  return app.request(path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: cookie,
      Origin: base,
      "Content-Type": "application/json",
      ...(workspaceId === undefined
        ? {}
        : { "X-Issopen-Workspace": workspaceId }),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

it("adds only a verified invited membership and keeps each tab's context independent", async () => {
  expect((await (await request("/api/v1/session")).json()).workspace.id).toBe(
    workspaceA,
  );
  const created = await new InvitationService(connection.db).create(
    { workspaceId: workspaceB, userId: ownerB },
    { email: `${member}@example.test`, projectIds: [projectB] },
  );
  const token = created.token;
  const redeem = await request("/api/auth/invitations/redeem", undefined, {
    token,
  });
  expect(redeem.status).toBe(200);
  expect(
    (
      await request("/api/auth/invitations/accept", undefined, {
        invitationId: created.invitation.id,
      })
    ).status,
  ).toBe(403);
  const [invite] = await connection.db
    .select()
    .from(workspaceInvitation)
    .where(eq(workspaceInvitation.id, created.invitation.id));
  await connection.db.insert(account).values({
    id: randomUUID(),
    userId: member,
    accountId: randomUUID(),
    providerId: "google",
    issuer: "https://accounts.google.com",
    updatedAt: new Date((invite?.claimedAt?.getTime() ?? Date.now()) + 1000),
  });
  const accepted = await request("/api/auth/invitations/accept", undefined, {
    invitationId: created.invitation.id,
  });
  expect(accepted.status).toBe(200);
  // The accept flow rotates its own session; use the resulting cookie.
  cookie = accepted.headers.get("set-cookie")?.split(";", 1)[0] ?? cookie;
  const session = await (await request("/api/v1/session")).json();
  expect(session.workspace).toBeNull();
  expect(
    session.workspaces.map((entry: { id: string }) => entry.id).sort(),
  ).toEqual([workspaceA, workspaceB].sort());
  expect((await request("/api/v1/projects")).status).toBe(404);
  expect((await request("/api/v1/projects", randomUUID())).status).toBe(404);
  expect((await request("/api/v1/projects", "")).status).toBe(400);
  expect(
    (await request(`/api/v1/projects?workspace=${workspaceB}`, workspaceA))
      .status,
  ).toBe(400);
  expect(
    (await (await request("/api/v1/projects", workspaceA)).json()).projects.map(
      (p: { id: string }) => p.id,
    ),
  ).toEqual([projectA]);
  expect(
    (await (await request("/api/v1/projects", workspaceB)).json()).projects.map(
      (p: { id: string }) => p.id,
    ),
  ).toEqual([projectB]);
  expect(
    (await request(`/api/v1/projects/${projectA}`, workspaceB)).status,
  ).toBe(404);
  expect(
    (await request(`/api/v1/projects/${projectB}`, workspaceA)).status,
  ).toBe(404);
  const issue = await request(
    `/api/v1/projects/${projectA}/issues`,
    workspaceA,
    { title: "Tab A after tab B changed" },
  );
  expect(issue.status).toBe(201);
  expect((await issue.json()).issue.workspaceId).toBe(workspaceA);
  expect(
    (
      await request(`/api/v1/projects/${projectA}/issues`, workspaceB, {
        title: "Forbidden",
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await request("/api/v1/workspace", undefined, {
        name: "Must not bootstrap another",
      })
    ).status,
  ).toBe(409);
  const beforeSessions = await (
    await request("/api/v1/account/sessions", workspaceA)
  ).json();
  await new InvitationService(connection.db).removeMember(
    { workspaceId: workspaceA, userId: ownerA },
    member,
  );
  expect((await request("/api/v1/projects", workspaceA)).status).toBe(404);
  expect((await request("/api/v1/projects", workspaceB)).status).toBe(200);
  expect(
    await (await request("/api/v1/account/sessions", workspaceB)).json(),
  ).toEqual(beforeSessions);
});
