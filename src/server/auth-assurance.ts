import { and, eq, gt } from "drizzle-orm";
import type { Database } from "./db/client.js";
import { authenticationAssurance, session } from "./db/schema.js";
import { DomainError } from "./domain/errors.js";

export const assuranceLifetimeMs = 5 * 60 * 1000;

// This is called exclusively by Better Auth's successful session.create.after
// database hook. Never accept a caller-supplied path, provider or timestamp.
export function authenticationMethod(
  context: {
    path?: string | undefined;
    params?: Record<string, unknown> | undefined;
  } | null,
) {
  if (context?.path === "/sign-in/email") return "password" as const;
  if (
    (context?.path === "/callback/:id" ||
      context?.path === "/callback/google") &&
    context.params?.id === "google"
  )
    return "google" as const;
  return null;
}

export async function requireRecentAuthentication(
  db: Database,
  sessionId: string,
  userId: string,
) {
  const now = new Date();
  const [proof] = await db
    .select({ authenticatedAt: authenticationAssurance.authenticatedAt })
    .from(authenticationAssurance)
    .innerJoin(session, eq(session.id, authenticationAssurance.sessionId))
    .where(
      and(
        eq(session.id, sessionId),
        eq(session.userId, userId),
        eq(authenticationAssurance.userId, userId),
        gt(session.expiresAt, now),
        gt(
          authenticationAssurance.authenticatedAt,
          new Date(now.getTime() - assuranceLifetimeMs),
        ),
      ),
    )
    .for("share");
  if (!proof || proof.authenticatedAt > now)
    throw new DomainError(
      "forbidden",
      "Sign out and sign in again before changing workspace ownership. A recent login (within 5 minutes) is required; refreshing or accepting an invitation does not count.",
    );
  return proof.authenticatedAt;
}
