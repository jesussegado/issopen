import { randomUUID } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { count, eq } from "drizzle-orm";
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
  account,
  activityEvent,
  issue,
  issueComment,
  issueQuestion,
  project,
  projectMembership,
  user,
  workspace,
  workspaceInvitation,
  workspaceInvitationEvent,
  workspaceMembership,
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

async function requestWithCookie(
  sessionCookie: string,
  path: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", sessionCookie);
  headers.set("Origin", baseUrl);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  return app.request(path, { ...init, headers });
}

async function createMemberSession(projectIds: string[], suffix = "member") {
  const [personalWorkspace] = await connection.db
    .select({ id: workspace.id })
    .from(workspace)
    .limit(1);
  if (!personalWorkspace) throw new Error("Expected workspace fixture");
  const member = {
    id: randomUUID(),
    email: `${suffix}-http@example.test`,
    password: "synthetic-http-member-password-1",
    name: `HTTP ${suffix}`,
  };
  const password = await (await auth.$context).password.hash(member.password);
  await connection.db.transaction(async (tx) => {
    await tx.insert(user).values({
      id: member.id,
      email: member.email,
      name: member.name,
      emailVerified: true,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      issuer: "local:credential",
      accountId: member.id,
      providerId: "credential",
      userId: member.id,
      password,
    });
    await tx.insert(workspaceMembership).values({
      workspaceId: personalWorkspace.id,
      userId: member.id,
      role: "member",
    });
    if (projectIds.length > 0) {
      await tx.insert(projectMembership).values(
        projectIds.map((projectId) => ({
          workspaceId: personalWorkspace.id,
          projectId,
          userId: member.id,
        })),
      );
    }
  });
  const signedIn = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify(member),
  });
  expect(signedIn.status).toBe(200);
  const memberCookie = signedIn.headers.get("set-cookie")?.split(";", 1)[0];
  if (!memberCookie) throw new Error("Expected member session cookie");
  return memberCookie;
}

async function createProjectFixture(name = "Issopen", key = "iss") {
  const response = await authenticatedRequest("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify({
      name,
      key,
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
  it("invites a member through a one-use link, explicit Google proof and revocable access", async () => {
    const assignedProject = await createProjectFixture("Invited", "INVITE");
    const privateProject = await createProjectFixture("Owner only", "OWNER");
    const invitedEmail = "new-member@example.test";

    const created = await authenticatedRequest("/api/v1/invitations", {
      method: "POST",
      body: JSON.stringify({
        email: `  ${invitedEmail.toUpperCase()}  `,
        projectIds: [assignedProject.id],
      }),
    });
    expect(created.status).toBe(201);
    const creation = await body<{
      invitation: { id: string; email: string; state: string };
      inviteUrl: string;
    }>(created);
    expect(creation.invitation).toMatchObject({
      email: invitedEmail,
      state: "pending",
    });
    const token = new URL(creation.inviteUrl).pathname.split("/").at(-1) ?? "";
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const [stored] = await connection.db
      .select()
      .from(workspaceInvitation)
      .where(eq(workspaceInvitation.id, creation.invitation.id));
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.tokenHash).not.toBe(token);

    const inspected = await app.request(`/api/public/invitations/${token}`);
    expect(inspected.status).toBe(200);
    const publicText = await inspected.clone().text();
    expect(publicText).not.toContain(invitedEmail);
    expect(await inspected.json()).toMatchObject({
      invitation: {
        id: creation.invitation.id,
        workspaceName: "HTTP workspace",
        state: "pending",
      },
    });

    const redeemed = await app.request("/api/auth/invitations/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ token }),
    });
    expect(redeemed.status).toBe(200);
    expect(await redeemed.json()).toEqual({
      invitationId: creation.invitation.id,
      requiresGoogleVerification: true,
    });
    const provisionalCookie =
      redeemed.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    expect(provisionalCookie).toContain("issopen.session_token=");

    const anonymousReplay = await app.request("/api/auth/invitations/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ token }),
    });
    expect(anonymousReplay.status).toBe(409);

    const authenticatedResume = await app.request(
      "/api/auth/invitations/redeem",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: provisionalCookie,
          Origin: baseUrl,
        },
        body: JSON.stringify({ token }),
      },
    );
    expect(authenticatedResume.status).toBe(200);
    expect(authenticatedResume.headers.get("set-cookie")).toBeNull();

    const beforeGoogle = await app.request("/api/auth/invitations/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: provisionalCookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ invitationId: creation.invitation.id }),
    });
    expect(beforeGoogle.status).toBe(403);
    expect(await beforeGoogle.json()).toMatchObject({
      code: "GOOGLE_REAUTH_REQUIRED",
    });

    const [claimed] = await connection.db
      .select()
      .from(workspaceInvitation)
      .where(eq(workspaceInvitation.id, creation.invitation.id));
    expect(claimed?.claimedByUserId).toBeTruthy();
    if (!claimed?.claimedByUserId || !claimed.claimedAt) {
      throw new Error("Expected a claimed invitation");
    }
    await connection.db.insert(account).values({
      id: randomUUID(),
      issuer: "https://accounts.google.com",
      accountId: "synthetic-google-subject",
      providerId: "google",
      userId: claimed.claimedByUserId,
      updatedAt: new Date(claimed.claimedAt.getTime() + 1_000),
    });

    const accepted = await app.request("/api/auth/invitations/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: provisionalCookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ invitationId: creation.invitation.id }),
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({
      membership: {
        invitationId: creation.invitation.id,
        role: "member",
      },
    });
    const memberCookie = accepted.headers.get("set-cookie")?.split(";", 1)[0];
    if (!memberCookie) throw new Error("Expected a full member session cookie");

    const visibleProjects = await requestWithCookie(
      memberCookie,
      "/api/v1/projects",
    );
    expect(visibleProjects.status).toBe(200);
    expect(
      (
        await body<{ projects: Array<{ id: string }> }>(visibleProjects)
      ).projects.map((item) => item.id),
    ).toEqual([assignedProject.id]);
    expect(
      (
        await requestWithCookie(
          memberCookie,
          `/api/v1/projects/${privateProject.id}`,
        )
      ).status,
    ).toBe(404);

    const members = await authenticatedRequest("/api/v1/members");
    expect(members.status).toBe(200);
    const memberList = await body<{
      members: Array<{
        userId: string;
        role: string;
        projectIds: string[] | null;
      }>;
    }>(members);
    expect(
      memberList.members.find(
        (member) => member.userId === claimed.claimedByUserId,
      ),
    ).toMatchObject({
      role: "member",
      projectIds: [assignedProject.id],
    });

    const removed = await authenticatedRequest(
      `/api/v1/members/${claimed.claimedByUserId}`,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(200);
    expect(
      (await requestWithCookie(memberCookie, "/api/v1/session")).status,
    ).toBe(401);
    await expect(
      connection.db
        .update(workspaceInvitationEvent)
        .set({ type: "tampered" })
        .where(
          eq(workspaceInvitationEvent.invitationId, creation.invitation.id),
        ),
    ).rejects.toThrow();
  });

  it("expires, rotates and revokes invitation links without silently merging accounts", async () => {
    const assignedProject = await createProjectFixture("Shared", "SHARED");
    const createInvite = async (email: string) => {
      const response = await authenticatedRequest("/api/v1/invitations", {
        method: "POST",
        body: JSON.stringify({ email, projectIds: [assignedProject.id] }),
      });
      expect(response.status).toBe(201);
      const result = await body<{
        invitation: { id: string };
        inviteUrl: string;
      }>(response);
      return {
        id: result.invitation.id,
        token: new URL(result.inviteUrl).pathname.split("/").at(-1) ?? "",
      };
    };
    const redeem = (token: string, sessionCookie?: string) =>
      app.request("/api/auth/invitations/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: baseUrl,
          ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        },
        body: JSON.stringify({ token }),
      });

    const revocable = await createInvite("revoked@example.test");
    const claimed = await redeem(revocable.token);
    expect(claimed.status).toBe(200);
    const claimedCookie = claimed.headers.get("set-cookie")?.split(";", 1)[0];
    if (!claimedCookie) throw new Error("Expected a provisional session");
    expect(
      (
        await authenticatedRequest(
          `/api/v1/invitations/${revocable.id}/revoke`,
          { method: "POST" },
        )
      ).status,
    ).toBe(200);
    expect((await redeem(revocable.token, claimedCookie)).status).toBe(403);
    expect(
      (
        await app.request("/api/auth/invitations/accept", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: baseUrl,
            Cookie: claimedCookie,
          },
          body: JSON.stringify({ invitationId: revocable.id }),
        })
      ).status,
    ).toBe(401);

    const expiring = await createInvite("expired@example.test");
    await connection.db
      .update(workspaceInvitation)
      .set({ expiresAt: new Date(0) })
      .where(eq(workspaceInvitation.id, expiring.id));
    expect((await redeem(expiring.token)).status).toBe(410);

    const rotating = await createInvite("rotated@example.test");
    const resent = await authenticatedRequest(
      `/api/v1/invitations/${rotating.id}/resend`,
      { method: "POST" },
    );
    expect(resent.status).toBe(200);
    const resentBody = await body<{ inviteUrl: string }>(resent);
    const rotatedToken =
      new URL(resentBody.inviteUrl).pathname.split("/").at(-1) ?? "";
    expect(rotatedToken).not.toBe(rotating.token);
    expect(
      (await app.request(`/api/public/invitations/${rotating.token}`)).status,
    ).toBe(404);
    expect((await redeem(rotatedToken)).status).toBe(200);

    const existingUser = {
      id: randomUUID(),
      email: "existing@example.test",
      name: "Existing account",
      password: "synthetic-existing-member-password-1",
    };
    const password = await (await auth.$context).password.hash(
      existingUser.password,
    );
    await connection.db.insert(user).values({
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      emailVerified: true,
    });
    await connection.db.insert(account).values({
      id: randomUUID(),
      issuer: "local:credential",
      accountId: existingUser.id,
      providerId: "credential",
      userId: existingUser.id,
      password,
    });
    const existingInvite = await createInvite(existingUser.email);
    const anonymousExisting = await redeem(existingInvite.token);
    expect(anonymousExisting.status).toBe(409);
    expect(await anonymousExisting.json()).toMatchObject({
      code: "EXISTING_ACCOUNT_REQUIRES_SIGN_IN",
    });
    expect((await redeem(existingInvite.token, cookie)).status).toBe(403);

    const signedIn = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({
        email: existingUser.email,
        password: existingUser.password,
      }),
    });
    expect(signedIn.status).toBe(200);
    const existingCookie = signedIn.headers.get("set-cookie")?.split(";", 1)[0];
    if (!existingCookie) throw new Error("Expected existing account session");
    const explicitRedeem = await redeem(existingInvite.token, existingCookie);
    expect(explicitRedeem.status).toBe(200);
    expect(explicitRedeem.headers.get("set-cookie")).toBeNull();
    const [membershipCount] = await connection.db
      .select({ value: count() })
      .from(workspaceMembership)
      .where(eq(workspaceMembership.userId, existingUser.id));
    expect(membershipCount?.value).toBe(0);
  });

  it("limits members to assigned projects and keeps owner-only APIs protected", async () => {
    const allowedProject = await createProjectFixture("Allowed", "ALLOW");
    const privateProject = await createProjectFixture("Private", "PRIV");
    const privateIssue = await createIssueFixture(privateProject.id);
    await createMemberSession([privateProject.id], "other-member");
    const memberCookie = await createMemberSession([allowedProject.id]);
    const memberRequest = (path: string, init?: RequestInit) =>
      requestWithCookie(memberCookie, path, init);

    const session = await memberRequest("/api/v1/session");
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      workspace: { role: "member" },
    });

    const projects = await memberRequest("/api/v1/projects");
    expect(projects.status).toBe(200);
    expect(
      (await body<{ projects: Array<{ id: string }> }>(projects)).projects.map(
        (item) => item.id,
      ),
    ).toEqual([allowedProject.id]);
    expect(
      (await memberRequest(`/api/v1/projects/${allowedProject.id}`)).status,
    ).toBe(200);

    const memberIssue = await memberRequest(
      `/api/v1/projects/${allowedProject.id}/issues`,
      {
        method: "POST",
        body: JSON.stringify({ title: "Member can work here" }),
      },
    );
    expect(memberIssue.status).toBe(201);

    for (const path of [
      `/api/v1/projects/${privateProject.id}`,
      `/api/v1/projects/${privateProject.id}/board`,
      `/api/v1/issues/${privateIssue.id}`,
      `/api/v1/issues/${privateIssue.id}/activity`,
      `/api/v1/issues/${privateIssue.id}/evidence`,
    ]) {
      const response = await memberRequest(path);
      expect(response.status, path).toBe(404);
      expect(await response.json()).toMatchObject({
        error: expect.any(String),
      });
    }

    expect(
      (
        await memberRequest("/api/v1/projects", {
          method: "POST",
          body: JSON.stringify({ name: "Forbidden", key: "NOPE" }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await memberRequest("/api/v1/workspace", {
          method: "PATCH",
          body: JSON.stringify({ name: "Forbidden" }),
        })
      ).status,
    ).toBe(403);
    expect((await memberRequest("/api/v1/agents")).status).toBe(403);
    expect((await memberRequest("/api/v1/members")).status).toBe(403);
    expect(
      (
        await memberRequest("/api/v1/invitations", {
          method: "POST",
          body: JSON.stringify({
            email: "forbidden@example.test",
            projectIds: [allowedProject.id],
          }),
        })
      ).status,
    ).toBe(403);
    expect((await memberRequest("/api/v1/mcp/config")).status).toBe(403);
    expect(
      (
        await memberRequest(`/api/v1/issues/${privateIssue.id}`, {
          method: "DELETE",
          body: JSON.stringify({
            expectedVersion: privateIssue.version,
            questionVersions: [],
          }),
        })
      ).status,
    ).toBe(403);
    expect(
      (await memberRequest("/api/auth/oauth2/authorize?client_id=agent-client"))
        .status,
    ).toBe(403);
  });

  it("streams project-scoped board invalidations without ticket content", async () => {
    const p = await createProjectFixture();
    const response = await authenticatedRequest(
      `/api/v1/projects/${p.id}/board/events`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toContain("no-cache");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Expected SSE response body");
    const decoder = new TextDecoder();
    const initial = decoder.decode((await reader.read()).value);
    expect(initial).toContain("event: board");
    expect(initial).toContain("data: changed");

    const title = "Implement protected REST";
    await createIssueFixture(p.id);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const next = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("SSE invalidation timed out")),
          4_000,
        );
      }),
    ]).finally(() => clearTimeout(timeout));
    const notification = decoder.decode(next.value);
    expect(notification).toContain("event: board");
    expect(notification).toContain("data: changed");
    expect(notification).not.toContain(title);
    await reader.cancel();
  });

  it.each(["membership", "session"])(
    "closes an open stream after %s access is revoked",
    async (kind) => {
      const p = await createProjectFixture();
      const memberCookie = await createMemberSession([p.id]);
      const response = await requestWithCookie(
        memberCookie,
        `/api/v1/projects/${p.id}/board/events`,
      );
      const reader = response.body?.getReader();
      if (!reader) throw new Error("SSE body missing");
      const decoder = new TextDecoder();
      expect(decoder.decode((await reader.read()).value)).toContain(
        "event: board",
      );
      if (kind === "membership")
        await connection.db
          .delete(projectMembership)
          .where(eq(projectMembership.projectId, p.id));
      else
        await auth.api.signOut({
          headers: new Headers({ Cookie: memberCookie, Origin: baseUrl }),
        });
      await createIssueFixture(p.id);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const next = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Revoked stream did not close")),
              4000,
            );
          }),
        ]);
        const event = decoder.decode(next.value);
        expect(event).toContain("event: access-lost");
        expect(event).not.toContain("event: board");
        expect((await reader.read()).done).toBe(true);
        expect(
          (
            await requestWithCookie(
              memberCookie,
              `/api/v1/projects/${p.id}/board`,
            )
          ).status,
        ).toBe(kind === "membership" ? 404 : 401);
      } finally {
        clearTimeout(timer);
        await reader.cancel();
      }
    },
  );

  it("rejects stale answer and review decisions without recording partial activity", async () => {
    const p = await createProjectFixture();
    const memberCookie = await createMemberSession([p.id]);
    const i = await createIssueFixture(p.id, "ready_for_review");
    const created = await authenticatedRequest(
      `/api/v1/issues/${i.id}/questions`,
      {
        method: "POST",
        body: JSON.stringify({
          prompt: "Release destination?",
          recommendation: "Review the choice",
          options: [{ label: "First" }, { label: "Second" }],
          recommendedOptionIndex: 0,
          blocking: false,
        }),
      },
    );
    const q = (
      await body<{ question: { id: string; version: number } }>(created)
    ).question;
    const answer = {
      kind: "other",
      text: "Human confirmed",
      expectedVersion: q.version,
    };
    const answerPath = `/api/v1/issues/${i.id}/questions/${q.id}/answer`;
    expect(
      (
        await requestWithCookie(memberCookie, answerPath, {
          method: "PATCH",
          body: JSON.stringify(answer),
        })
      ).status,
    ).toBe(200);
    const before = await connection.db
      .select({ value: count() })
      .from(activityEvent);
    expect(
      (
        await authenticatedRequest(answerPath, {
          method: "PATCH",
          body: JSON.stringify({ ...answer, text: "Stale overwrite" }),
        })
      ).status,
    ).toBe(409);
    const detail = await body<{
      issue: { version: number };
      questions: Array<{
        id: string;
        version: number;
        answerOtherText: string;
      }>;
    }>(await authenticatedRequest(`/api/v1/issues/${i.id}`));
    expect(detail.questions[0]?.answerOtherText).toBe("Human confirmed");
    const guard = {
      expectedVersion: detail.issue.version,
      questionVersions: [{ id: q.id, version: q.version }],
    };
    expect(
      (
        await requestWithCookie(
          memberCookie,
          `/api/v1/issues/${i.id}/review/accept`,
          {
            method: "POST",
            body: JSON.stringify(guard),
          },
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await authenticatedRequest(
          `/api/v1/issues/${i.id}/review/request-changes`,
          {
            method: "POST",
            body: JSON.stringify({
              ...guard,
              expectedVersion: detail.issue.version + 1,
              reason: "Stale review",
            }),
          },
        )
      ).status,
    ).toBe(409);
    expect(
      await connection.db.select({ value: count() }).from(activityEvent),
    ).toEqual(before);
    expect(
      (
        await authenticatedRequest(`/api/v1/issues/${i.id}/review/accept`, {
          method: "POST",
          body: JSON.stringify({
            expectedVersion: detail.issue.version,
            questionVersions: detail.questions.map(({ id, version }) => ({
              id,
              version,
            })),
          }),
        })
      ).status,
    ).toBe(200);
  });

  it("only allows authenticated same-origin owner deletion and keeps repeated DELETE safe", async () => {
    const p = await createProjectFixture();
    const e = await createEpicFixture(p.id);
    const i = await createIssueFixture(p.id, "backlog", e.id);
    const path = `/api/v1/issues/${i.id}`;
    const init = {
      method: "DELETE",
      body: JSON.stringify({
        expectedVersion: i.version,
        questionVersions: [],
      }),
    };
    expect((await app.request(path, init)).status).toBe(401);
    for (const origin of [
      undefined,
      "https://hostile.example",
      "chrome-extension://abcdefghijklmnopabcdefghijklmnop",
    ]) {
      const headers = new Headers({
        Cookie: cookie,
        "Content-Type": "application/json",
      });
      if (origin) headers.set("Origin", origin);
      expect((await app.request(path, { ...init, headers })).status).toBe(403);
    }
    expect(
      (await authenticatedRequest(path, { ...init, body: "{}" })).status,
    ).toBe(400);
    expect(
      (
        await authenticatedRequest(path, {
          ...init,
          body: JSON.stringify({ expectedVersion: 999, questionVersions: [] }),
        })
      ).status,
    ).toBe(409);
    const response = await authenticatedRequest(path, init);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deleted: true,
      issueId: i.id,
      projectId: p.id,
    });
    expect((await authenticatedRequest(path, init)).status).toBe(200);
    for (const suffix of ["", "/activity", "/evidence"])
      expect((await authenticatedRequest(`${path}${suffix}`)).status).toBe(404);
    expect(
      (
        await authenticatedRequest(path, {
          method: "PATCH",
          body: JSON.stringify({ title: "Resurrect?" }),
        })
      ).status,
    ).toBe(404);
    const board = await (
      await authenticatedRequest(`/api/v1/projects/${p.id}/board`)
    ).json();
    expect(
      board.columns.flatMap((column: { issues: unknown[] }) => column.issues),
    ).toEqual([]);
    expect(board.epics[0].summary.totalIssues).toBe(0);
  });

  it("returns HTTP 409 for stale web issue and Epic plans without overwriting saved data", async () => {
    const p = await createProjectFixture();
    const i = await createIssueFixture(p.id);
    const e = await createEpicFixture(p.id);
    for (const [kind, entity] of [
      ["issues", i],
      ["epics", e],
    ] as const) {
      const path = `/api/v1/${kind}/${entity.id}`;
      const first = await authenticatedRequest(path, {
        method: "PATCH",
        body: JSON.stringify({
          description: "First editor",
          expectedVersion: 1,
        }),
      });
      expect(first.status).toBe(200);
      const stale = await authenticatedRequest(path, {
        method: "PATCH",
        body: JSON.stringify({
          description: "Stale editor",
          expectedVersion: 1,
        }),
      });
      expect(stale.status).toBe(409);
      expect(await stale.json()).toMatchObject({
        error: expect.stringContaining("draft is preserved"),
      });
      const saved = await authenticatedRequest(path);
      expect(await saved.json()).toMatchObject({
        [kind === "issues" ? "issue" : "epic"]: {
          description: "First editor",
          version: 2,
        },
      });
    }
  });

  it("archives Epics reversibly while keeping their existing tickets readable", async () => {
    const createdProject = await createProjectFixture();
    const createdEpic = await createEpicFixture(createdProject.id);
    const linkedIssue = await createIssueFixture(
      createdProject.id,
      "backlog",
      createdEpic.id,
    );

    const archivedResponse = await authenticatedRequest(
      `/api/v1/epics/${createdEpic.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ archived: true, expectedVersion: 1 }),
      },
    );
    expect(archivedResponse.status).toBe(200);
    expect(await body(archivedResponse)).toMatchObject({
      epic: {
        id: createdEpic.id,
        archivedAt: expect.any(String),
        version: 2,
      },
    });

    expect(
      await body(
        await authenticatedRequest(
          `/api/v1/projects/${createdProject.id}/epics`,
        ),
      ),
    ).toEqual({ epics: [] });
    for (const filter of ["archived", "all"]) {
      expect(
        await body(
          await authenticatedRequest(
            `/api/v1/projects/${createdProject.id}/epics?archived=${filter}`,
          ),
        ),
      ).toMatchObject({
        epics: [
          {
            id: createdEpic.id,
            archivedAt: expect.any(String),
            summary: { totalIssues: 1 },
          },
        ],
      });
    }
    expect(
      (
        await authenticatedRequest(
          `/api/v1/projects/${createdProject.id}/epics?archived=invalid`,
        )
      ).status,
    ).toBe(400);

    expect(
      await body(await authenticatedRequest(`/api/v1/epics/${createdEpic.id}`)),
    ).toMatchObject({
      epic: { id: createdEpic.id, summary: { totalIssues: 1 } },
      issues: [{ id: linkedIssue.id }],
    });
    expect(
      (
        await authenticatedRequest(
          `/api/v1/projects/${createdProject.id}/board?epicId=${createdEpic.id}`,
        )
      ).status,
    ).toBe(404);
    expect(
      await body(
        await authenticatedRequest(
          `/api/v1/projects/${createdProject.id}/board`,
        ),
      ),
    ).toMatchObject({
      epics: [{ id: createdEpic.id, archivedAt: expect.any(String) }],
      totalIssueCount: 0,
      columns: [
        { issues: [] },
        { issues: [] },
        { issues: [] },
        { issues: [] },
        { issues: [] },
      ],
    });
    expect(
      await body(
        await authenticatedRequest(
          `/api/v1/projects/${createdProject.id}/issues`,
        ),
      ),
    ).toEqual({ issues: [] });
    expect(
      await body(
        await authenticatedRequest(`/api/v1/issues/${linkedIssue.id}`),
      ),
    ).toMatchObject({
      issue: { id: linkedIssue.id, status: "backlog" },
      epic: { id: createdEpic.id, archivedAt: expect.any(String) },
    });

    const rejectedAssociation = await authenticatedRequest(
      `/api/v1/projects/${createdProject.id}/issues`,
      {
        method: "POST",
        body: JSON.stringify({
          title: "Cannot join archived Epic",
          epicId: createdEpic.id,
        }),
      },
    );
    expect(rejectedAssociation.status).toBe(409);
    expect(await body(rejectedAssociation)).toMatchObject({
      error: expect.stringContaining("Archived Epics"),
    });

    const restoredResponse = await authenticatedRequest(
      `/api/v1/epics/${createdEpic.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ archived: false, expectedVersion: 2 }),
      },
    );
    expect(restoredResponse.status).toBe(200);
    expect(await body(restoredResponse)).toMatchObject({
      epic: { archivedAt: null, version: 3 },
    });
    expect(
      (
        await authenticatedRequest(
          `/api/v1/projects/${createdProject.id}/board?epicId=${createdEpic.id}`,
        )
      ).status,
    ).toBe(200);
    expect(
      await body(
        await authenticatedRequest(
          `/api/v1/projects/${createdProject.id}/board`,
        ),
      ),
    ).toMatchObject({
      totalIssueCount: 1,
      columns: [
        { status: "backlog", issues: [{ id: linkedIssue.id }] },
        { status: "ready", issues: [] },
        { status: "in_progress", issues: [] },
        { status: "ready_for_review", issues: [] },
        { status: "done", issues: [] },
      ],
    });
  });

  it("denies anonymous reads and mutations before resolving tracker data", async () => {
    const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const requests: Array<[string, RequestInit | undefined]> = [
      ["/api/v1/projects", undefined],
      ["/api/v1/projects", { method: "POST", body: "{}" }],
      [`/api/v1/projects/${resourceId}/board`, undefined],
      [`/api/v1/projects/${resourceId}/board/events`, undefined],
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
    expect(createdProject).toMatchObject({
      showReviewColumn: true,
      showDoneColumn: true,
    });

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
      totalIssueCount: number;
      hiddenIssueCount: number;
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
    expect(boardBody).toMatchObject({
      totalIssueCount: 1,
      hiddenIssueCount: 0,
    });
    expect(
      boardBody.columns.find((column) => column.status === "ready_for_review")
        ?.issues,
    ).toHaveLength(1);
    expect(
      boardBody.columns.find((column) => column.status === "ready_for_review")
        ?.issues[0]?.questionSummary,
    ).toEqual({ total: 1, answered: 0, unansweredBlocking: 1 });

    const hiddenColumnsUpdate = await authenticatedRequest(
      `/api/v1/projects/${createdProject.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          showReviewColumn: false,
          showDoneColumn: false,
        }),
      },
    );
    expect(await body(hiddenColumnsUpdate)).toMatchObject({
      project: { showReviewColumn: false, showDoneColumn: false },
    });
    const boardWithHiddenColumns = await authenticatedRequest(
      `/api/v1/projects/${createdProject.id}/board?epicId=${createdEpic.id}`,
    );
    expect(await body(boardWithHiddenColumns)).toMatchObject({
      totalIssueCount: 1,
      hiddenIssueCount: 1,
      columns: [
        { status: "backlog", issues: [] },
        { status: "ready", issues: [] },
        { status: "in_progress", issues: [] },
      ],
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
        "Answer all blocking questions before moving this issue to Ready for Human Review",
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
