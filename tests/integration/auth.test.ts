import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { and, count, eq, ne } from "drizzle-orm";
import pino from "pino";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { bootstrapOwner, recoverOwner } from "../../scripts/owner.js";
import {
  provisionReviewDemo,
  revokeReviewDemo,
} from "../../scripts/store-reviewer.js";
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
  instanceOwner,
  membershipEvent,
  ownerWorkspaceInvitation,
  ownerWorkspaceInvitationEvent,
  project,
  session,
  user,
  workspace,
} from "../../src/server/db/schema.js";

const baseUrl = "http://localhost:8080";
const ownerInput = {
  email: "owner@example.test",
  password: "synthetic-owner-password-1",
  name: "Private Owner",
};

let container: StartedPostgreSqlContainer;
let connection: DatabaseConnection;
let auth: IssopenAuth;

function testConfig(
  databaseUrl: string,
  environment: Record<string, string> = {},
) {
  return loadConfig({
    NODE_ENV: "test",
    PORT: "8080",
    DATABASE_URL: databaseUrl,
    ISSOPEN_BASE_URL: baseUrl,
    BETTER_AUTH_SECRET: "synthetic-better-auth-secret-for-tests",
    ...environment,
  });
}

function createTestApp(environment: Record<string, string> = {}) {
  const config = testConfig(container.getConnectionUri(), environment);
  auth = createAuth(connection.db, config);
  return createApp({
    logger: pino({ level: "silent" }),
    db: connection.db,
    auth,
    trustedOrigins: config.trustedOrigins,
    googleAuthEnabled: Boolean(config.googleOAuth),
  });
}

async function signIn(
  app: ReturnType<typeof createTestApp>,
  password = ownerInput.password,
) {
  const response = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({ email: ownerInput.email, password }),
  });
  const setCookie = response.headers.get("set-cookie");
  return {
    response,
    cookie: setCookie?.split(";", 1)[0] ?? "",
    setCookie: setCookie ?? "",
  };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  await migrateDatabase(container.getConnectionUri());
  connection = createDatabase(container.getConnectionUri());
}, 120_000);

beforeEach(async () => {
  await connection.client.unsafe(
    'TRUNCATE TABLE "verification", "session", "account", "workspace", "instance_owner", "user" CASCADE',
  );
});

afterAll(async () => {
  await connection?.close();
  await container?.stop();
});

afterEach(() => vi.restoreAllMocks());

describe("private owner authentication", () => {
  it("does not cache invitation HTML or auth responses and suppresses token-bearing referrers", async () => {
    const app = createTestApp();
    for (const path of [
      "/invite/synthetic-private-token",
      "/owner-invite/synthetic-private-token",
      "/invitations/synthetic-id/link",
      "/owner-invitations/synthetic-id/link",
      "/sign-in?returnTo=%2Finvite%2Fsynthetic-private-token",
      "/api/auth/get-session",
      "/api/public/invitations/synthetic-private-token",
      "/api/public/owner-invitations/synthetic-private-token",
    ]) {
      const response = await app.request(path);
      expect(response.headers.get("cache-control"), path).toBe("no-store");
      expect(response.headers.get("referrer-policy"), path).toBe("no-referrer");
    }
  });

  it("lists only own active web sessions with safe metadata and revokes one immediately", async () => {
    const app = createTestApp();
    await bootstrapOwner(connection.db, auth, ownerInput);
    const first = await signIn(app);
    const second = await signIn(app);
    const current = await auth.api.getSession({
      headers: new Headers({ Cookie: first.cookie }),
    });
    if (!current) throw new Error("Fixture session missing");
    await connection.db.insert(user).values({
      id: "foreign-session-user",
      name: "Foreign",
      email: "foreign-session@example.test",
    });
    await connection.db.insert(session).values([
      {
        id: "foreign-session-id",
        userId: "foreign-session-user",
        token: "synthetic-foreign-bearer",
        expiresAt: new Date(Date.now() + 600_000),
      },
      {
        id: "expired-session-id",
        userId: current.user.id,
        token: "synthetic-expired-bearer",
        expiresAt: new Date(Date.now() - 600_000),
      },
    ]);
    await connection.db
      .update(session)
      .set({
        userAgent: "private-value <script> Chrome/152 Linux",
        ipAddress: "192.0.2.123",
      })
      .where(eq(session.userId, current.user.id));
    const request = (
      path: string,
      method = "GET",
      origin: string | null = baseUrl,
    ) =>
      app.request(path, {
        method,
        headers: {
          Cookie: first.cookie,
          ...(origin ? { Origin: origin } : {}),
        },
      });
    expect((await app.request("/api/v1/account/sessions")).status).toBe(401);
    const response = await request("/api/v1/account/sessions");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as {
      sessions: Array<{ id: string; current: boolean; device: string }>;
      hasMore: boolean;
    };
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions[0]?.current).toBe(true);
    expect(body.sessions[0]?.id).toBe(current.session.id);
    expect(body.sessions[0]?.device).toBe("Chrome · Linux");
    const encoded = JSON.stringify(body);
    for (const secret of [
      "token",
      "ipAddress",
      "userAgent",
      "192.0.2.123",
      "private-value",
      "foreign-session-id",
      "expired-session-id",
      current.session.token,
    ])
      expect(encoded).not.toContain(secret);
    const other = body.sessions.find((entry) => !entry.current);
    if (!other) throw new Error("Fixture second session missing");
    const revokePath = `/api/v1/account/sessions/${other.id}/revoke`;
    expect((await request(revokePath, "POST", null)).status).toBe(403);
    expect(
      (await request(revokePath, "POST", "https://foreign.example.test"))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          "/api/v1/account/sessions/foreign-session-id/revoke",
          "POST",
        )
      ).status,
    ).toBe(404);
    expect((await request(revokePath, "POST")).status).toBe(200);
    expect(
      (
        await app.request("/api/v1/session", {
          headers: { Cookie: second.cookie },
        })
      ).status,
    ).toBe(401);
    expect((await request("/api/v1/session")).status).toBe(200);
    expect((await request(revokePath, "POST")).status).toBe(404);
    expect(
      await connection.db
        .select()
        .from(session)
        .where(eq(session.id, "foreign-session-id")),
    ).toHaveLength(1);
  });

  it("closes other web sessions without changing credentials, then signs out the current browser", async () => {
    const app = createTestApp();
    await bootstrapOwner(connection.db, auth, ownerInput);
    const first = await signIn(app);
    const second = await signIn(app);
    const current = await auth.api.getSession({
      headers: new Headers({ Cookie: first.cookie }),
    });
    if (!current) throw new Error("Fixture session missing");
    const accounts = await connection.db.select().from(account);
    const response = await app.request(
      "/api/v1/account/sessions/revoke-others",
      { method: "POST", headers: { Cookie: first.cookie, Origin: baseUrl } },
    );
    expect(response.status).toBe(200);
    expect(
      await connection.db
        .select()
        .from(session)
        .where(
          and(
            eq(session.userId, current.user.id),
            ne(session.id, current.session.id),
          ),
        ),
    ).toHaveLength(0);
    expect(
      (
        await app.request("/api/v1/session", {
          headers: { Cookie: second.cookie },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request("/api/v1/session", {
          headers: { Cookie: first.cookie },
        })
      ).status,
    ).toBe(200);
    expect(await connection.db.select().from(account)).toEqual(accounts);
    const signOut = await app.request(
      `/api/v1/account/sessions/${current.session.id}/revoke`,
      { method: "POST", headers: { Cookie: first.cookie, Origin: baseUrl } },
    );
    expect(signOut.status).toBe(200);
    expect(await signOut.json()).toEqual({ revoked: true, current: true });
    expect(signOut.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(
      (
        await app.request("/api/v1/session", {
          headers: { Cookie: first.cookie },
        })
      ).status,
    ).toBe(401);
  });

  it("provisions an isolated review Member without opening signup and revokes its credential", async () => {
    const app = createTestApp();
    await bootstrapOwner(connection.db, auth, ownerInput);
    const signedIn = await signIn(app);
    await app.request("/api/v1/workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
        Cookie: signedIn.cookie,
      },
      body: JSON.stringify({ name: "Private workspace" }),
    });
    const [ws] = await connection.db.select().from(workspace);
    if (!ws) throw new Error("Fixture workspace missing");
    const privateResponse = await app.request("/api/v1/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
        Cookie: signedIn.cookie,
      },
      body: JSON.stringify({ name: "Private", key: "PRIVATE" }),
    });
    const privateData = (await privateResponse.json()) as {
      project: { id: string };
    };
    const input = {
      workspaceId: ws.id,
      ownerUserId: ws.ownerId,
      userId: "07f153c0-5796-4515-ac3a-d8a9900b0f2d",
      email: "review@example.test",
      password: "synthetic-review-password-not-real",
    };
    const result = await provisionReviewDemo(connection.db, auth, input);
    expect(result.created).toBe(true);
    expect(await provisionReviewDemo(connection.db, auth, input)).toEqual({
      ...result,
      created: false,
    });
    const [credential] = await connection.db
      .select()
      .from(account)
      .where(eq(account.userId, input.userId));
    expect(credential?.password).not.toBe(input.password);
    expect(credential?.providerId).toBe("credential");
    const [reviewUser] = await connection.db
      .select()
      .from(user)
      .where(eq(user.id, input.userId));
    expect(reviewUser?.emailVerified).toBe(false);
    const events = await connection.db
      .select()
      .from(membershipEvent)
      .where(eq(membershipEvent.subjectUserId, input.userId));
    expect(events).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain(input.password);
    const login = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ email: input.email, password: input.password }),
    });
    expect(login.status).toBe(200);
    const reviewCookie =
      login.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    const request = (path: string, init?: RequestInit) =>
      app.request(path, {
        ...init,
        headers: {
          Cookie: reviewCookie,
          Origin: baseUrl,
          "Content-Type": "application/json",
        },
      });
    const list = (await (await request("/api/v1/projects")).json()) as {
      projects: Array<{ id: string }>;
    };
    expect(list.projects.map((p) => p.id)).toEqual([result.projectId]);
    expect(
      (await request(`/api/v1/projects/${privateData.project.id}`)).status,
    ).toBe(404);
    expect((await request("/api/v1/members")).status).toBe(403);
    expect((await request("/api/v1/agents")).status).toBe(403);
    expect(
      (
        await request("/api/v1/projects", {
          method: "POST",
          body: JSON.stringify({ name: "Denied", key: "DENIED" }),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(`/api/v1/projects/${result.projectId}/issues`, {
          method: "POST",
          body: JSON.stringify({ title: "Reviewer can create tickets" }),
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request("/api/auth/sign-up/email", {
          method: "POST",
          body: JSON.stringify({
            email: "stranger@example.test",
            password: input.password,
            name: "Stranger",
          }),
        })
      ).status,
    ).not.toBe(200);
    await revokeReviewDemo(connection.db, input);
    expect((await request("/api/v1/projects")).status).toBe(401);
    expect(
      (
        await app.request("/api/auth/sign-in/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: baseUrl },
          body: JSON.stringify({
            email: input.email,
            password: input.password,
          }),
        })
      ).status,
    ).toBe(401);
    await expect(
      provisionReviewDemo(connection.db, auth, input),
    ).rejects.toThrow("cannot be adopted");
    await expect(revokeReviewDemo(connection.db, input)).resolves.toMatchObject(
      { revoked: true },
    );
  });

  it("refuses review collisions and wrong ownership without partial records", async () => {
    const app = createTestApp();
    await bootstrapOwner(connection.db, auth, ownerInput);
    const signedIn = await signIn(app);
    await app.request("/api/v1/workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
        Cookie: signedIn.cookie,
      },
      body: JSON.stringify({ name: "Private workspace" }),
    });
    const [ws] = await connection.db.select().from(workspace);
    if (!ws) throw new Error("Fixture workspace missing");
    const input = {
      workspaceId: ws.id,
      ownerUserId: ws.ownerId,
      userId: "07f153c0-5796-4515-ac3a-d8a9900b0f2d",
      email: "review@example.test",
      password: "synthetic-review-password-not-real",
    };
    await expect(
      provisionReviewDemo(connection.db, auth, {
        ...input,
        ownerUserId: input.userId,
      }),
    ).rejects.toThrow("exact workspace owner");
    await expect(
      provisionReviewDemo(connection.db, auth, {
        ...input,
        email: ownerInput.email,
      }),
    ).rejects.toThrow("cannot be adopted");
    await connection.db.insert(project).values({
      id: "99c56d71-58c3-4979-a1a7-c601e3b790b7",
      workspaceId: ws.id,
      name: "Reserved",
      key: "CWSREVIEW",
    });
    await expect(
      provisionReviewDemo(connection.db, auth, input),
    ).rejects.toThrow();
    expect(
      await connection.db.select().from(user).where(eq(user.id, input.userId)),
    ).toHaveLength(0);
    expect(
      await connection.db
        .select()
        .from(account)
        .where(eq(account.userId, input.userId)),
    ).toHaveLength(0);
  });

  it("advertises only configured Google OAuth and starts a bounded OIDC flow", async () => {
    // Deterministic discovery contract, not a real Google login acceptance test.
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (
        String(input) !==
        "https://accounts.google.com/.well-known/openid-configuration"
      )
        throw new Error("Unexpected external request in isolated OAuth test");
      return Response.json({
        issuer: "https://accounts.google.com",
        authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        token_endpoint: "https://oauth2.googleapis.com/token",
        userinfo_endpoint: "https://openidconnect.googleapis.com/v1/userinfo",
        jwks_uri: "https://www.googleapis.com/oauth2/v3/certs",
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
      });
    });
    const clientId = "synthetic-google-client-id.apps.googleusercontent.com";
    const clientSecret = "synthetic-google-client-secret";
    const app = createTestApp({
      GOOGLE_CLIENT_ID: clientId,
      GOOGLE_CLIENT_SECRET: clientSecret,
    });

    const providers = await app.request("/api/public/auth-providers");
    expect(providers.status).toBe(200);
    expect(await providers.json()).toEqual({ google: true });

    const started = await app.request("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({
        provider: "google",
        callbackURL: "/",
        errorCallbackURL: "/sign-in",
      }),
    });
    expect(started.status).toBe(200);
    const raw = await started.text();
    expect(raw).not.toContain(clientSecret);
    const payload = JSON.parse(raw) as { url: string };
    const authorization = new URL(payload.url);
    expect(authorization.origin).toBe("https://accounts.google.com");
    expect(authorization.searchParams.get("client_id")).toBe(clientId);
    expect(authorization.searchParams.get("redirect_uri")).toBe(
      `${baseUrl}/api/auth/callback/google`,
    );
    expect(authorization.searchParams.get("response_type")).toBe("code");
    expect(authorization.searchParams.get("state")).toBeTruthy();
    expect(authorization.searchParams.get("nonce")).toBeTruthy();
    expect(authorization.searchParams.get("scope")?.split(" ")).toEqual(
      expect.arrayContaining(["openid", "email", "profile"]),
    );
  });

  it("does not advertise Google when server credentials are absent", async () => {
    const app = createTestApp();
    const response = await app.request("/api/public/auth-providers");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ google: false });
  });

  it("rejects a forged Google callback without issuing a session", async () => {
    const app = createTestApp({
      GOOGLE_CLIENT_ID: "synthetic-google-client-id.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "synthetic-google-client-secret",
    });
    const response = await app.request(
      "/api/auth/callback/google?code=forged&state=forged",
    );
    expect(response.status).not.toBe(200);
    expect(response.headers.get("set-cookie") ?? "").not.toContain(
      "issopen.session_token",
    );
  });

  it("allows exactly one concurrent owner bootstrap and refuses another owner", async () => {
    createTestApp();
    const attempts = await Promise.all([
      bootstrapOwner(connection.db, auth, ownerInput),
      bootstrapOwner(connection.db, auth, ownerInput),
    ]);

    expect(attempts.map((attempt) => attempt.created).sort()).toEqual([
      false,
      true,
    ]);
    const [ownerCount] = await connection.db
      .select({ value: count() })
      .from(instanceOwner);
    const [userCount] = await connection.db
      .select({ value: count() })
      .from(user);
    expect(ownerCount?.value).toBe(1);
    expect(userCount?.value).toBe(1);

    await expect(
      bootstrapOwner(connection.db, auth, {
        ...ownerInput,
        email: "second-owner@example.test",
      }),
    ).rejects.toThrow("already has an owner");
  });

  it("keeps public status data-free and protects signup and workspace APIs", async () => {
    const app = createTestApp();
    await bootstrapOwner(connection.db, auth, ownerInput);

    const health = await app.request("/health/ready");
    expect(health.status).toBe(200);
    const healthOutput = await health.clone().text();
    expect(await health.json()).toEqual({ status: "ok" });

    const anonymous = await app.request("/api/v1/session");
    expect(anonymous.status).toBe(401);

    const publicSignup = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify(ownerInput),
    });
    expect(publicSignup.status).toBe(404);

    const publicOutput = `${healthOutput}${await anonymous.text()}${await publicSignup.text()}`;
    expect(publicOutput).not.toContain(ownerInput.email);
    expect(publicOutput).not.toContain(container.getHost());
    expect(publicOutput).not.toContain(ownerInput.password);
  });

  it("creates and renames one workspace and recovery revokes old sessions", async () => {
    const app = createTestApp();
    await bootstrapOwner(connection.db, auth, ownerInput);

    const signedIn = await signIn(app);
    expect(signedIn.response.status).toBe(200);
    expect(signedIn.cookie).toContain("issopen.session_token=");
    expect(signedIn.setCookie).toContain("HttpOnly");
    expect(signedIn.setCookie).toContain("SameSite=Lax");

    const createWorkspace = await app.request("/api/v1/workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: signedIn.cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ name: "My workspace" }),
    });
    expect(createWorkspace.status).toBe(201);

    const duplicateWorkspace = await app.request("/api/v1/workspace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: signedIn.cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ name: "Another workspace" }),
    });
    expect(duplicateWorkspace.status).toBe(409);

    const renamed = await app.request("/api/v1/workspace", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: signedIn.cookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ name: "Renamed workspace" }),
    });
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({
      workspace: { name: "Renamed workspace", version: 2 },
    });

    const untrustedMutation = await app.request("/api/v1/workspace", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: signedIn.cookie,
        Origin: "https://attacker.example.test",
      },
      body: JSON.stringify({ name: "Stolen workspace" }),
    });
    expect(untrustedMutation.status).toBe(403);

    await recoverOwner(connection.db, auth, {
      ...ownerInput,
      password: "synthetic-owner-password-2",
    });
    const [ownerUser] = await connection.db
      .select({ id: user.id })
      .from(user)
      .limit(1);
    if (!ownerUser) {
      throw new Error("Synthetic owner fixture is missing");
    }
    const [activeSessionCount] = await connection.db
      .select({ value: count() })
      .from(session)
      .where(eq(session.userId, ownerUser.id));
    expect(activeSessionCount?.value).toBe(0);

    const oldSession = await app.request("/api/v1/session", {
      headers: { Cookie: signedIn.cookie },
    });
    expect(oldSession.status).toBe(401);

    const oldPassword = await signIn(app);
    expect(oldPassword.response.status).toBe(401);
    const newPassword = await signIn(app, "synthetic-owner-password-2");
    expect(newPassword.response.status).toBe(200);
  });

  it("lets only the instance owner provision an isolated Owner workspace", async () => {
    const app = createTestApp();
    await bootstrapOwner(connection.db, auth, ownerInput);
    const signedIn = await signIn(app);
    const mutationHeaders = {
      "Content-Type": "application/json",
      Cookie: signedIn.cookie,
      Origin: baseUrl,
    };
    const firstWorkspace = await app.request("/api/v1/workspace", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({ name: "Operator workspace" }),
    });
    expect(firstWorkspace.status).toBe(201);
    const operatorSession = await app.request("/api/v1/session", {
      headers: { Cookie: signedIn.cookie },
    });
    expect(await operatorSession.json()).toMatchObject({
      platformAdmin: true,
      workspace: { name: "Operator workspace", role: "owner" },
    });

    const invitationResponse = await app.request("/api/v1/owner-invitations", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({
        email: "new-owner@example.test",
        workspaceName: "Independent workspace",
      }),
    });
    expect(invitationResponse.status).toBe(201);
    const invitationBody = (await invitationResponse.json()) as {
      invitation: { id: string };
      inviteUrl: string;
    };
    const rawToken = invitationBody.inviteUrl.split("/").at(-1);
    if (!rawToken) throw new Error("Expected Owner invitation token");
    const [storedInvitation] = await connection.db
      .select()
      .from(ownerWorkspaceInvitation)
      .where(eq(ownerWorkspaceInvitation.id, invitationBody.invitation.id));
    expect(storedInvitation?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(storedInvitation?.tokenHash).not.toBe(rawToken);
    expect(
      await connection.db
        .select()
        .from(ownerWorkspaceInvitationEvent)
        .where(
          eq(
            ownerWorkspaceInvitationEvent.invitationId,
            invitationBody.invitation.id,
          ),
        ),
    ).toHaveLength(1);

    const publicInvitation = await app.request(
      `/api/public/owner-invitations/${rawToken}`,
    );
    expect(publicInvitation.status).toBe(200);
    expect(await publicInvitation.json()).toMatchObject({
      invitation: {
        workspaceName: "Independent workspace",
        email: "ne*******@example.test",
        state: "pending",
      },
    });

    const redeemed = await app.request("/api/auth/owner-invitations/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ token: rawToken }),
    });
    expect(redeemed.status).toBe(200);
    const provisionalCookie =
      redeemed.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
    expect(provisionalCookie).toContain("issopen.session_token=");
    const [claimed] = await connection.db
      .select()
      .from(ownerWorkspaceInvitation)
      .where(eq(ownerWorkspaceInvitation.id, invitationBody.invitation.id));
    if (!claimed?.claimedByUserId || !claimed.claimedAt)
      throw new Error("Expected claimed Owner invitation");
    await connection.db.insert(account).values({
      id: "synthetic-owner-google-account",
      issuer: "https://accounts.google.com",
      accountId: "synthetic-owner-google-subject",
      providerId: "google",
      userId: claimed.claimedByUserId,
      createdAt: new Date(claimed.claimedAt.getTime() + 1_000),
      updatedAt: new Date(claimed.claimedAt.getTime() + 1_000),
    });

    const accepted = await app.request("/api/auth/owner-invitations/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: provisionalCookie,
        Origin: baseUrl,
      },
      body: JSON.stringify({ invitationId: invitationBody.invitation.id }),
    });
    expect(accepted.status).toBe(200);
    const ownerSetCookie = accepted.headers.get("set-cookie") ?? "";
    const ownerTokens = [
      ...ownerSetCookie.matchAll(/issopen\.session_token=([^;,]+)/g),
    ];
    const ownerCookie = `issopen.session_token=${ownerTokens.at(-1)?.[1] ?? ""}`;
    expect(ownerCookie).toContain("issopen.session_token=");
    const acceptedBody = (await accepted.json()) as {
      workspace: { workspaceId: string };
    };
    const newOwnerSession = await app.request("/api/v1/session", {
      headers: { Cookie: ownerCookie },
    });
    expect(await newOwnerSession.json()).toMatchObject({
      platformAdmin: false,
      workspace: {
        id: acceptedBody.workspace.workspaceId,
        name: "Independent workspace",
        role: "owner",
      },
    });

    const ownerHeaders = {
      "Content-Type": "application/json",
      Cookie: ownerCookie,
      Origin: baseUrl,
    };
    const forbiddenOwnerProvisioning = await app.request(
      "/api/v1/owner-invitations",
      {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({
          email: "third-owner@example.test",
          workspaceName: "Forbidden workspace",
        }),
      },
    );
    expect(forbiddenOwnerProvisioning.status).toBe(403);

    const createdProject = await app.request("/api/v1/projects", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ name: "Private project", key: "PRIVATE" }),
    });
    expect(createdProject.status).toBe(201);
    const projectBody = (await createdProject.json()) as {
      project: { id: string };
    };
    const memberInvitation = await app.request("/api/v1/invitations", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        email: "member@example.test",
        projectIds: [projectBody.project.id],
        delivery: "manual",
      }),
    });
    expect(memberInvitation.status).toBe(201);
    expect(
      await connection.db
        .select()
        .from(workspace)
        .where(eq(workspace.id, acceptedBody.workspace.workspaceId)),
    ).toHaveLength(1);
  });
});
