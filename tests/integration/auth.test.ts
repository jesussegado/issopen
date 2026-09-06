import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { count, eq } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { bootstrapOwner, recoverOwner } from "../../scripts/owner.js";
import { createApp } from "../../src/server/app.js";
import { createAuth, type IssopenAuth } from "../../src/server/auth.js";
import { loadConfig } from "../../src/server/config.js";
import {
  createDatabase,
  type DatabaseConnection,
} from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import { instanceOwner, session, user } from "../../src/server/db/schema.js";

const baseUrl = "http://localhost:8080";
const ownerInput = {
  email: "owner@example.test",
  password: "synthetic-owner-password-1",
  name: "Private Owner",
};

let container: StartedPostgreSqlContainer;
let connection: DatabaseConnection;
let auth: IssopenAuth;

function testConfig(databaseUrl: string) {
  return loadConfig({
    NODE_ENV: "test",
    PORT: "8080",
    DATABASE_URL: databaseUrl,
    ISSOPEN_BASE_URL: baseUrl,
    BETTER_AUTH_SECRET: "synthetic-better-auth-secret-for-tests",
  });
}

function createTestApp() {
  const config = testConfig(container.getConnectionUri());
  auth = createAuth(connection.db, config);
  return createApp({
    logger: pino({ level: "silent" }),
    db: connection.db,
    auth,
    trustedOrigins: config.trustedOrigins,
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

describe("private owner authentication", () => {
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
});
