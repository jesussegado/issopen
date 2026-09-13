import { randomUUID } from "node:crypto";
import { serveStatic } from "@hono/node-server/serve-static";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Logger } from "pino";
import { z } from "zod";
import type { IssopenAuth, OwnerSession } from "./auth.js";
import { createEvidenceRouter } from "./capture-api.js";
import type { CaptureStorage } from "./capture-storage.js";
import type { Database } from "./db/client.js";
import {
  instanceOwner,
  membershipEvent,
  workspace,
  workspaceMembership,
} from "./db/schema.js";
import { DomainError } from "./domain/index.js";
import {
  createExtensionAccountRouter,
  createExtensionRouter,
  extensionOAuthGuard,
  isExtensionClientId,
  oauthClientIdFromRequest,
} from "./extensions.js";
import { createAccountRouter } from "./http/account.js";
import {
  createAgentRouter,
  createInvitationRouter,
  createTrackerRouter,
  domainErrorResponse,
} from "./http/index.js";
import {
  type HumanAccess,
  requireHumanAccess,
  requireWorkspaceOwner,
  resolveHumanAccess,
} from "./human-access.js";
import { InvitationService } from "./invitations.js";
import { createIssopenMcpHandler } from "./mcp/index.js";

type AppBindings = {
  Variables: {
    ownerSession: OwnerSession;
    humanAccess: HumanAccess | null;
  };
};

type AppDependencies = {
  logger: Logger;
  db: Database;
  auth: IssopenAuth;
  trustedOrigins: string[];
  webRoot?: string;
  captureStorage?: CaptureStorage | undefined;
  googleAuthEnabled?: boolean;
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
  captureStorage,
  googleAuthEnabled = false,
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

  app.get("/api/public/auth-providers", (context) =>
    context.json({ google: googleAuthEnabled }),
  );
  app.get("/api/public/invitations/:token", async (context) => {
    context.header("Cache-Control", "no-store");
    context.header("Referrer-Policy", "no-referrer");
    const invitation = await new InvitationService(db).inspect(
      context.req.param("token"),
    );
    return invitation
      ? context.json({ invitation })
      : context.json({ error: "Invitation not found" }, 404);
  });

  app.on(["GET", "POST"], "/api/auth/sign-up/*", (context) =>
    context.json({ error: "Not found" }, 404),
  );
  app.on(["GET", "POST"], "/api/auth/*", async (context) => {
    const extensionResponse = await extensionOAuthGuard(context.req.raw, db);
    if (extensionResponse) return extensionResponse;

    const pathname = new URL(context.req.url).pathname;
    if (
      ["/api/auth/oauth2/authorize", "/api/auth/oauth2/consent"].includes(
        pathname,
      )
    ) {
      const clientId = await oauthClientIdFromRequest(context.req.raw);
      if (clientId && !isExtensionClientId(clientId)) {
        const session = await auth.api
          .getSession({ headers: context.req.raw.headers })
          .catch(() => null);
        if (session) {
          const access = await resolveHumanAccess(db, session.user);
          if (access?.role !== "owner") {
            return context.json(
              { error: "Only a workspace owner can connect an MCP client" },
              403,
            );
          }
        }
      }
    }
    return auth.handler(context.req.raw);
  });
  app.route(
    "/api/extension/v1",
    createExtensionRouter(db, auth, captureStorage),
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
    context.set("humanAccess", await resolveHumanAccess(db, ownerSession.user));
    await next();
  });

  app.get("/api/v1/session", async (context) => {
    const ownerSession = context.get("ownerSession");
    const access = context.get("humanAccess");

    return context.json({
      user: {
        id: ownerSession.user.id,
        name: ownerSession.user.name,
        email: ownerSession.user.email,
      },
      workspace: access
        ? {
            id: access.workspaceId,
            name: access.workspaceName,
            version: access.workspaceVersion,
            role: access.role,
          }
        : null,
    });
  });

  app.get("/api/v1/mcp/config", (context) => {
    requireWorkspaceOwner(requireHumanAccess(context.get("humanAccess")));
    return context.json({ resource, connected: false });
  });

  app.post("/api/v1/workspace", async (context) => {
    const input = await context.req.json().catch(() => null);
    const parsed = workspaceInputSchema.safeParse(input);
    if (!parsed.success) {
      return context.json(validationError(parsed.error.issues), 400);
    }

    const ownerSession = context.get("ownerSession");
    if (context.get("humanAccess")) {
      return context.json(
        { error: "A workspace membership already exists" },
        409,
      );
    }
    const [owner] = await db
      .select({ userId: instanceOwner.userId })
      .from(instanceOwner)
      .where(eq(instanceOwner.userId, ownerSession.user.id))
      .limit(1);
    if (!owner) {
      return context.json({ error: "A workspace invitation is required" }, 403);
    }
    try {
      const createdWorkspace = await db.transaction(async (tx) => {
        const [created] = await tx
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
        if (!created) throw new Error("Workspace insert returned no row");
        await tx.insert(workspaceMembership).values({
          workspaceId: created.id,
          userId: ownerSession.user.id,
          role: "owner",
        });
        await tx.insert(membershipEvent).values({
          id: randomUUID(),
          workspaceId: created.id,
          subjectUserId: ownerSession.user.id,
          actorUserId: ownerSession.user.id,
          type: "membership.owner_created",
          nextRole: "owner",
        });
        return created;
      });

      return context.json(
        { workspace: { ...createdWorkspace, role: "owner" as const } },
        201,
      );
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

    const access = context.get("humanAccess");
    if (!access) {
      return context.json({ error: "Workspace not found" }, 404);
    }
    requireWorkspaceOwner(access);
    const [updatedWorkspace] = await db
      .update(workspace)
      .set({
        name: parsed.data.name,
        version: sql`${workspace.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(workspace.id, access.workspaceId))
      .returning({
        id: workspace.id,
        name: workspace.name,
        version: workspace.version,
      });

    if (!updatedWorkspace) {
      return context.json({ error: "Workspace not found" }, 404);
    }
    return context.json({
      workspace: { ...updatedWorkspace, role: access.role },
    });
  });

  app.route("/api/v1", createTrackerRouter({ db }));
  app.route("/api/v1", createAccountRouter(db, auth));
  app.route("/api/v1", createAgentRouter({ db }));
  app.route(
    "/api/v1",
    createInvitationRouter({ db, baseUrl: String(auth.options.baseURL) }),
  );
  app.route("/api/v1", createExtensionAccountRouter(db, auth));
  app.route("/api/v1", createEvidenceRouter(db, captureStorage));

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
