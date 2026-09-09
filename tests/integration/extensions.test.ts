import { createHash, randomUUID } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
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
import { agentIdentity, oauthClient } from "../../src/server/db/schema.js";

const base = "http://localhost:8080";
const extensionId = "abcdefghijklmnopabcdefghijklmnop";
const origin = `chrome-extension://${extensionId}`;
const verifier = "synthetic-extension-pkce-verifier-0123456789abcdefghijk";
const challenge = createHash("sha256").update(verifier).digest("base64url");
const state = "synthetic-extension-state-0123456789abcdefghijk";
const owner = {
  name: "Extension Owner",
  email: "extension@example.test",
  password: "synthetic-extension-owner-password",
};
let container: StartedPostgreSqlContainer;
let connection: DatabaseConnection;
let auth: IssopenAuth;
let app: ReturnType<typeof createApp>;
let cookie: string;
const headers = () => ({
  Cookie: cookie,
  Origin: base,
  "Content-Type": "application/json",
});
const resource = `${base}/api/extension/v1`;
const redirect = `https://${extensionId}.chromiumapp.org/oauth`;
type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  await migrateDatabase(container.getConnectionUri());
  connection = createDatabase(container.getConnectionUri());
}, 120000);
beforeEach(async () => {
  await connection.client.unsafe(
    'TRUNCATE "oauth_client_resource", "oauth_consent", "oauth_access_token", "oauth_refresh_token", "oauth_client", "oauth_resource", "jwks", "verification", "session", "account", "workspace", "instance_owner", "user" CASCADE',
  );
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: container.getConnectionUri(),
    ISSOPEN_BASE_URL: base,
    BETTER_AUTH_SECRET: "synthetic-extension-auth-secret-tests",
  });
  auth = createAuth(connection.db, config);
  app = createApp({
    db: connection.db,
    auth,
    logger: pino({ level: "silent" }),
    trustedOrigins: config.trustedOrigins,
  });
  await bootstrapOwner(connection.db, auth, owner);
  const response = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify(owner),
  });
  expect(response.status).toBe(200);
  cookie = response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  expect(
    (
      await app.request("/api/v1/workspace", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ name: "Extension workspace" }),
      })
    ).status,
  ).toBe(201);
});
afterAll(async () => {
  await connection?.close();
  await container?.stop();
});
async function link() {
  const installationId = randomUUID();
  const response = await app.request("/api/v1/extensions/link", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      installationId,
      extensionId,
      name: "Test Chrome",
      challenge,
      state,
    }),
  });
  expect(response.status).toBe(200);
  return {
    clientId: `issopen-chrome-${installationId}`,
    authorizeUrl: ((await response.json()) as { authorizeUrl: string })
      .authorizeUrl,
  };
}
async function grant(accept = true) {
  const linked = await link();
  const authorization = await app.request(linked.authorizeUrl, {
    headers: { Cookie: cookie },
  });
  expect(authorization.status).toBe(302);
  const consentUrl = new URL(authorization.headers.get("location") ?? "", base);
  expect(consentUrl.pathname).toBe("/consent");
  const response = await app.request("/api/auth/oauth2/consent", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      accept,
      scope: "extension:read offline_access",
      oauth_query: consentUrl.search.slice(1),
    }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    url?: string;
    redirect_uri?: string;
  };
  const callback = new URL(body.url ?? body.redirect_uri ?? "");
  expect(callback.origin + callback.pathname).toBe(redirect);
  expect(callback.searchParams.get("state")).toBe(state);
  return { ...linked, callback };
}
function token(params: Record<string, string>) {
  return app.request("/api/auth/oauth2/token", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ ...params, resource }),
  });
}
async function connect() {
  const grant_ = await grant();
  const response = await token({
    grant_type: "authorization_code",
    client_id: grant_.clientId,
    redirect_uri: redirect,
    code: grant_.callback.searchParams.get("code") ?? "",
    code_verifier: verifier,
  });
  expect(response.status).toBe(200);
  return {
    clientId: grant_.clientId,
    tokens: (await response.json()) as Tokens,
  };
}
function readSession(tokens: Tokens) {
  return app.request("/api/extension/v1/session", {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Origin: origin },
  });
}

describe("human Chrome OAuth", () => {
  it("links with PKCE, reads human projects, rotates refresh and revokes one installation independently", async () => {
    const first = await connect();
    const second = await connect();
    expect(first.tokens.expires_in).toBe(300);
    expect((await readSession(first.tokens)).status).toBe(200);
    const refreshed = await token({
      grant_type: "refresh_token",
      client_id: first.clientId,
      refresh_token: first.tokens.refresh_token,
    });
    expect(refreshed.status).toBe(200);
    const rotated = (await refreshed.json()) as Tokens;
    expect(rotated.refresh_token).not.toBe(first.tokens.refresh_token);
    expect((await readSession(rotated)).status).toBe(200);
    expect(
      (
        await app.request("/api/v1/session", {
          headers: { Authorization: `Bearer ${rotated.access_token}` },
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await app.request(`/api/v1/extensions/${first.clientId}/revoke`, {
          method: "POST",
          headers: headers(),
        })
      ).status,
    ).toBe(200);
    expect((await readSession(rotated)).status).toBe(401);
    expect(
      (
        await token({
          grant_type: "refresh_token",
          client_id: first.clientId,
          refresh_token: rotated.refresh_token,
        })
      ).status,
    ).toBe(401);
    expect((await readSession(second.tokens)).status).toBe(200);
    expect(await connection.db.select().from(agentIdentity)).toHaveLength(0);
    const list = await app.request("/api/v1/extensions", {
      headers: headers(),
    });
    expect(await list.text()).not.toContain(rotated.access_token);
  });
  it("does not accept anonymous linking, cookie CSRF, untrusted origins or a denied grant", async () => {
    expect(
      (await app.request("/api/v1/extensions/link", { method: "POST" })).status,
    ).toBe(401);
    expect(
      (
        await app.request("/api/v1/extensions/link", {
          method: "POST",
          headers: { Cookie: cookie, Origin: origin },
        })
      ).status,
    ).toBe(403);
    const denied = await grant(false);
    expect(denied.callback.searchParams.get("error")).toBe("access_denied");
    expect(denied.callback.searchParams.has("code")).toBe(false);
    const connected = await connect();
    expect(
      (
        await app.request("/api/extension/v1/session", {
          headers: {
            Authorization: `Bearer ${connected.tokens.access_token}`,
            Origin: "https://untrusted.test",
          },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request("/api/extension/v1/session", {
          headers: { Cookie: cookie },
        })
      ).status,
    ).toBe(401);
  });
  it("rejects a wrong PKCE verifier and replay of a consumed code", async () => {
    const granted = await grant();
    const params = {
      grant_type: "authorization_code",
      client_id: granted.clientId,
      redirect_uri: redirect,
      code: granted.callback.searchParams.get("code") ?? "",
      code_verifier: verifier,
    };
    expect(
      (
        await token({
          ...params,
          code_verifier: "incorrect-verifier-0123456789abcdefghijklmnopqrst",
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
    const fresh = await grant();
    const good = {
      ...params,
      client_id: fresh.clientId,
      code: fresh.callback.searchParams.get("code") ?? "",
    };
    expect((await token(good)).status).toBe(200);
    expect((await token(good)).status).toBeGreaterThanOrEqual(400);
  });
  it("enforces absolute installation expiry on access and JSON/form refresh requests", async () => {
    const connected = await connect();
    await connection.db
      .update(oauthClient)
      .set({
        metadata: {
          extensionId,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
      })
      .where(eq(oauthClient.clientId, connected.clientId));
    expect((await readSession(connected.tokens)).status).toBe(401);
    const params = {
      grant_type: "refresh_token",
      client_id: connected.clientId,
      refresh_token: connected.tokens.refresh_token,
    };
    expect((await token(params)).status).toBe(401);
    expect(
      (
        await app.request("/api/auth/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        })
      ).status,
    ).toBe(401);
  });
});
