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
  issue,
  projectMembership,
  user,
  workspace,
  workspaceMembership,
} from "../../src/server/db/schema.js";
import { TrackerService } from "../../src/server/domain/index.js";
import { InvitationService } from "../../src/server/invitations.js";

const base = "http://localhost:8080",
  password = "synthetic-assignment-test-password";
const owner = randomUUID(),
  editor = randomUUID(),
  reader = randomUUID(),
  foreign = randomUUID();
const space = randomUUID();
let container: StartedPostgreSqlContainer,
  connection: DatabaseConnection,
  app: ReturnType<typeof createApp>,
  tracker: TrackerService;
let projectId: string, otherProject: string;
const cookies = new Map<string, string>();
const context = {
  workspaceId: space,
  actor: { type: "human" as const, id: owner, displayName: "Assignment owner" },
  source: "rest" as const,
};
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  await migrateDatabase(container.getConnectionUri());
  connection = createDatabase(container.getConnectionUri());
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: container.getConnectionUri(),
    ISSOPEN_BASE_URL: base,
    BETTER_AUTH_SECRET: "synthetic-assignment-auth-secret-for-tests",
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
    [owner, editor, reader, foreign].map((id) => ({
      id,
      name: id === owner ? "Assignment owner" : "Same name",
      email: `${id}@example.test`,
      emailVerified: true,
    })),
  );
  await connection.db.insert(account).values(
    [owner, editor, reader].map((id) => ({
      id: randomUUID(),
      userId: id,
      accountId: id,
      providerId: "credential",
      issuer: "local:credential",
      password: hashed,
    })),
  );
  await connection.db
    .insert(workspace)
    .values({ id: space, ownerId: owner, name: "Assignments" });
  await connection.db.insert(workspaceMembership).values(
    [owner, editor, reader].map((id) => ({
      workspaceId: space,
      userId: id,
      role: id === owner ? ("owner" as const) : ("member" as const),
    })),
  );
  tracker = new TrackerService(connection.db);
  projectId = (
    await tracker.createProject(context, { name: "Assignments", key: "ASS" })
  ).id;
  otherProject = (
    await tracker.createProject(context, { name: "Other", key: "OTHER" })
  ).id;
  await connection.db.insert(projectMembership).values([
    { workspaceId: space, userId: editor, projectId, permission: "edit" },
    { workspaceId: space, userId: reader, projectId, permission: "read" },
  ]);
  for (const id of [owner, editor, reader]) {
    const response = await app.request(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ email: `${id}@example.test`, password }),
    });
    expect(response.status).toBe(200);
    cookies.set(id, response.headers.get("set-cookie")?.split(";")[0] ?? "");
  }
}, 60_000);
afterAll(async () => {
  await connection?.close();
  await container?.stop();
});
function request(
  id: string,
  path: string,
  body?: unknown,
  origin = base,
  method = "PUT",
) {
  return app.request(`${base}/api/v1${path}`, {
    method: body === undefined ? "GET" : method,
    headers: {
      Cookie: cookies.get(id) ?? "",
      Origin: origin,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

it("assigns only within editable project, CAS/audit independent of owner and claim", async () => {
  const ticket = await tracker.createIssue(context, {
    projectId,
    title: "Assignment test",
  });
  const body = {
    assigneeId: reader,
    expectedVersion: ticket.version,
    questionVersions: [],
  };
  const path = `/issues/${ticket.id}/assignee`;
  expect((await request(reader, path, body)).status).toBe(403);
  expect(
    (await request(editor, path, body, "https://evil.example")).status,
  ).toBe(403);
  expect((await request(foreign, path, body)).status).toBe(401);
  expect(
    (await request(editor, path, { ...body, assigneeId: foreign })).status,
  ).toBe(400);
  expect(
    (await request(editor, path, { ...body, humanOwnerId: editor })).status,
  ).toBe(400);
  expect(
    (
      await request(
        editor,
        `/issues/${ticket.id}`,
        { humanAssigneeId: reader },
        base,
        "PATCH",
      )
    ).status,
  ).toBe(400);
  const elsewhere = await tracker.createIssue(context, {
    projectId: otherProject,
    title: "Foreign",
  });
  expect(
    (await request(editor, `/issues/${elsewhere.id}/assignee`, body)).status,
  ).toBe(404);
  const races = await Promise.all([
    request(editor, path, body),
    request(owner, path, { ...body, assigneeId: owner }),
  ]);
  expect(races.map((r) => r.status).sort()).toEqual([200, 409]);
  let current = await tracker.getIssue(space, ticket.id);
  expect(current.humanOwnerId).toBe(owner);
  expect(current.claimedByAgentId).toBeNull();
  expect(current.humanAssigneeHasAccess).toBe(true);
  expect(current.version).toBe(ticket.version + 1);
  const events = await connection.db
    .select()
    .from(activityEvent)
    .where(eq(activityEvent.issueId, ticket.id));
  const assigned = events.filter((e) => e.type === "issue.assignee_changed");
  expect(assigned).toHaveLength(1);
  expect(assigned[0]?.actorType).toBe("human");
  expect(JSON.stringify(assigned)).not.toContain("@example.test");
  const q = await tracker.createIssueQuestion(context, ticket.id, {
    prompt: "Decision?",
    recommendation: "A",
    options: [{ label: "A" }, { label: "B" }],
    recommendedOptionIndex: 0,
  });
  current = await tracker.getIssue(space, ticket.id);
  expect(
    (
      await request(editor, path, {
        ...body,
        expectedVersion: current.version,
        assigneeId: null,
      })
    ).status,
  ).toBe(409);
  const changed = await request(editor, path, {
    assigneeId: null,
    expectedVersion: current.version,
    questionVersions: [{ id: q.id, version: q.version }],
  });
  expect(changed.status).toBe(200);
  expect((await changed.json()).issue.humanAssigneeId).toBeNull();
});

it("keeps removed assignee attribution without access, filters consistently and rejects archived/deleted mutations", async () => {
  const ticket = await tracker.createIssue(context, {
    projectId,
    title: "Access withdrawn",
  });
  let response = await request(owner, `/issues/${ticket.id}/assignee`, {
    assigneeId: reader,
    expectedVersion: ticket.version,
    questionVersions: [],
  });
  expect(response.status).toBe(200);
  const current = (await response.json()).issue;
  const mine = await (
    await request(reader, `/projects/${projectId}/board?assignee=mine`)
  ).json();
  expect(
    mine.columns
      .flatMap((column: { issues: { id: string }[] }) => column.issues)
      .map((row: { id: string }) => row.id),
  ).toEqual([ticket.id]);
  const person = await (
    await request(owner, `/projects/${projectId}/issues?assignee=${reader}`)
  ).json();
  expect(person.issues.map((row: { id: string }) => row.id)).toEqual([
    ticket.id,
  ]);
  const page = await tracker.listIssuePage(space, {
    projectIds: [projectId],
    claim: "any",
    agentId: "unused",
    assignee: reader,
    limit: 1,
  });
  expect(page.items.map((row) => row.id)).toEqual([ticket.id]);
  expect(page.items[0]?.humanAssigneeHasAccess).toBe(true);
  const [membership] = await connection.db
    .select()
    .from(workspaceMembership)
    .where(eq(workspaceMembership.userId, reader));
  if (!membership) throw new Error("Missing synthetic reader membership");
  await new InvitationService(connection.db).updateMember(
    { workspaceId: space, userId: owner },
    reader,
    { expectedVersion: membership.version, grants: [] },
  );
  await connection.db
    .update(user)
    .set({ name: "Private future name" })
    .where(eq(user.id, reader));
  const removed = await tracker.getIssue(space, ticket.id);
  expect(removed.humanAssigneeHasAccess).toBe(false);
  expect(removed.humanAssigneeName).toBe("Same name");
  expect((await request(reader, `/issues/${ticket.id}`)).status).toBe(404);
  expect(
    (
      await request(owner, `/issues/${ticket.id}/assignee`, {
        assigneeId: reader,
        expectedVersion: current.version,
        questionVersions: [],
      })
    ).status,
  ).toBe(400);
  response = await request(editor, `/issues/${ticket.id}/assignee`, {
    assigneeId: null,
    expectedVersion: current.version,
    questionVersions: [],
  });
  expect(response.status).toBe(200);
  const unassigned = await (
    await request(editor, `/projects/${projectId}/issues?assignee=unassigned`)
  ).json();
  expect(
    unassigned.issues.some((row: { id: string }) => row.id === ticket.id),
  ).toBe(true);
  const group = await tracker.createEpic(context, {
    projectId,
    title: "Archived assignments",
  });
  const archivedTicket = await tracker.createIssue(context, {
    projectId,
    epicId: group.id,
    title: "Archived",
  });
  await tracker.updateEpic(context, group.id, { archived: true });
  expect(
    (
      await request(editor, `/issues/${archivedTicket.id}/assignee`, {
        assigneeId: editor,
        expectedVersion: archivedTicket.version,
        questionVersions: [],
      })
    ).status,
  ).toBe(409);
  const toDelete = await tracker.getIssue(space, ticket.id);
  await tracker.deleteIssue(context, ticket.id, {
    expectedVersion: toDelete.version,
    questionVersions: [],
  });
  expect(
    (
      await request(owner, `/issues/${ticket.id}/assignee`, {
        assigneeId: owner,
        expectedVersion: toDelete.version,
        questionVersions: [],
      })
    ).status,
  ).toBe(404);
  const [retained] = await connection.db
    .select()
    .from(issue)
    .where(eq(issue.id, ticket.id));
  expect(retained?.humanOwnerId).toBe(owner);
});
