import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdtemp, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
import { auditCaptures } from "../../src/server/capture-maintenance.js";
import { CaptureStorage } from "../../src/server/capture-storage.js";
import { loadConfig } from "../../src/server/config.js";
import {
  createDatabase,
  type DatabaseConnection,
} from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import {
  activityEvent,
  agentIdentity,
  captureEvidence,
  extensionReceipt,
  issue,
  oauthClient,
  project,
} from "../../src/server/db/schema.js";
import { syntheticPng } from "../fixtures/png.js";

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
let storage: CaptureStorage;
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
  storage = new CaptureStorage(
    await mkdtemp(join(tmpdir(), "issopen-api-capture-")),
  );
  app = createApp({
    captureStorage: storage,
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
async function grant(accept = true, write = false) {
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
      scope: write
        ? "extension:read extension:write offline_access"
        : "extension:read offline_access",
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
async function connect(write = false) {
  const grant_ = await grant(true, write);
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
  it("creates project/Epic/capture atomically, attributes human Chrome and replays without duplicate after reauthorization", async () => {
    const { tokens } = await connect(true);
    const post = (path: string, body: unknown, access = tokens.access_token) =>
      app.request(`/api/extension/v1${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          Origin: origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const projectBody = {
      name: "Captured project",
      idempotencyKey: randomUUID(),
    };
    const p = await (await post("/projects", projectBody)).json();
    expect(p.project.id).toBeTruthy();
    expect(await (await post("/projects", projectBody)).json()).toEqual(p);
    const e = await (
      await post(`/projects/${p.project.id}/epics`, {
        title: "Audit",
        idempotencyKey: randomUUID(),
      })
    ).json();
    expect(e.epic.id).toBeTruthy();
    const body = {
      version: 1,
      idempotencyKey: randomUUID(),
      projectId: p.project.id,
      epicId: e.epic.id,
      title: "Reviewed black screenshot",
      description: "Synthetic capture",
      priority: "medium",
      status: "backlog",
      metadata: { mode: "viewport", url: "https://example.test/" },
      image: `data:image/png;base64,${syntheticPng(true).toString("base64")}`,
    };
    const responses = await Promise.all([
      post("/captures", body),
      post("/captures", body),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    const created = await responses[0]?.json();
    expect(await responses[1]?.json()).toEqual(created);
    const reconnected = await connect(true);
    expect(
      await (
        await post("/captures", body, reconnected.tokens.access_token)
      ).json(),
    ).toEqual(created);
    expect(
      (await post("/captures", { ...body, title: "Changed" })).status,
    ).toBe(409);
    expect(await connection.db.select().from(issue)).toHaveLength(1);
    expect(await connection.db.select().from(project)).toHaveLength(1);
    expect(await connection.db.select().from(extensionReceipt)).toHaveLength(3);
    const [activity] = await connection.db
      .select()
      .from(activityEvent)
      .where(eq(activityEvent.issueId, created.issue.id));
    expect(activity?.source).toBe("chrome_extension");
    const evidence = await (
      await app.request(`/api/v1/issues/${created.issue.id}/evidence`, {
        headers: headers(),
      })
    ).json();
    expect(evidence.evidence[0].fileKey).toBeUndefined();
    const imageUrl = evidence.evidence[0].imageUrl;
    expect((await app.request(imageUrl)).status).toBe(401);
    const image = await app.request(imageUrl, { headers: headers() });
    expect(image.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await image.arrayBuffer())).toEqual(syntheticPng());
    const bad = {
      ...body,
      idempotencyKey: randomUUID(),
      image: "data:image/png;base64,PHN2Zy8+",
    };
    expect((await post("/captures", bad)).status).toBe(400);
    expect(await connection.db.select().from(issue)).toHaveLength(1);
    expect(await connection.db.select().from(captureEvidence)).toHaveLength(1);
    // Restore the complete synthetic database into a separate PostgreSQL and
    // copy the immutable volume files: no production database is touched.
    const backup = await container.exec([
      "pg_dump",
      "-U",
      container.getUsername(),
      "-d",
      container.getDatabase(),
    ]);
    expect(backup.exitCode).toBe(0);
    const restoredContainer = await new PostgreSqlContainer(
      "postgres:18.6-alpine",
    ).start();
    const restoredConnection = createDatabase(
      restoredContainer.getConnectionUri(),
    );
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          "docker",
          [
            "exec",
            "-i",
            restoredContainer.getId(),
            "psql",
            "-U",
            restoredContainer.getUsername(),
            "-d",
            restoredContainer.getDatabase(),
            "-v",
            "ON_ERROR_STOP=1",
          ],
          { stdio: ["pipe", "ignore", "ignore"] },
        );
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(new Error("Synthetic restore failed")),
        );
        child.stdin.end(backup.output);
      });
      const restoredStorage = new CaptureStorage(
        await mkdtemp(join(tmpdir(), "issopen-api-restored-")),
      );
      const [row] = await restoredConnection.db.select().from(captureEvidence);
      if (!row?.fileKey || !row.sha256)
        throw new Error("Missing restored evidence");
      await copyFile(
        storage.path(row.fileKey),
        restoredStorage.path(row.fileKey),
      );
      expect(
        await restoredStorage.read(row.fileKey, row.sha256, row.bytes),
      ).toEqual(syntheticPng());
      expect(
        await restoredConnection.db.select().from(extensionReceipt),
      ).toHaveLength(3);
      const orphan = await restoredStorage.write(syntheticPng());
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
      await utimes(restoredStorage.path(orphan.fileKey), old, old);
      expect(
        await auditCaptures(restoredConnection.db, restoredStorage),
      ).toMatchObject({
        verified: 1,
        invalid: 0,
        agedOrphans: 1,
        quarantined: 0,
      });
      expect(
        await auditCaptures(restoredConnection.db, restoredStorage, true),
      ).toMatchObject({
        verified: 1,
        invalid: 0,
        agedOrphans: 1,
        quarantined: 1,
      });
      expect(
        await restoredStorage.read(row.fileKey, row.sha256, row.bytes),
      ).toEqual(syntheticPng());
    } finally {
      await restoredConnection.close();
      await restoredContainer.stop();
    }
    expect(
      (
        await post("/captures", {
          ...body,
          idempotencyKey: randomUUID(),
          projectId: randomUUID(),
        })
      ).status,
    ).toBe(404);
    const readOnly = await connect();
    expect(
      (await post("/captures", body, readOnly.tokens.access_token)).status,
    ).toBe(403);
  });
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
