import { randomUUID } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { and, eq } from "drizzle-orm";
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
  issueComment,
  notification,
  projectMembership,
  user,
  workspace,
  workspaceMembership,
} from "../../src/server/db/schema.js";
import { TrackerService } from "../../src/server/domain/index.js";
import { emitDirectedNotification } from "../../src/server/notification-events.js";

const base = "http://localhost:8080",
  password = "synthetic-notification-test-password";
const owner = randomUUID(),
  member = randomUUID(),
  reader = randomUUID(),
  outsider = randomUUID(),
  space = randomUUID();
let container: StartedPostgreSqlContainer,
  connection: DatabaseConnection,
  app: ReturnType<typeof createApp>,
  tracker: TrackerService;
let projectId: string, otherProject: string;
const cookies = new Map<string, string>();
const context = {
  workspaceId: space,
  actor: {
    type: "human" as const,
    id: owner,
    displayName: "Notification owner",
  },
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
    BETTER_AUTH_SECRET: "synthetic-notification-auth-secret-for-tests",
  });
  const auth = createAuth(connection.db, config);
  app = createApp({
    db: connection.db,
    auth,
    logger: pino({ level: "silent" }),
    trustedOrigins: config.trustedOrigins,
  });
  const hash = await (await auth.$context).password.hash(password);
  await connection.db.insert(user).values(
    [owner, member, reader, outsider].map((id) => ({
      id,
      name: id === owner ? "Notification owner" : "Collaborator",
      email: `${id}@example.test`,
      emailVerified: true,
    })),
  );
  await connection.db.insert(account).values(
    [owner, member, reader].map((id) => ({
      id: randomUUID(),
      userId: id,
      accountId: id,
      providerId: "credential",
      issuer: "local:credential",
      password: hash,
    })),
  );
  await connection.db
    .insert(workspace)
    .values({ id: space, ownerId: owner, name: "Notifications" });
  await connection.db.insert(workspaceMembership).values(
    [owner, member, reader].map((id) => ({
      workspaceId: space,
      userId: id,
      role: id === owner ? ("owner" as const) : ("member" as const),
    })),
  );
  tracker = new TrackerService(connection.db);
  projectId = (
    await tracker.createProject(context, {
      name: "Notifications",
      key: "NOTIFY",
    })
  ).id;
  otherProject = (
    await tracker.createProject(context, { name: "Other", key: "OTHER" })
  ).id;
  await connection.db.insert(projectMembership).values([
    { workspaceId: space, userId: member, projectId, permission: "edit" },
    { workspaceId: space, userId: reader, projectId, permission: "read" },
  ]);
  for (const id of [owner, member, reader]) {
    const response = await app.request(`${base}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ email: `${id}@example.test`, password }),
    });
    expect(response.status).toBe(200);
    cookies.set(id, response.headers.get("set-cookie")?.split(";")[0] ?? "");
  }
}, 60000);
afterAll(async () => {
  await connection?.close();
  await container?.stop();
});
function request(
  id: string,
  path: string,
  body?: unknown,
  method = "PUT",
  contextId = space,
) {
  return app.request(`${base}/api/v1${path}`, {
    method: body === undefined ? "GET" : method,
    headers: {
      Cookie: cookies.get(id) ?? "",
      Origin: base,
      "X-Issopen-Workspace": contextId,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function inbox(id: string, query = "") {
  const response = await request(id, `/notifications${query}`);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  return response.json();
}
async function assign(ticketId: string, assigneeId: string | null) {
  const detail = await tracker.getIssueDetail(space, ticketId);
  const response = await request(owner, `/issues/${ticketId}/assignee`, {
    assigneeId,
    expectedVersion: detail.issue.version,
    questionVersions: detail.questions.map((q) => ({
      id: q.id,
      version: q.version,
    })),
  });
  expect(response.status).toBe(200);
}

it("emits directed events once, scopes counts/read markers, and obsoletes reassignment/review/questions", async () => {
  const ticket = await tracker.createIssue(context, {
    projectId,
    title: "Directed work",
  });
  await assign(ticket.id, member);
  let received = await inbox(member);
  expect(received.unread).toBe(1);
  expect(received.notifications[0]).toMatchObject({
    kind: "assignment",
    issueId: ticket.id,
    actionable: true,
  });
  const first = received.notifications[0];
  expect((await inbox(owner)).unread).toBe(0);
  expect(
    (await request(owner, `/notifications/${first.id}/read`, { read: true }))
      .status,
  ).toBe(404);
  for (let i = 0; i < 2; i++)
    expect(
      (await request(member, `/notifications/${first.id}/read`, { read: true }))
        .status,
    ).toBe(200);
  expect((await inbox(member)).unread).toBe(0);
  expect(
    (await request(member, `/notifications/${first.id}/read`, { read: false }))
      .status,
  ).toBe(200);
  const events = await connection.db
    .select()
    .from(activityEvent)
    .where(
      and(
        eq(activityEvent.issueId, ticket.id),
        eq(activityEvent.type, "issue.assignee_changed"),
      ),
    );
  const event = events[0];
  if (!event) throw Error("Missing assignment event");
  await connection.db.transaction((tx) => emitDirectedNotification(tx, event));
  expect((await inbox(member)).notifications).toHaveLength(1);
  expect((await inbox(member)).notifications[0].actionable).toBe(true);
  await assign(ticket.id, owner);
  expect((await inbox(owner)).unread).toBe(0); // No self-notification.
  expect((await inbox(member)).notifications[0].actionable).toBe(false);
  await assign(ticket.id, member);
  let current = await tracker.getIssue(space, ticket.id);
  await tracker.updateIssue(context, ticket.id, {
    status: "ready_for_review",
    expectedVersion: current.version,
    questionVersions: [],
  });
  received = await inbox(member);
  expect(
    received.notifications.find((n: { kind: string }) => n.kind === "review"),
  ).toMatchObject({ actionable: true });
  current = await tracker.getIssue(space, ticket.id);
  await tracker.updateIssue(context, ticket.id, {
    status: "in_progress",
    expectedVersion: current.version,
    questionVersions: [],
  });
  expect(
    (await inbox(member)).notifications.find(
      (n: { kind: string }) => n.kind === "review",
    ),
  ).toMatchObject({ actionable: false });
  const q = await tracker.createIssueQuestion(context, ticket.id, {
    prompt: "Which option?",
    recommendation: "A",
    options: [{ label: "A" }, { label: "B" }],
    recommendedOptionIndex: 0,
  });
  const redirect = async (id: string | null) => {
    const detail = await tracker.getIssueDetail(space, ticket.id);
    expect(
      (
        await request(
          owner,
          `/issues/${ticket.id}/questions/${q.id}/recipient`,
          {
            recipientId: id,
            expectedVersion: detail.issue.version,
            questionVersions: detail.questions.map((q) => ({
              id: q.id,
              version: q.version,
            })),
          },
        )
      ).status,
    ).toBe(200);
  };
  await redirect(member);
  expect(
    (await inbox(member)).notifications.find(
      (n: { kind: string }) => n.kind === "question",
    ),
  ).toMatchObject({ actionable: true, questionId: q.id });
  const updated = (await tracker.listIssueQuestions(space, ticket.id))[0];
  if (!updated?.options[0]) throw Error("Missing question option");
  await tracker.answerIssueQuestion(context, ticket.id, q.id, {
    kind: "option",
    expectedVersion: updated.version,
    optionId: updated.options[0].id,
  });
  expect(
    (await inbox(member)).notifications.find(
      (n: { kind: string }) => n.kind === "question",
    ),
  ).toMatchObject({ actionable: false });
  await redirect(null);
  expect(
    (await inbox(member)).notifications.find(
      (n: { kind: string }) => n.kind === "question",
    ),
  ).toMatchObject({ actionable: false });
  expect((await request(member, "/notifications?limit=999")).status).toBe(400);
  expect(
    (await request(member, "/notifications?recipientId=someone")).status,
  ).toBe(400);
});

it("mentions eligible people without grants, deduplicates concurrent retries, rejects changed payload and pages safely", async () => {
  const ticket = await tracker.createIssue(context, {
    projectId,
    title: "Mentioned work",
  });
  const path = `/issues/${ticket.id}/comments`,
    key = randomUUID();
  const body = {
    body: "<script>alert('literal text')</script>",
    mentionIds: [member, reader, owner, member],
    clientRequestId: key,
  };
  const responses = await Promise.all([
    request(owner, path, body, "POST"),
    request(owner, path, body, "POST"),
  ]);
  expect(responses.map((r) => r.status)).toEqual([201, 201]);
  const results = await Promise.all(responses.map((r) => r.json()));
  expect(results[0].comment.id).toBe(results[1].comment.id);
  expect(results[0].comment.mentions).toHaveLength(3);
  expect(results[0].comment).not.toHaveProperty("webRequestId");
  expect(results[0].comment).not.toHaveProperty("webRequestHash");
  expect(
    (await tracker.getIssueDetail(space, ticket.id)).comments[0],
  ).not.toHaveProperty("webRequestHash");
  expect(
    await connection.db
      .select()
      .from(issueComment)
      .where(eq(issueComment.issueId, ticket.id)),
  ).toHaveLength(1);
  expect(
    await connection.db
      .select()
      .from(notification)
      .where(eq(notification.issueId, ticket.id)),
  ).toHaveLength(2);
  expect(
    (await request(owner, path, { ...body, body: "changed" }, "POST")).status,
  ).toBe(409);
  expect((await request(reader, path, body, "POST")).status).toBe(403);
  expect(
    (
      await request(
        owner,
        path,
        { ...body, mentionIds: [outsider], clientRequestId: randomUUID() },
        "POST",
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await request(
        owner,
        path,
        { ...body, clientRequestId: undefined },
        "POST",
      )
    ).status,
  ).toBe(400);
  const first = await inbox(member, "?limit=1");
  expect(first.notifications).toHaveLength(1);
  expect(first.nextCursor).toBeTruthy();
  const second = await inbox(member, `?limit=1&cursor=${first.nextCursor}`);
  expect(second.notifications[0].id).not.toBe(first.notifications[0].id);
  expect(
    (await request(reader, `/notifications?limit=1&cursor=${first.nextCursor}`))
      .status,
  ).toBe(400);
  expect(
    (
      await request(
        member,
        `/notifications?status=unread&cursor=${first.nextCursor}`,
      )
    ).status,
  ).toBe(400);
  expect((await request(member, "/notifications?cursor=bad")).status).toBe(400);
  expect((await inbox(reader)).notifications[0]).toMatchObject({
    kind: "mention",
    issueId: ticket.id,
  });
  expect(
    await connection.db
      .select()
      .from(projectMembership)
      .where(eq(projectMembership.userId, outsider)),
  ).toHaveLength(0);
});

it("removes lost-access content/counts even with another grant/owned workspace and after request scope is chosen", async () => {
  const previous = await inbox(member);
  expect(previous.unread).toBeGreaterThan(0);
  await connection.db.insert(projectMembership).values({
    workspaceId: space,
    projectId: otherProject,
    userId: member,
    permission: "edit",
  });
  const anotherSpace = randomUUID();
  await connection.db
    .insert(workspace)
    .values({ id: anotherSpace, ownerId: member, name: "Other space" });
  await connection.db
    .insert(workspaceMembership)
    .values({ workspaceId: anotherSpace, userId: member, role: "owner" });
  await connection.db
    .delete(projectMembership)
    .where(
      and(
        eq(projectMembership.workspaceId, space),
        eq(projectMembership.userId, member),
        eq(projectMembership.projectId, projectId),
      ),
    );
  expect(await inbox(member)).toMatchObject({ unread: 0, notifications: [] });
  expect(
    (
      await request(
        member,
        `/notifications/${previous.notifications[0].id}/read`,
        { read: true },
      )
    ).status,
  ).toBe(404);
  expect(
    await (
      await request(member, "/notifications", undefined, "PUT", anotherSpace)
    ).json(),
  ).toMatchObject({ unread: 0, notifications: [] });
  expect(
    (
      await connection.db
        .select()
        .from(notification)
        .where(eq(notification.recipientId, member))
    ).length,
  ).toBeGreaterThan(0); // Audit retained, not returned.
});
