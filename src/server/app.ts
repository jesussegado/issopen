import { randomUUID } from "node:crypto";
import { serveStatic } from "@hono/node-server/serve-static";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Logger } from "pino";
import { z } from "zod";
import type { IssopenAuth, OwnerSession } from "./auth.js";
import type { Database } from "./db/client.js";
import { workspace } from "./db/schema.js";
import { DomainError } from "./domain/index.js";
import {
  createAgentRouter,
  createTrackerRouter,
  domainErrorResponse,
} from "./http/index.js";
import { createIssopenMcpHandler } from "./mcp/index.js";

type AppBindings = {
  Variables: {
    ownerSession: OwnerSession;
  };
};

type AppDependencies = {
  logger: Logger;
  db: Database;
  auth: IssopenAuth;
  trustedOrigins: string[];
  webRoot?: string;
};

const workspaceInputSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(120),
});

function validationError(issues: z.core.$ZodIssue[]) {
  return {
    error: "Invalid request",
    fields: issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if ("code" in error && error.code === "23505") {
    return true;
  }
  return "cause" in error && isUniqueViolation(error.cause);
}

export function createApp({
  logger,
  db,
  auth,
  trustedOrigins,
  webRoot = "./dist/web",
}: AppDependencies) {
  const app = new Hono<AppBindings>();
  const oauthApi = auth.api as typeof auth.api & {
    getOAuthServerConfig(input: {
      request: Request;
      asResponse: true;
    }): Promise<Response>;
  };
  const resource = new URL("/mcp", String(auth.options.baseURL)).toString();
  const mcpHandler = createIssopenMcpHandler({ auth, db, resource });

  app.get("/health/live", (context) => context.json({ status: "ok" }));
  app.get("/health/ready", async (context) => {
    try {
      await db.execute(sql`select 1`);
      return context.json({ status: "ok" });
    } catch {
      return context.json({ status: "starting" }, 503);
    }
  });

  app.on(["GET", "POST"], "/api/auth/sign-up/*", (context) =>
    context.json({ error: "Not found" }, 404),
  );
  app.on(["GET", "POST"], "/api/auth/*", (context) =>
    auth.handler(context.req.raw),
  );
  app.get("/.well-known/oauth-authorization-server", (context) =>
    oauthApi.getOAuthServerConfig({
      request: context.req.raw,
      asResponse: true,
    }),
  );
  app.get("/.well-known/*", (context) => auth.handler(context.req.raw));
  app.post("/mcp", (context) => mcpHandler(context.req.raw));
  app.on(["GET", "DELETE"], "/mcp", (context) => {
    context.header("Allow", "POST");
    return context.json({ error: "Method not allowed" }, 405);
  });

  app.use("/api/v1/*", async (context, next) => {
    const ownerSession = await auth.api
      .getSession({ headers: context.req.raw.headers })
      .catch(() => null);
    if (!ownerSession) {
      return context.json({ error: "Authentication required" }, 401);
    }

    if (!["GET", "HEAD", "OPTIONS"].includes(context.req.method)) {
      const origin = context.req.header("Origin");
      if (!origin || !trustedOrigins.includes(origin)) {
        return context.json({ error: "Origin is not trusted" }, 403);
      }
    }

    context.set("ownerSession", ownerSession);
    await next();
  });

  app.get("/api/v1/session", async (context) => {
    const ownerSession = context.get("ownerSession");
    const [personalWorkspace] = await db
      .select({
        id: workspace.id,
        name: workspace.name,
        version: workspace.version,
      })
      .from(workspace)
      .where(eq(workspace.ownerId, ownerSession.user.id))
      .limit(1);

    return context.json({
      user: {
        id: ownerSession.user.id,
        name: ownerSession.user.name,
        email: ownerSession.user.email,
      },
      workspace: personalWorkspace ?? null,
    });
  });

  app.get("/api/v1/mcp/config", (context) =>
    context.json({ resource, connected: false }),
  );

  app.post("/api/v1/workspace", async (context) => {
    const input = await context.req.json().catch(() => null);
    const parsed = workspaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return context.json(validationError(parsed.error.issues), 400);
    }

    const ownerSession = context.get("ownerSession");
    try {
      const [createdWorkspace] = await db
        .insert(workspace)
        .values({
          id: randomUUID(),
          ownerId: ownerSession.user.id,
          name: parsed.data.name,
        })
        .returning({
          id: workspace.id,
          name: workspace.name,
          version: workspace.version,
        });

      return context.json({ workspace: createdWorkspace }, 201);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return context.json(
          { error: "A personal workspace already exists" },
          409,
        );
      }
      throw error;
    }
  });

  app.patch("/api/v1/workspace", async (context) => {
    const input = await context.req.json().catch(() => null);
    const parsed = workspaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return context.json(validationError(parsed.error.issues), 400);
    }

    const ownerSession = context.get("ownerSession");
    const [updatedWorkspace] = await db
      .update(workspace)
      .set({
        name: parsed.data.name,
        version: sql`${workspace.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(workspace.ownerId, ownerSession.user.id))
      .returning({
        id: workspace.id,
        name: workspace.name,
        version: workspace.version,
      });

    if (!updatedWorkspace) {
      return context.json({ error: "Workspace not found" }, 404);
    }
    return context.json({ workspace: updatedWorkspace });
  });

  app.route("/api/v1", createTrackerRouter({ db }));
  app.route("/api/v1", createAgentRouter({ db }));

  app.all("/api/v1/*", (context) =>
    context.json({ error: "This page isn't available" }, 404),
  );

  app.use("/assets/*", serveStatic({ root: webRoot }));
  app.get(
    "/favicon.ico",
    serveStatic({
      root: webRoot,
      path: "assets/branding/issopen-favicon-v2-white.png",
    }),
  );
  app.get("*", serveStatic({ root: webRoot, path: "index.html" }));

  app.notFound((context) => context.json({ error: "Not found" }, 404));
  app.onError((error, context) => {
    if (error instanceof DomainError) {
      return domainErrorResponse(context, error);
    }
    logger.error(
      { error: { name: error.name, message: error.message } },
      "request failed",
    );
    return context.json({ error: "Internal server error" }, 500);
  });

  return app;
}
