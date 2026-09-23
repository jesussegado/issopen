import { and, desc, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { IssopenAuth, OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import { session } from "../db/schema.js";
import { DomainError } from "../domain/index.js";
import { parseHttpInput } from "./validation.js";

const sessionIdentifierSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[a-zA-Z0-9_-]+$/);

// Labels are approximate and untrusted User-Agent text is never returned.
export function sessionDeviceLabel(userAgent: string | null): string {
  const ua = (userAgent ?? "").slice(0, 2048);
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const device = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "unknown device";
  return `${browser} · ${device}`;
}

export function createAccountRouter(db: Database, auth: IssopenAuth) {
  const router = new Hono<{
    Variables: { ownerSession: OwnerSession };
  }>();
  router.use("/account/*", async (context, next) => {
    context.header("Cache-Control", "no-store");
    await next();
  });

  router.get("/account/sessions", async (context) => {
    const current = context.get("ownerSession");
    const rows = await db
      .select({
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt,
        userAgent: session.userAgent,
      })
      .from(session)
      .where(
        and(
          eq(session.userId, current.user.id),
          gt(session.expiresAt, new Date()),
        ),
      )
      .orderBy(
        desc(eq(session.id, current.session.id)),
        desc(session.createdAt),
        desc(session.id),
      )
      .limit(101);
    return context.json({
      sessions: rows.slice(0, 100).map(({ userAgent, ...row }) => ({
        ...row,
        current: row.id === current.session.id,
        device: sessionDeviceLabel(userAgent),
      })),
      hasMore: rows.length > 100,
    });
  });

  router.post("/account/sessions/revoke-others", async (context) => {
    const response = await auth.api.revokeOtherSessions({
      headers: context.req.raw.headers,
      asResponse: true,
    });
    if (!response.ok) {
      return context.json(
        { error: "Sessions could not be closed. Sign in again and retry." },
        response.status === 401 ? 401 : 403,
      );
    }
    return context.json({ revoked: true, current: false });
  });

  router.post("/account/sessions/:sessionId/revoke", async (context) => {
    const sessionId = parseHttpInput(
      sessionIdentifierSchema,
      context.req.param("sessionId"),
      { message: "Invalid session identifier", fields: false },
    );
    const current = context.get("ownerSession");
    const [target] = await db
      .select({ token: session.token })
      .from(session)
      .where(
        and(eq(session.id, sessionId), eq(session.userId, current.user.id)),
      )
      .limit(1);
    if (!target) throw new DomainError("not_found", "Session not found");

    const isCurrent = sessionId === current.session.id;
    const response = isCurrent
      ? await auth.api.signOut({
          headers: context.req.raw.headers,
          asResponse: true,
        })
      : await auth.api.revokeSession({
          headers: context.req.raw.headers,
          body: { token: target.token },
          asResponse: true,
        });
    if (!response.ok) {
      return context.json(
        { error: "Session could not be closed. Sign in again and retry." },
        response.status === 401 ? 401 : 403,
      );
    }
    // Only signOut cookie cleanup is forwarded; never forward a token/body.
    for (const cookie of response.headers.getSetCookie()) {
      context.header("Set-Cookie", cookie, { append: true });
    }
    return context.json({ revoked: true, current: isCurrent });
  });

  return router;
}
