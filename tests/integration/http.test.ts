import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { count } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootstrapOwner } from "../../scripts/owner.js";
import { createApp } from "../../src/server/app.js";
import { createAuth, type IssopenAuth } from "../../src/server/auth.js";
import { loadConfig } from "../../src/server/config.js";
import {
  createDatabase,
  type DatabaseConnection,
} from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import {
  activityEvent,
  issue,
  issueComment,
  issueQuestion,
  project,
  user,
  workspace,
} from "../../src/server/db/schema.js";
import {
  AgentService,
  type MutationContext,
  TrackerService,
} from "../../src/server/domain/index.js";

const baseUrl = "http://localhost:8080";
const ownerInput = {
  email: "owner-http@example.test",
  password: "synthetic-http-owner-password-1",
  name: "HTTP Owner",
};

let container: StartedPostgreSqlContainer;
let connection: DatabaseConnection;
let auth: IssopenAuth;
let app: ReturnType<typeof createApp>;
let cookie: string;

function testConfig(databaseUrl: string) {
  return loadConfig({
    NODE_ENV: "test",
    PORT: "8080",
    DATABASE_URL: databaseUrl,
    ISSOPEN_BASE_URL: baseUrl,
    BETTER_AUTH_SECRET: "synthetic-http-better-auth-secret-for-tests",
  });
}

async function body<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function authenticatedRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);
  headers.set("Origin", baseUrl);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  return app.request(path, { ...init, headers });
}

async function createProjectFixture() {
  const response = await authenticatedRequest("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify({
      name: "Issopen",
      key: "iss",
      description: "Private dogfood tracker",
      repositoryUrl: "https://unreachable.invalid/issopen.git",
      defaultBranch: "main",
      repositorySubdirectory: ".",
    }),
  });
  expect(response.status).toBe(201);
  return (await body<{ project: { id: string; key: string } }>(response))
    .project;
}

async function createEpicFixture(projectId: string) {
  const response = await authenticatedRequest(
    `/api/v1/projects/${projectId}/epics`,
    {
      method: "POST",
      body: JSON.stringify({
        title: "Private MVP",
        description: "Group related acceptance tickets",
      }),
    },
  );
  expect(response.status).toBe(201);
  const created = (
    await body<{
      epic: {
        id: string;
        number: number;
        title: string;
        summary: {
          totalIssues: number;
          doneIssues: number;
          statusCounts: Record<string, number>;
        };
      };
    }>(response)
  ).epic;
  expect(created.summary).toEqual({
    totalIssues: 0,
    doneIssues: 0,
    statusCounts: {
      backlog: 0,
      ready: 0,
      in_progress: 0,
      ready_for_review: 0,
      done: 0,
    },
  });
  return created;
}

async function createIssueFixture(
  projectId: string,
  status = "backlog",
  epicId?: string,
) {
  const response = await authenticatedRequest(
    `/api/v1/projects/${projectId}/issues`,
    {
      method: "POST",
      body: JSON.stringify({
        title: "Implement protected REST",
        description: "Share the domain with web and MCP",
        priority: "high",
        status,
        ...(epicId ? { epicId } : {}),
      }),
    },
  );
  expect(response.status).toBe(201);
  return (
    await body<{
      issue: {
        id: string;
        key: string;
        status: string;
        epicId: string | null;
        version: number;
      };
    }>(response)
  ).issue;
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  await migrateDatabase(container.getConnectionUri());
  connection = createDatabase(container.getConnectionUri());
}, 120_000);

beforeEach(async () => {
  await connection.client.unsafe(
    'TRUNCATE TABLE "activity_event", "code_link", "issue", "project", "verification", "session", "account", "workspace", "instance_owner", "user" CASCADE',
  );
  const config = testConfig(container.getConnectionUri());
  auth = createAuth(connection.db, config);
  app = createApp({
    logger: pino({ level: "silent" }),
    db: connection.db,
    auth,
    trustedOrigins: config.trustedOrigins,
  });
  await bootstrapOwner(connection.db, auth, ownerInput);
  const signedIn = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({
      email: ownerInput.email,
      password: ownerInput.password,
    }),
  });
  expect(signedIn.status).toBe(200);
  cookie = signedIn.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  if (!cookie) throw new Error("Expected owner session cookie");

  const workspaceResponse = await authenticatedRequest("/api/v1/workspace", {
    method: "POST",
    body: JSON.stringify({ name: "HTTP workspace" }),
  });
  expect(workspaceResponse.status).toBe(201);
});

afterAll(async () => {
  await connection?.close();
  await container?.stop();
});

describe("protected tracker REST API", () => {
  it("denies anonymous reads and mutations before resolving tracker data", async () => {
    const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const requests: Array<[string, RequestInit | undefined]> = [
      ["/api/v1/projects", undefined],
      ["/api/v1/projects", { method: "POST", body: "{}" }],
      [`/api/v1/projects/${resourceId}/board`, undefined],
      [`/api/v1/projects/${resourceId}/epics`, undefined],
      [`/api/v1/projects/${resourceId}/epics`, { method: "POST", body: "{}" }],
      [`/api/v1/epics/${resourceId}`, undefined],
      [`/api/v1/epics/${resourceId}`, { method: "PATCH", body: "{}" }],
      [`/api/v1/issues/${resourceId}`, undefined],
      [`/api/v1/issues/${resourceId}`, { method: "PATCH", body: "{}" }],
      [`/api/v1/issues/${resourceId}/activity`, undefined],
      [
        `/api/v1/issues/${resourceId}/questions`,
        { method: "POST", body: "{}" },
      ],
      [`/api/v1/issues/${resourceId}/comments`, { method: "POST", body: "{}" }],
      [
        `/api/v1/issues/${resourceId}/questions/${resourceId}/answer`,
        { method: "PATCH", body: "{}" },
      ],
      [
        `/api/v1/issues/${resourceId}/code-links`,
        { method: "POST", body: "{}" },
      ],
      [`/api/v1/issues/${resourceId}/review/accept`, { method: "POST" }],
    ];

    for (const [path, init] of requests) {
      const response = await app.request(path, init);
      expect(response.status, `${init?.method ?? "GET"} ${path}`).toBe(401);
    }
  });

  it("lets only the owner reduce an existing agent grant", async () => {
    const firstProject = await createProjectFixture();
    const secondResponse = await authenticatedRequest("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Second project", key: "SEC" }),
    });
    const secondProject = (
      await body<{ project: { id: string } }>(secondResponse)
    ).project;
    const [personalWorkspace] = await connection.db.select().from(workspace);
    if (!personalWorkspace) throw new Error("Expected workspace fixture");
    const created = await new AgentService(connection.db).createAgent(
      personalWorkspace.id,
      {
        name: "Editable HTTP agent",
        projectIds: [firstProject.id, secondProject.id],
        scopes: ["issues:read", "issues:write"],
      },
    );

    const reduced = await authenticatedRequest(
      `/api/v1/agents/${created.agent.id}/access`,
      {
        method: "PATCH",
        body: JSON.stringify({
          projectIds: [firstProject.id],
          scopes: ["issues:read"],
        }),
      },
    );
    expect(reduced.status).toBe(200);
    expect(await body(reduced)).toMatchObject({
      agent: {
        id: created.agent.id,
        projectIds: [firstProject.id],
        scopes: ["issues:read"],
        access: { kind: "pat", revokedAt: null },
      },
    });

    const expansion = await authenticatedRequest(
      `/api/v1/agents/${created.agent.id}/access`,
      {
        method: "PATCH",
        body: JSON.stringify({
          projectIds: [firstProject.id, secondProject.id],
          scopes: ["issues:read"],
        }),
      },
    );
    expect(expansion.status).toBe(403);
    expect(JSON.stringify(await body(expansion))).not.toContain(created.token);

    const revoked = await authenticatedRequest(
      `/api/v1/agents/${created.agent.id}/revoke`,
      { method: "POST", body: "{}" },
    );
    expect(revoked.status).toBe(200);
    expect(await body(revoked)).toMatchObject({
      agent: { access: { kind: "pat", revokedAt: expect.any(String) } },
    });
    const listed = await authenticatedRequest("/api/v1/agents");
    const listedText = await listed.text();
    expect(listedText).not.toContain(created.token);
    expect(listedText).not.toContain("tokenHash");
  });

  it("serves authoritative project, issue, board, link, activity and review paths", async () => {
    const createdProject = await createProjectFixture();
    expect(createdProject.key).toBe("ISS");

    const projects = await authenticatedRequest("/api/v1/projects");
    expect(projects.status).toBe(200);
    expect(
      (await body<{ projects: unknown[] }>(projects)).projects,
    ).toHaveLength(1);

    const foundProject = await authenticatedRequest(
      `/api/v1/projects/${createdProject.id}`,
    );
    expect(foundProject.status).toBe(200);

    const updatedProject = await authenticatedRequest(
      `/api/v1/projects/${createdProject.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: "Issopen Tracker",
          description: "Updated",
        }),
      },
    );
    expect(updatedProject.status).toBe(200);
    expect(
      (
        await body<{ project: { key: string; version: number } }>(
          updatedProject,
        )
      ).project,
    ).toMatchObject({ key: "ISS", version: 2 });

    const immutableKey = await authenticatedRequest(
      `/api/v1/projects/${createdProject.id}`,
      { method: "PATCH", body: JSON.stringify({ key: "NEW" }) },
    );
    expect(immutableKey.status).toBe(400);

    const createdEpic = await createEpicFixture(createdProject.id);
    expect(createdEpic.title).toBe("Private MVP");
    expect(createdEpic.number).toBe(1);
    const createdIssue = await createIssueFixture(
      createdProject.id,
      "backlog",
      createdEpic.id,
    );
    expect(createdIssue).toMatchObject({
      key: "ISS-1",
      status: "backlog",
      epicId: createdEpic.id,
    });

    const epics = await authenticatedRequest(
      `/api/v1/projects/${createdProject.id}/epics`,
    );
    expect(await body(epics)).toMatchObject({
      epics: [
        {
          id: createdEpic.id,
          number: 1,
          summary: {
            totalIssues: 1,
            doneIssues: 0,
            statusCounts: { backlog: 1 },
          },
        },
      ],
    });

    const epicDetail = await authenticatedRequest(
      `/api/v1/epics/${createdEpic.id}`,
    );
    expect(await body(epicDetail)).toMatchObject({
      epic: { id: createdEpic.id, number: 1 },
      issues: [{ id: createdIssue.id }],
    });

    const updatedEpic = await authenticatedRequest(
      `/api/v1/epics/${createdEpic.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title: "MVP acceptance" }),
      },
    );
    expect(await body(updatedEpic)).toMatchObject({
      epic: { number: 1, title: "MVP acceptance", version: 2 },
    });

    const issueList = await authenticatedRequest(
      `/api/v1/projects/${createdProject.id}/issues`,
    );
    expect((await body<{ issues: unknown[] }>(issueList)).issues).toHaveLength(
      1,
    );

    const updatedIssue = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: "Protected REST ready",
          priority: "urgent",
          status: "ready_for_review",
        }),
      },
    );
    expect(updatedIssue.status).toBe(200);
    expect(
      (
        await body<{ issue: { status: string; priority: string } }>(
          updatedIssue,
        )
      ).issue,
    ).toMatchObject({ status: "ready_for_review", priority: "urgent" });

    const questionResponse = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}/questions`,
      {
        method: "POST",
        body: JSON.stringify({
          prompt: "Which rollout should we use?",
          recommendation: "Use a canary rollout.",
          options: [
            { label: "Canary", description: "Lowest production risk" },
            { label: "Immediate", description: "Fastest" },
          ],
          recommendedOptionIndex: 0,
          blocking: true,
        }),
      },
    );
    expect(questionResponse.status).toBe(201);
    const question = (
      await body<{
        question: {
          id: string;
          recommendedOptionId: string;
          options: Array<{ id: string; label: string }>;
        };
      }>(questionResponse)
    ).question;
    expect(question.options).toHaveLength(2);
    expect(question.recommendedOptionId).toBe(question.options[0]?.id);

    const board = await authenticatedRequest(
      `/api/v1/projects/${createdProject.id}/board?epicId=${createdEpic.id}`,
    );
    const boardBody = await body<{
      columns: Array<{
        status: string;
        issues: Array<{
          questionSummary: {
            total: number;
            answered: number;
            unansweredBlocking: number;
          };
        }>;
      }>;
    }>(board);
    expect(boardBody.columns.map((column) => column.status)).toEqual([
      "backlog",
      "ready",
      "in_progress",
      "ready_for_review",
      "done",
    ]);
    expect(
      boardBody.columns.find((column) => column.status === "ready_for_review")
        ?.issues,
    ).toHaveLength(1);
    expect(
      boardBody.columns.find((column) => column.status === "ready_for_review")
        ?.issues[0]?.questionSummary,
    ).toEqual({ total: 1, answered: 0, unansweredBlocking: 1 });

    const answered = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}/questions/${question.id}/answer`,
      {
        method: "PATCH",
        body: JSON.stringify({
          kind: "option",
          optionId: question.options[0]?.id,
        }),
      },
    );
    expect(answered.status).toBe(200);
    expect(
      (await body<{ questionSummary: Record<string, number> }>(answered))
        .questionSummary,
    ).toEqual({ total: 1, answered: 1, unansweredBlocking: 0 });

    const changedAnswer = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}/questions/${question.id}/answer`,
      {
        method: "PATCH",
        body: JSON.stringify({ kind: "other", text: "Stage it manually." }),
      },
    );
    expect(changedAnswer.status).toBe(200);
    expect(
      (
        await body<{
          question: { answerOptionId: string | null; answerOtherText: string };
        }>(changedAnswer)
      ).question,
    ).toMatchObject({
      answerOptionId: null,
      answerOtherText: "Stage it manually.",
    });

    const linked = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}/code-links`,
      {
        method: "POST",
        body: JSON.stringify({
          type: "commit",
          url: "https://example.test/commit/abc123",
        }),
      },
    );
    expect(linked.status).toBe(201);

    const commented = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}/comments`,
      {
        method: "POST",
        body: JSON.stringify({
          body: "Human review checkpoint. <script>untrusted()</script>",
        }),
      },
    );
    expect(commented.status).toBe(201);
    expect(
      (
        await body<{
          comment: {
            body: string;
            authorType: string;
            authorDisplayName: string;
            source: string;
          };
        }>(commented)
      ).comment,
    ).toMatchObject({
      body: "Human review checkpoint. <script>untrusted()</script>",
      authorType: "human",
      authorDisplayName: ownerInput.name,
      source: "rest",
    });

    const detail = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}`,
    );
    expect(detail.status).toBe(200);
    const detailBody = await body<{
      codeLinks: unknown[];
      comments: unknown[];
      questions: unknown[];
      questionSummary: Record<string, number>;
    }>(detail);
    expect(detailBody.codeLinks).toHaveLength(1);
    expect(detailBody.comments).toHaveLength(1);
    expect(detailBody.questions).toHaveLength(1);
    expect(detailBody.questionSummary).toEqual({
      total: 1,
      answered: 1,
      unansweredBlocking: 0,
    });

    const accepted = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}/review/accept`,
      { method: "POST" },
    );
    expect(accepted.status).toBe(200);
    expect(
      (await body<{ issue: { status: string } }>(accepted)).issue.status,
    ).toBe("done");

    const changesIssue = await createIssueFixture(
      createdProject.id,
      "ready_for_review",
    );
    const requestedChanges = await authenticatedRequest(
      `/api/v1/issues/${changesIssue.id}/review/request-changes`,
      {
        method: "POST",
        body: JSON.stringify({ reason: "Add a regression test" }),
      },
    );
    expect(requestedChanges.status).toBe(200);
    expect(
      (await body<{ issue: { status: string } }>(requestedChanges)).issue
        .status,
    ).toBe("in_progress");

    const activity = await authenticatedRequest(
      `/api/v1/issues/${changesIssue.id}/activity`,
    );
    const activityBody = await body<{
      activity: Array<{
        type: string;
        actorType: string;
        actorId: string;
        source: string;
        changes: Record<string, unknown>;
      }>;
    }>(activity);
    expect(activityBody.activity.at(-1)).toMatchObject({
      type: "review.changes_requested",
      actorType: "human",
      source: "rest",
      changes: { reason: "Add a regression test" },
    });
    expect(
      activityBody.activity.every((event) => event.actorId.length > 0),
    ).toBe(true);
  });

  it("returns a conflict until blocking questions are answered", async () => {
    const createdProject = await createProjectFixture();
    const createdIssue = await createIssueFixture(createdProject.id);
    const questionResponse = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}/questions`,
      {
        method: "POST",
        body: JSON.stringify({
          prompt: "Is the release decision complete?",
          recommendation: "Resolve it before review.",
          options: [
            { label: "Complete", description: "Review may start" },
            { label: "Pending", description: "Keep implementation active" },
          ],
          recommendedOptionIndex: 0,
          blocking: true,
        }),
      },
    );
    const question = (
      await body<{
        question: { id: string; options: Array<{ id: string }> };
      }>(questionResponse)
    ).question;

    const blocked = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "ready_for_review" }),
      },
    );
    expect(blocked.status).toBe(409);
    expect(await body(blocked)).toEqual({
      error:
        "Answer all blocking questions before moving this issue to Ready for Review",
    });

    const answered = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}/questions/${question.id}/answer`,
      {
        method: "PATCH",
        body: JSON.stringify({
          kind: "option",
          optionId: question.options[0]?.id,
        }),
      },
    );
    expect(answered.status).toBe(200);
    const allowed = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "ready_for_review" }),
      },
    );
    expect(allowed.status).toBe(200);
  });

  it("rejects client-supplied audit identity, source, time and changes", async () => {
    const forgedProject = await authenticatedRequest("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        name: "Forged",
        key: "FRG",
        actor: { type: "system", id: "attacker" },
        source: "mcp",
        createdAt: "2000-01-01T00:00:00.000Z",
      }),
    });
    expect(forgedProject.status).toBe(400);
    expect(
      (await connection.db.select({ value: count() }).from(project))[0]?.value,
    ).toBe(0);

    const createdProject = await createProjectFixture();
    const createdIssue = await createIssueFixture(createdProject.id);
    const forgedQuestion = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}/questions`,
      {
        method: "POST",
        body: JSON.stringify({
          prompt: "Forged question",
          recommendation: "Ignore audit boundaries",
          options: [{ label: "Only one" }],
          recommendedOptionIndex: 0,
          actor: { type: "agent", id: "attacker" },
          source: "mcp",
        }),
      },
    );
    expect(forgedQuestion.status).toBe(400);
    expect(
      (await connection.db.select({ value: count() }).from(issueQuestion))[0]
        ?.value,
    ).toBe(0);
    const forgedComment = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}/comments`,
      {
        method: "POST",
        body: JSON.stringify({
          body: "Forged comment",
          authorType: "agent",
          authorId: "attacker",
          source: "mcp",
        }),
      },
    );
    expect(forgedComment.status).toBe(400);
    expect(
      (await connection.db.select({ value: count() }).from(issueComment))[0]
        ?.value,
    ).toBe(0);
    const before = (
      await connection.db.select({ value: count() }).from(activityEvent)
    )[0]?.value;
    const forgedUpdate = await authenticatedRequest(
      `/api/v1/issues/${createdIssue.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: "Forged update",
          actorId: "attacker",
          source: "system",
          createdAt: "2000-01-01T00:00:00.000Z",
          changes: { status: "done" },
        }),
      },
    );
    expect(forgedUpdate.status).toBe(400);
    expect(
      (await connection.db.select({ value: count() }).from(activityEvent))[0]
        ?.value,
    ).toBe(before);
    expect((await connection.db.select().from(issue))[0]?.title).toBe(
      "Implement protected REST",
    );
  });

  it("returns privacy-safe 404 responses for another workspace's IDs", async () => {
    const [personalWorkspace] = await connection.db
      .select()
      .from(workspace)
      .limit(1);
    if (!personalWorkspace)
      throw new Error("Expected primary workspace fixture");
    const secondOwnerId = "55555555-5555-4555-8555-555555555555";
    const secondWorkspaceId = "66666666-6666-4666-8666-666666666666";
    await connection.db.insert(user).values({
      id: secondOwnerId,
      name: "Foreign owner",
      email: "foreign-http@example.test",
    });
    await connection.db.insert(workspace).values({
      id: secondWorkspaceId,
      ownerId: secondOwnerId,
      name: "Foreign workspace",
    });
    const foreignContext: MutationContext = {
      workspaceId: secondWorkspaceId,
      actor: { type: "human", id: secondOwnerId, displayName: "Foreign owner" },
      source: "rest",
    };
    const tracker = new TrackerService(connection.db);
    const foreignProject = await tracker.createProject(foreignContext, {
      name: "Foreign project",
      key: "FOR",
    });
    const foreignIssue = await tracker.createIssue(foreignContext, {
      projectId: foreignProject.id,
      title: "Foreign private issue",
    });
    const foreignQuestion = await tracker.createIssueQuestion(
      foreignContext,
      foreignIssue.id,
      {
        prompt: "Private foreign decision?",
        recommendation: "Keep it private.",
        options: [{ label: "Yes" }, { label: "No" }],
        recommendedOptionIndex: 0,
      },
    );

    const routes = [
      `/api/v1/projects/${foreignProject.id}`,
      `/api/v1/projects/${foreignProject.id}/board`,
      `/api/v1/issues/${foreignIssue.id}`,
      `/api/v1/issues/${foreignIssue.id}/activity`,
    ];
    for (const route of routes) {
      const response = await authenticatedRequest(route);
      expect(response.status, route).toBe(404);
      expect(await response.json()).toEqual({
        error: "This page isn't available",
      });
    }

    const mutation = await authenticatedRequest(
      `/api/v1/issues/${foreignIssue.id}`,
      { method: "PATCH", body: JSON.stringify({ title: "Stolen" }) },
    );
    expect(mutation.status).toBe(404);
    expect(
      (await tracker.getIssue(secondWorkspaceId, foreignIssue.id)).title,
    ).toBe("Foreign private issue");
    const addQuestion = await authenticatedRequest(
      `/api/v1/issues/${foreignIssue.id}/questions`,
      {
        method: "POST",
        body: JSON.stringify({
          prompt: "Steal?",
          recommendation: "No",
          options: [{ label: "No" }, { label: "Yes" }],
          recommendedOptionIndex: 0,
        }),
      },
    );
    expect(addQuestion.status).toBe(404);
    const addComment = await authenticatedRequest(
      `/api/v1/issues/${foreignIssue.id}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ body: "Steal this context" }),
      },
    );
    expect(addComment.status).toBe(404);
    const answerQuestion = await authenticatedRequest(
      `/api/v1/issues/${foreignIssue.id}/questions/${foreignQuestion.id}/answer`,
      {
        method: "PATCH",
        body: JSON.stringify({
          kind: "option",
          optionId: foreignQuestion.options[0]?.id,
        }),
      },
    );
    expect(answerQuestion.status).toBe(404);
  });
});
