import { randomUUID } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import type { Database } from "./db/client.js";
import {
  account,
  instanceOwner,
  membershipEvent,
  ownerWorkspaceInvitation,
  ownerWorkspaceInvitationEvent,
  session,
  user,
  workspace,
  workspaceInvitation,
  workspaceMembership,
} from "./db/schema.js";
import { DomainError } from "./domain/index.js";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationLifetimeMs,
  invitationState,
  invitationTokenSchema,
  maskInvitationEmail,
  normalizeInvitationEmail,
} from "./invitation-primitives.js";

const provisionalSessionMs = 15 * 60 * 1000;

export const createOwnerWorkspaceInvitationSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
    workspaceName: z.string().trim().min(1).max(120),
  })
  .strict();

function invitationSummary(row: typeof ownerWorkspaceInvitation.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    workspaceName: row.workspaceName,
    state: invitationState(row),
    createdWorkspaceId: row.createdWorkspaceId,
    expiresAt: row.expiresAt,
    claimedAt: row.claimedAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

export async function isInstanceOwner(db: Database, userId: string) {
  const [owner] = await db
    .select({ userId: instanceOwner.userId })
    .from(instanceOwner)
    .where(eq(instanceOwner.userId, userId))
    .limit(1);
  return Boolean(owner);
}

async function lockInstanceOwner(db: Database, userId: string) {
  const [owner] = await db
    .select({ userId: instanceOwner.userId })
    .from(instanceOwner)
    .where(eq(instanceOwner.singletonSlot, 1))
    .for("update");
  if (!owner || owner.userId !== userId)
    throw new DomainError(
      "forbidden",
      "Only the Issopen instance owner can invite workspace owners",
    );
}

function uniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && uniqueViolation(error.cause);
}

export class OwnerWorkspaceInvitationService {
  constructor(private readonly db: Database) {}

  async inspect(rawToken: string) {
    const parsed = invitationTokenSchema.safeParse(rawToken);
    if (!parsed.success) return null;
    const [row] = await this.db
      .select()
      .from(ownerWorkspaceInvitation)
      .where(
        eq(
          ownerWorkspaceInvitation.tokenHash,
          hashInvitationToken(parsed.data),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      workspaceName: row.workspaceName,
      email: maskInvitationEmail(row.email),
      state: invitationState(row),
      expiresAt: row.expiresAt,
    };
  }

  async list(actorUserId: string) {
    await lockInstanceOwner(this.db, actorUserId);
    const rows = await this.db
      .select()
      .from(ownerWorkspaceInvitation)
      .orderBy(desc(ownerWorkspaceInvitation.createdAt));
    return { invitations: rows.map(invitationSummary) };
  }

  async create(
    actorUserId: string,
    input: z.infer<typeof createOwnerWorkspaceInvitationSchema>,
  ) {
    const email = normalizeInvitationEmail(input.email);
    const rawToken = createInvitationToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + invitationLifetimeMs);
    const created = await this.db.transaction(async (tx) => {
      await lockInstanceOwner(tx, actorUserId);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`owner-invitation-email:${email}`}))`,
      );
      const [active] = await tx
        .select({ id: ownerWorkspaceInvitation.id })
        .from(ownerWorkspaceInvitation)
        .where(
          and(
            eq(ownerWorkspaceInvitation.email, email),
            isNull(ownerWorkspaceInvitation.acceptedAt),
            isNull(ownerWorkspaceInvitation.revokedAt),
          ),
        )
        .limit(1);
      if (active)
        throw new DomainError(
          "conflict",
          "An active Owner invitation already exists for this email",
        );
      const [existing] = await tx
        .select({ userId: user.id, workspaceId: workspace.id })
        .from(user)
        .leftJoin(workspace, eq(workspace.ownerId, user.id))
        .where(eq(user.email, email))
        .limit(1);
      if (existing?.workspaceId)
        throw new DomainError(
          "conflict",
          "This person already owns a workspace",
        );
      const [row] = await tx
        .insert(ownerWorkspaceInvitation)
        .values({
          id: randomUUID(),
          email,
          workspaceName: input.workspaceName,
          tokenHash: hashInvitationToken(rawToken),
          createdByUserId: actorUserId,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error("Owner invitation insert returned no row");
      await tx.insert(ownerWorkspaceInvitationEvent).values({
        id: randomUUID(),
        invitationId: row.id,
        actorUserId,
        type: "owner_invitation.created",
      });
      return row;
    });
    return { invitation: invitationSummary(created), token: rawToken };
  }

  async resend(actorUserId: string, invitationId: string) {
    const rawToken = createInvitationToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + invitationLifetimeMs);
    const updated = await this.db.transaction(async (tx) => {
      await lockInstanceOwner(tx, actorUserId);
      const [row] = await tx
        .update(ownerWorkspaceInvitation)
        .set({
          tokenHash: hashInvitationToken(rawToken),
          expiresAt,
          updatedAt: now,
        })
        .where(
          and(
            eq(ownerWorkspaceInvitation.id, invitationId),
            isNull(ownerWorkspaceInvitation.claimedAt),
            isNull(ownerWorkspaceInvitation.acceptedAt),
            isNull(ownerWorkspaceInvitation.revokedAt),
          ),
        )
        .returning();
      if (!row)
        throw new DomainError(
          "conflict",
          "Only an unclaimed Owner invitation can receive a new link",
        );
      await tx.insert(ownerWorkspaceInvitationEvent).values({
        id: randomUUID(),
        invitationId,
        actorUserId,
        type: "owner_invitation.resent",
      });
      return row;
    });
    return { invitation: invitationSummary(updated), token: rawToken };
  }

  async revoke(actorUserId: string, invitationId: string) {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await lockInstanceOwner(tx, actorUserId);
      const [row] = await tx
        .update(ownerWorkspaceInvitation)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(ownerWorkspaceInvitation.id, invitationId),
            isNull(ownerWorkspaceInvitation.acceptedAt),
            isNull(ownerWorkspaceInvitation.revokedAt),
          ),
        )
        .returning();
      if (!row)
        throw new DomainError("not_found", "Owner invitation not found");
      if (row.provisionalSessionId)
        await tx
          .delete(session)
          .where(eq(session.id, row.provisionalSessionId));
      await tx.insert(ownerWorkspaceInvitationEvent).values({
        id: randomUUID(),
        invitationId,
        actorUserId,
        type: "owner_invitation.revoked",
      });
      return { revoked: true, invitationId };
    });
  }
}

async function reusableProvisionalIdentity(
  db: Database,
  userId: string,
  currentInvitationId: string,
) {
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`invitation-user:${userId}`}))`,
  );
  const now = new Date();
  const [identity] = await db
    .select({ emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!identity || identity.emailVerified) return false;
  const [linked, membership, owned, platform, memberClaim, ownerClaim] =
    await Promise.all([
      db
        .select({ id: account.id })
        .from(account)
        .where(eq(account.userId, userId))
        .limit(1),
      db
        .select({ id: workspaceMembership.workspaceId })
        .from(workspaceMembership)
        .where(eq(workspaceMembership.userId, userId))
        .limit(1),
      db
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.ownerId, userId))
        .limit(1),
      db
        .select({ id: instanceOwner.userId })
        .from(instanceOwner)
        .where(eq(instanceOwner.userId, userId))
        .limit(1),
      db
        .select({ id: workspaceInvitation.id })
        .from(workspaceInvitation)
        .where(
          and(
            eq(workspaceInvitation.claimedByUserId, userId),
            isNotNull(workspaceInvitation.claimedAt),
            isNull(workspaceInvitation.acceptedAt),
            isNull(workspaceInvitation.revokedAt),
            gt(workspaceInvitation.expiresAt, now),
          ),
        )
        .limit(1),
      db
        .select({ id: ownerWorkspaceInvitation.id })
        .from(ownerWorkspaceInvitation)
        .where(
          and(
            eq(ownerWorkspaceInvitation.claimedByUserId, userId),
            ne(ownerWorkspaceInvitation.id, currentInvitationId),
            isNotNull(ownerWorkspaceInvitation.claimedAt),
            isNull(ownerWorkspaceInvitation.acceptedAt),
            isNull(ownerWorkspaceInvitation.revokedAt),
            gt(ownerWorkspaceInvitation.expiresAt, now),
          ),
        )
        .limit(1),
    ]);
  return (
    !linked[0] &&
    !membership[0] &&
    !owned[0] &&
    !platform[0] &&
    !memberClaim[0] &&
    !ownerClaim[0]
  );
}

async function redeemOwnerInvitation(
  db: Database,
  rawToken: string,
  authenticatedUser: { id: string; email: string } | null,
) {
  const parsedToken = invitationTokenSchema.parse(rawToken);
  const hash = hashInvitationToken(parsedToken);
  const now = new Date();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`owner-invitation:${hash}`}))`,
    );
    const [invite] = await tx
      .select()
      .from(ownerWorkspaceInvitation)
      .where(eq(ownerWorkspaceInvitation.tokenHash, hash))
      .limit(1);
    if (!invite)
      throw new APIError("NOT_FOUND", {
        code: "OWNER_INVITATION_NOT_FOUND",
        message: "Owner invitation not found",
      });
    if (invite.revokedAt)
      throw new APIError("FORBIDDEN", {
        code: "OWNER_INVITATION_REVOKED",
        message: "This Owner invitation was revoked",
      });
    if (invite.acceptedAt)
      throw new APIError("CONFLICT", {
        code: "OWNER_INVITATION_USED",
        message: "This Owner invitation has already been used",
      });
    if (invite.expiresAt <= now)
      throw new APIError("GONE", {
        code: "OWNER_INVITATION_EXPIRED",
        message: "This Owner invitation has expired",
      });
    if (invite.claimedAt) {
      if (
        authenticatedUser?.id === invite.claimedByUserId &&
        normalizeInvitationEmail(authenticatedUser.email) === invite.email
      )
        return {
          invitationId: invite.id,
          userId: authenticatedUser.id,
          email: authenticatedUser.email,
          resumed: false,
          previousProvisionalSessionId: null,
        };
      if (
        !authenticatedUser &&
        invite.claimedByUserId &&
        (await reusableProvisionalIdentity(
          tx,
          invite.claimedByUserId,
          invite.id,
        ))
      ) {
        const [claimed] = await tx
          .select({ email: user.email })
          .from(user)
          .where(eq(user.id, invite.claimedByUserId))
          .limit(1);
        if (claimed && normalizeInvitationEmail(claimed.email) === invite.email)
          return {
            invitationId: invite.id,
            userId: invite.claimedByUserId,
            email: claimed.email,
            resumed: true,
            previousProvisionalSessionId: invite.provisionalSessionId,
          };
      }
      throw new APIError("CONFLICT", {
        code: "OWNER_INVITATION_USED",
        message: "This Owner invitation has already been claimed",
      });
    }

    const [existingUser] = await tx
      .select({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      })
      .from(user)
      .where(eq(user.email, invite.email))
      .limit(1);
    let target = existingUser;
    if (existingUser) {
      if (!authenticatedUser) {
        if (
          !(await reusableProvisionalIdentity(tx, existingUser.id, invite.id))
        )
          throw new APIError("CONFLICT", {
            code: "EXISTING_ACCOUNT_REQUIRES_SIGN_IN",
            message:
              "Sign in to the existing Issopen account before continuing",
          });
      } else if (
        authenticatedUser.id !== existingUser.id ||
        normalizeInvitationEmail(authenticatedUser.email) !== invite.email
      )
        throw new APIError("FORBIDDEN", {
          code: "OWNER_INVITATION_EMAIL_MISMATCH",
          message: "The signed-in account does not match this Owner invitation",
        });
    } else {
      if (
        authenticatedUser &&
        normalizeInvitationEmail(authenticatedUser.email) !== invite.email
      )
        throw new APIError("FORBIDDEN", {
          code: "OWNER_INVITATION_EMAIL_MISMATCH",
          message: "The signed-in account does not match this Owner invitation",
        });
      const [created] = await tx
        .insert(user)
        .values({
          id: randomUUID(),
          email: invite.email,
          emailVerified: false,
          name: invite.email.split("@")[0] || "Invited owner",
        })
        .returning({
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
        });
      if (!created)
        throw new Error("Owner invitation user insert returned no row");
      target = created;
    }
    if (!target) throw new Error("Owner invitation user was not resolved");
    const [claimed] = await tx
      .update(ownerWorkspaceInvitation)
      .set({
        claimedByUserId: target.id,
        claimedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(ownerWorkspaceInvitation.id, invite.id),
          isNull(ownerWorkspaceInvitation.claimedAt),
          isNull(ownerWorkspaceInvitation.acceptedAt),
          isNull(ownerWorkspaceInvitation.revokedAt),
          gt(ownerWorkspaceInvitation.expiresAt, now),
        ),
      )
      .returning({ id: ownerWorkspaceInvitation.id });
    if (!claimed)
      throw new APIError("CONFLICT", {
        code: "OWNER_INVITATION_USED",
        message: "This Owner invitation has already been claimed",
      });
    await tx.insert(ownerWorkspaceInvitationEvent).values({
      id: randomUUID(),
      invitationId: invite.id,
      actorUserId: target.id,
      type: "owner_invitation.claimed",
    });
    return {
      invitationId: invite.id,
      userId: target.id,
      email: target.email,
      resumed: false,
      previousProvisionalSessionId: null,
    };
  });
}

async function acceptOwnerInvitation(
  db: Database,
  invitationId: string,
  authenticatedUser: { id: string; email: string },
) {
  const now = new Date();
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`owner-invitation:${invitationId}`}))`,
      );
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`workspace-owner:${authenticatedUser.id}`}))`,
      );
      const [invite] = await tx
        .select()
        .from(ownerWorkspaceInvitation)
        .where(eq(ownerWorkspaceInvitation.id, invitationId))
        .limit(1);
      if (!invite || invite.claimedByUserId !== authenticatedUser.id)
        throw new APIError("NOT_FOUND", {
          code: "OWNER_INVITATION_NOT_FOUND",
          message: "Owner invitation not found",
        });
      if (invite.acceptedAt && invite.createdWorkspaceId)
        return {
          invitationId,
          workspaceId: invite.createdWorkspaceId,
          role: "owner" as const,
        };
      if (
        normalizeInvitationEmail(authenticatedUser.email) !== invite.email ||
        invite.revokedAt ||
        invite.expiresAt <= now ||
        !invite.claimedAt
      )
        throw new APIError("FORBIDDEN", {
          code: "OWNER_INVITATION_UNAVAILABLE",
          message: "This Owner invitation can no longer be accepted",
        });
      const [google] = await tx
        .select({ id: account.id })
        .from(account)
        .where(
          and(
            eq(account.userId, authenticatedUser.id),
            eq(account.providerId, "google"),
            gte(account.updatedAt, invite.claimedAt),
          ),
        )
        .limit(1);
      if (!google)
        throw new APIError("FORBIDDEN", {
          code: "GOOGLE_REAUTH_REQUIRED",
          message:
            "Verify this Owner invitation with the matching Google account",
        });
      const [owned] = await tx
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.ownerId, authenticatedUser.id))
        .limit(1);
      if (owned)
        throw new APIError("CONFLICT", {
          code: "OWNER_WORKSPACE_ALREADY_EXISTS",
          message: "This account already owns a workspace",
        });
      const workspaceId = randomUUID();
      await tx.insert(workspace).values({
        id: workspaceId,
        ownerId: authenticatedUser.id,
        name: invite.workspaceName,
      });
      await tx.insert(workspaceMembership).values({
        workspaceId,
        userId: authenticatedUser.id,
        role: "owner",
      });
      await tx.insert(membershipEvent).values({
        id: randomUUID(),
        workspaceId,
        subjectUserId: authenticatedUser.id,
        actorUserId: authenticatedUser.id,
        type: "membership.owner_created",
        nextRole: "owner",
      });
      await tx
        .update(user)
        .set({ emailVerified: true, updatedAt: now })
        .where(eq(user.id, authenticatedUser.id));
      await tx
        .update(ownerWorkspaceInvitation)
        .set({
          acceptedAt: now,
          createdWorkspaceId: workspaceId,
          provisionalSessionId: null,
          updatedAt: now,
        })
        .where(eq(ownerWorkspaceInvitation.id, invitationId));
      await tx.insert(ownerWorkspaceInvitationEvent).values({
        id: randomUUID(),
        invitationId,
        actorUserId: authenticatedUser.id,
        type: "owner_invitation.accepted",
      });
      return { invitationId, workspaceId, role: "owner" as const };
    });
  } catch (error) {
    if (uniqueViolation(error))
      throw new APIError("CONFLICT", {
        code: "OWNER_WORKSPACE_ALREADY_EXISTS",
        message: "This account already owns a workspace",
      });
    throw error;
  }
}

export function ownerInvitationAuthPlugin(db: Database): BetterAuthPlugin {
  return {
    id: "issopen-owner-invitations",
    endpoints: {
      redeemOwnerInvitation: createAuthEndpoint(
        "/owner-invitations/redeem",
        {
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware],
          body: z.object({ token: invitationTokenSchema }).strict(),
        },
        async (ctx) => {
          const current = await getSessionFromCtx(ctx, {
            disableRefresh: true,
          });
          const redeemed = await redeemOwnerInvitation(
            db,
            ctx.body.token,
            current ? { id: current.user.id, email: current.user.email } : null,
          );
          if (!current) {
            const provisionalSession =
              await ctx.context.internalAdapter.createSession(
                redeemed.userId,
                true,
                { expiresAt: new Date(Date.now() + provisionalSessionMs) },
                true,
              );
            const invitedUser = await ctx.context.internalAdapter.findUserById(
              redeemed.userId,
            );
            if (!provisionalSession || !invitedUser)
              throw new APIError("INTERNAL_SERVER_ERROR", {
                code: "OWNER_INVITATION_SESSION_FAILED",
                message: "Could not start the Owner invitation session",
              });
            const [bound] = await db
              .update(ownerWorkspaceInvitation)
              .set({ provisionalSessionId: provisionalSession.id })
              .where(
                and(
                  eq(ownerWorkspaceInvitation.id, redeemed.invitationId),
                  eq(ownerWorkspaceInvitation.claimedByUserId, redeemed.userId),
                  isNull(ownerWorkspaceInvitation.revokedAt),
                  isNull(ownerWorkspaceInvitation.acceptedAt),
                  gt(ownerWorkspaceInvitation.expiresAt, new Date()),
                  redeemed.previousProvisionalSessionId
                    ? eq(
                        ownerWorkspaceInvitation.provisionalSessionId,
                        redeemed.previousProvisionalSessionId,
                      )
                    : isNull(ownerWorkspaceInvitation.provisionalSessionId),
                ),
              )
              .returning({ id: ownerWorkspaceInvitation.id });
            if (!bound) {
              await ctx.context.internalAdapter.deleteSession(
                provisionalSession.token,
              );
              throw new APIError("CONFLICT", {
                code: "OWNER_INVITATION_UNAVAILABLE",
                message: "This Owner invitation can no longer be accepted",
              });
            }
            if (redeemed.previousProvisionalSessionId)
              await db
                .delete(session)
                .where(eq(session.id, redeemed.previousProvisionalSessionId));
            await setSessionCookie(
              ctx,
              { session: provisionalSession, user: invitedUser },
              true,
              { maxAge: provisionalSessionMs / 1000 },
            );
          }
          return ctx.json({
            invitationId: redeemed.invitationId,
            requiresGoogleVerification: true,
            ...(redeemed.resumed ? { resumed: true } : {}),
          });
        },
      ),
      acceptOwnerInvitation: createAuthEndpoint(
        "/owner-invitations/accept",
        {
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware, sessionMiddleware],
          body: z.object({ invitationId: z.uuid() }).strict(),
        },
        async (ctx) => {
          const current = ctx.context.session;
          const accepted = await acceptOwnerInvitation(
            db,
            ctx.body.invitationId,
            { id: current.user.id, email: current.user.email },
          );
          await ctx.context.internalAdapter.deleteSession(
            current.session.token,
          );
          const freshSession = await ctx.context.internalAdapter.createSession(
            current.user.id,
          );
          const freshUser = await ctx.context.internalAdapter.findUserById(
            current.user.id,
          );
          if (!freshSession || !freshUser)
            throw new APIError("INTERNAL_SERVER_ERROR", {
              code: "OWNER_SESSION_FAILED",
              message: "Workspace ownership was activated; sign in again",
            });
          await setSessionCookie(ctx, {
            session: freshSession,
            user: freshUser,
          });
          return ctx.json({ workspace: accepted });
        },
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path) => path === "/owner-invitations/redeem",
        window: 60,
        max: 10,
      },
      {
        pathMatcher: (path) => path === "/owner-invitations/accept",
        window: 60,
        max: 10,
      },
    ],
  } as BetterAuthPlugin;
}
