import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createLocalJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import type { IssopenAuth, OwnerSession } from "./auth.js";
import { createCaptureRouter, type ExtensionBindings } from "./capture-api.js";
import type { CaptureStorage } from "./capture-storage.js";
import type { Database } from "./db/client.js";
import {
  oauthAccessToken,
  oauthClient,
  oauthClientResource,
  oauthRefreshToken,
  oauthResource,
  user,
  workspace,
} from "./db/schema.js";
import { DomainError, TrackerService } from "./domain/index.js";

export const extensionScopes = [
  "extension:read",
  "extension:write",
  "offline_access",
];
const lifetimeMs = 30 * 24 * 60 * 60 * 1000;
const marker = "issopen-chrome";
export const extensionLinkSchema = z
  .object({
    installationId: z.uuid(),
    extensionId: z.string().regex(/^[a-p]{32}$/),
    name: z.string().trim().min(1).max(80),
    state: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
    challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();
const metadataSchema = z.object({
  extensionId: z.string().regex(/^[a-p]{32}$/),
  expiresAt: z.iso.datetime(),
});
export function extensionResource(base: string) {
  return new URL("/api/extension/v1", base).toString();
}
export function extensionClientId(id: string) {
  return `${marker}-${id}`;
}
export function extensionRedirect(extensionId: string) {
  return `https://${extensionId}.chromiumapp.org/oauth`;
}

function activeClient(client: typeof oauthClient.$inferSelect | undefined) {
  const metadata = metadataSchema.safeParse(client?.metadata);
  return client?.referenceId === marker &&
    !client.disabled &&
    metadata.success &&
    Date.parse(metadata.data.expiresAt) > Date.now()
    ? metadata.data
    : null;
}

// Restrict only our first-party installation clients, never the existing MCP clients.
export async function extensionOAuthGuard(request: Request, db: Database) {
  const url = new URL(request.url);
  if (
    !["/api/auth/oauth2/token", "/api/auth/oauth2/authorize"].includes(
      url.pathname,
    )
  )
    return null;
  const input: unknown =
    request.method === "GET"
      ? Object.fromEntries(url.searchParams)
      : request.headers.get("Content-Type")?.includes("application/json")
        ? await request
            .clone()
            .json()
            .catch(() => null)
        : Object.fromEntries(new URLSearchParams(await request.clone().text()));
  const id = z.object({ client_id: z.string() }).safeParse(input)
    .data?.client_id;
  if (!id?.startsWith(`${marker}-`)) return null;
  const [client] = await db
    .select()
    .from(oauthClient)
    .where(eq(oauthClient.clientId, id))
    .limit(1);
  if (!activeClient(client))
    return Response.json(
      { error: "invalid_client" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  return null;
}

async function revoke(db: Database, clientId: string, ownerId: string) {
  await db.transaction(async (tx) => {
    const [client] = await tx
      .update(oauthClient)
      .set({ disabled: true, updatedAt: new Date() })
      .where(
        and(
          eq(oauthClient.clientId, clientId),
          eq(oauthClient.userId, ownerId),
          eq(oauthClient.referenceId, marker),
        ),
      )
      .returning();
    if (!client) throw new DomainError("not_found", "Installation not found");
    await tx
      .update(oauthRefreshToken)
      .set({ revoked: new Date() })
      .where(eq(oauthRefreshToken.clientId, clientId));
    await tx
      .update(oauthAccessToken)
      .set({ revoked: new Date() })
      .where(eq(oauthAccessToken.clientId, clientId));
  });
}

export function createExtensionOwnerRouter(db: Database, auth: IssopenAuth) {
  const router = new Hono<{ Variables: { ownerSession: OwnerSession } }>();
  const resource = extensionResource(String(auth.options.baseURL));
  router.get("/extensions", async (c) => {
    const rows = await db
      .select()
      .from(oauthClient)
      .where(
        and(
          eq(oauthClient.userId, c.get("ownerSession").user.id),
          eq(oauthClient.referenceId, marker),
        ),
      );
    return c.json({
      installations: rows.map((row) => ({
        id: row.clientId,
        name: row.name,
        createdAt: row.createdAt,
        expiresAt:
          metadataSchema.safeParse(row.metadata).data?.expiresAt ?? null,
        active: Boolean(activeClient(row)),
      })),
    });
  });
  router.post("/extensions/link", async (c) => {
    const parsed = extensionLinkSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success)
      return c.json({ error: "Invalid extension link" }, 400);
    const input = parsed.data;
    const ownerId = c.get("ownerSession").user.id;
    const clientId = extensionClientId(input.installationId);
    const redirect = extensionRedirect(input.extensionId);
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`extension-link:${ownerId}`}))`,
      );
      const existing = await tx
        .select()
        .from(oauthClient)
        .where(
          and(
            eq(oauthClient.userId, ownerId),
            eq(oauthClient.referenceId, marker),
          ),
        );
      if (existing.filter((row) => activeClient(row)).length >= 20)
        throw new DomainError(
          "conflict",
          "Revoke an installation before linking another (maximum 20).",
        );
      const now = new Date();
      // First-party provisioning only. Better Auth owns code, PKCE, consent and token issuance.
      await tx
        .insert(oauthResource)
        .values({
          id: randomUUID(),
          identifier: resource,
          name: "Issopen Chrome",
          allowedScopes: extensionScopes,
          accessTokenTtl: 300,
          refreshTokenTtl: lifetimeMs / 1000,
        })
        .onConflictDoUpdate({
          target: oauthResource.identifier,
          set: { allowedScopes: extensionScopes },
        });
      await tx
        .insert(oauthClient)
        .values({
          id: randomUUID(),
          clientId,
          userId: ownerId,
          referenceId: marker,
          name: `Issopen Chrome · ${input.name}`,
          redirectUris: [redirect],
          scopes: extensionScopes,
          grantTypes: ["authorization_code", "refresh_token"],
          responseTypes: ["code"],
          tokenEndpointAuthMethod: "none",
          applicationType: "native",
          requirePKCE: true,
          skipConsent: false,
          disabled: false,
          createdAt: now,
          updatedAt: now,
          metadata: {
            extensionId: input.extensionId,
            expiresAt: new Date(now.getTime() + lifetimeMs).toISOString(),
          },
        })
        .onConflictDoNothing();
      const [registered] = await tx
        .select()
        .from(oauthClient)
        .where(eq(oauthClient.clientId, clientId))
        .limit(1);
      if (
        registered?.userId !== ownerId ||
        activeClient(registered)?.extensionId !== input.extensionId
      )
        throw new DomainError("conflict", "Start a new extension connection.");
      await tx
        .insert(oauthClientResource)
        .values({
          id: randomUUID(),
          clientId,
          resourceId: resource,
          createdAt: now,
        })
        .onConflictDoNothing();
    });
    const authorize = new URL(
      "/api/auth/oauth2/authorize",
      String(auth.options.baseURL),
    );
    authorize.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: "code",
      scope: extensionScopes.join(" "),
      state: input.state,
      code_challenge: input.challenge,
      code_challenge_method: "S256",
      resource,
      prompt: "consent",
    }).toString();
    return c.json({ authorizeUrl: authorize.toString() });
  });
  router.post("/extensions/:id/revoke", async (c) => {
    await revoke(db, c.req.param("id"), c.get("ownerSession").user.id);
    return c.json({ revoked: true });
  });
  return router;
}

export function createExtensionRouter(
  db: Database,
  auth: IssopenAuth,
  storage?: CaptureStorage,
) {
  const router = new Hono<ExtensionBindings>();
  const resource = extensionResource(String(auth.options.baseURL));
  router.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    try {
      const token = c.req
        .header("Authorization")
        ?.match(/^Bearer ([^\s]+)$/)?.[1];
      if (!token) throw new Error("Unauthenticated");
      const authContext = await auth.$context;
      const { payload } = await jwtVerify(
        token,
        createLocalJWKSet(await auth.api.getJwks()),
        {
          issuer: authContext.baseURL,
          audience: resource,
          typ: "at+jwt",
          requiredClaims: ["sub", "exp", "iat"],
        },
      );
      if (
        payload.cnf ||
        typeof payload.client_id !== "string" ||
        typeof payload.sub !== "string" ||
        typeof payload.scope !== "string" ||
        !payload.scope.split(" ").includes("extension:read")
      )
        throw new Error("Invalid token");
      const [client] = await db
        .select()
        .from(oauthClient)
        .where(eq(oauthClient.clientId, payload.client_id))
        .limit(1);
      const metadata = activeClient(client);
      if (!metadata || client?.userId !== payload.sub)
        throw new Error("Installation unavailable");
      const origin = c.req.header("Origin");
      if (origin && origin !== `chrome-extension://${metadata.extensionId}`)
        return c.json({ error: "Origin is not trusted" }, 403);
      const [space] = await db
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.ownerId, payload.sub))
        .limit(1);
      if (!space) return c.json({ error: "Workspace unavailable" }, 403);
      c.set("ownerId", payload.sub);
      c.set("clientId", payload.client_id);
      c.set("expiresAt", metadata.expiresAt);
      c.set("workspaceId", space.id);
      c.set(
        "canWrite",
        payload.scope.split(" ").includes("extension:write") &&
          Boolean(client?.scopes?.includes("extension:write")),
      );
    } catch {
      c.header("WWW-Authenticate", `Bearer resource="${resource}"`);
      return c.json(
        { error: "Connection expired or revoked. Connect Issopen again." },
        401,
      );
    }
    await next();
  });
  router.get("/session", async (c) => {
    const [person] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, c.get("ownerId")))
      .limit(1);
    return c.json({
      name: person?.name ?? "Issopen",
      expiresAt: c.get("expiresAt"),
      apiVersion: 1,
      maxImages: 5,
      canWrite: c.get("canWrite"),
      ownerId: c.get("ownerId"),
      workspaceId: c.get("workspaceId"),
    });
  });
  router.get("/projects", async (c) =>
    c.json({
      projects: (
        await new TrackerService(db).listProjects(c.get("workspaceId"))
      ).map((p) => ({ id: p.id, name: p.name })),
    }),
  );
  router.post("/disconnect", async (c) => {
    await revoke(db, c.get("clientId"), c.get("ownerId"));
    return c.json({ revoked: true });
  });
  router.route(
    "/",
    createCaptureRouter(db, storage, String(auth.options.baseURL)),
  );
  return router;
}
