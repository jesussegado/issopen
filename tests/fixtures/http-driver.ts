import { randomUUID } from "node:crypto";
import pino from "pino";
import { createApp } from "../../src/server/app.js";
import { createAuth, type IssopenAuth } from "../../src/server/auth.js";
import type { CaptureStorage } from "../../src/server/capture-storage.js";
import { loadConfig } from "../../src/server/config.js";
import type { Database } from "../../src/server/db/client.js";
import {
  account,
  projectMembership,
  user,
  workspaceMembership,
} from "../../src/server/db/schema.js";

export type PasswordIdentity = {
  id?: string;
  email: string;
  password: string;
  name: string;
};

export function createTestRuntime(options: {
  database: Database;
  databaseUrl: string;
  baseUrl: string;
  authSecret: string;
  captureStorage?: CaptureStorage;
}) {
  const config = loadConfig({
    NODE_ENV: "test",
    PORT: new URL(options.baseUrl).port || "8080",
    DATABASE_URL: options.databaseUrl,
    ISSOPEN_BASE_URL: options.baseUrl,
    BETTER_AUTH_SECRET: options.authSecret,
  });
  const auth = createAuth(options.database, config);
  const app = createApp({
    logger: pino({ level: "silent" }),
    db: options.database,
    auth,
    trustedOrigins: config.trustedOrigins,
    captureStorage: options.captureStorage,
  });
  return { app, auth, config };
}

export async function responseJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export function requestWithSession(
  app: ReturnType<typeof createApp>,
  origin: string,
  cookie: string,
  path: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", cookie);
  headers.set("Origin", origin);
  if (init.body !== undefined) headers.set("Content-Type", "application/json");
  return app.request(path, { ...init, headers });
}

export async function signInWithPassword(
  app: ReturnType<typeof createApp>,
  origin: string,
  identity: Pick<PasswordIdentity, "email" | "password">,
) {
  const response = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(identity),
  });
  if (response.status !== 200) {
    throw new Error(
      `Expected password sign-in to return 200, got ${response.status}`,
    );
  }
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Expected password sign-in session cookie");
  return cookie;
}

export async function createMemberFixture(options: {
  database: Database;
  auth: IssopenAuth;
  app: ReturnType<typeof createApp>;
  origin: string;
  workspaceId: string;
  identity: PasswordIdentity;
  projectGrants: Array<{
    projectId: string;
    permission?: "read" | "edit";
  }>;
}) {
  const id = options.identity.id ?? randomUUID();
  const password = await (await options.auth.$context).password.hash(
    options.identity.password,
  );
  await options.database.transaction(async (tx) => {
    await tx.insert(user).values({
      id,
      email: options.identity.email,
      name: options.identity.name,
      emailVerified: true,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      issuer: "local:credential",
      accountId: id,
      providerId: "credential",
      userId: id,
      password,
    });
    await tx.insert(workspaceMembership).values({
      workspaceId: options.workspaceId,
      userId: id,
      role: "member",
    });
    if (options.projectGrants.length > 0) {
      await tx.insert(projectMembership).values(
        options.projectGrants.map(({ projectId, permission }) => ({
          workspaceId: options.workspaceId,
          projectId,
          userId: id,
          ...(permission === undefined ? {} : { permission }),
        })),
      );
    }
  });
  return {
    ...options.identity,
    id,
    cookie: await signInWithPassword(options.app, options.origin, {
      email: options.identity.email,
      password: options.identity.password,
    }),
  };
}

export async function responseRedirect(response: Response) {
  const location = response.headers.get("location");
  if (location) return location;
  const body = (await response.json()) as {
    url?: string;
    redirect_uri?: string;
  };
  return body.url ?? body.redirect_uri ?? "";
}
