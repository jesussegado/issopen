import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { session, workspaceInvitation } from "../db/schema.js";
import { invitationTokenSchema } from "../invitation-primitives.js";
import { acceptInvitation, redeemInvitation } from "./auth-flow.js";

const provisionalSessionMs = 15 * 60 * 1000;

export function invitationAuthPlugin(db: Database): BetterAuthPlugin {
  return {
    id: "issopen-invitations",
    endpoints: {
      redeemInvitation: createAuthEndpoint(
        "/invitations/redeem",
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
          const redeemed = await redeemInvitation(
            db,
            ctx.body.token,
            current ? { id: current.user.id, email: current.user.email } : null,
          );
          if (!current) {
            const expiresAt = new Date(Date.now() + provisionalSessionMs);
            const provisionalSession =
              await ctx.context.internalAdapter.createSession(
                redeemed.userId,
                true,
                { expiresAt },
                true,
              );
            const invitedUser = await ctx.context.internalAdapter.findUserById(
              redeemed.userId,
            );
            if (!provisionalSession || !invitedUser) {
              throw new APIError("INTERNAL_SERVER_ERROR", {
                code: "INVITATION_SESSION_FAILED",
                message: "Could not start the invitation session",
              });
            }
            const [bound] = await db
              .update(workspaceInvitation)
              .set({ provisionalSessionId: provisionalSession.id })
              .where(
                and(
                  eq(workspaceInvitation.id, redeemed.invitationId),
                  eq(workspaceInvitation.claimedByUserId, redeemed.userId),
                  isNull(workspaceInvitation.revokedAt),
                  isNull(workspaceInvitation.acceptedAt),
                  gt(workspaceInvitation.expiresAt, new Date()),
                  redeemed.previousProvisionalSessionId
                    ? eq(
                        workspaceInvitation.provisionalSessionId,
                        redeemed.previousProvisionalSessionId,
                      )
                    : isNull(workspaceInvitation.provisionalSessionId),
                ),
              )
              .returning({ id: workspaceInvitation.id });
            if (!bound) {
              await ctx.context.internalAdapter.deleteSession(
                provisionalSession.token,
              );
              throw new APIError("CONFLICT", {
                code: "INVITATION_UNAVAILABLE",
                message: "This invitation can no longer be accepted",
              });
            }
            if (redeemed.previousProvisionalSessionId) {
              await db
                .delete(session)
                .where(eq(session.id, redeemed.previousProvisionalSessionId));
            }
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
      acceptInvitation: createAuthEndpoint(
        "/invitations/accept",
        {
          method: "POST",
          requireHeaders: true,
          use: [formCsrfMiddleware, sessionMiddleware],
          body: z.object({ invitationId: z.uuid() }).strict(),
        },
        async (ctx) => {
          const current = ctx.context.session;
          const accepted = await acceptInvitation(db, ctx.body.invitationId, {
            id: current.user.id,
            email: current.user.email,
          });
          await ctx.context.internalAdapter.deleteSession(
            current.session.token,
          );
          const freshSession = await ctx.context.internalAdapter.createSession(
            current.user.id,
          );
          const freshUser = await ctx.context.internalAdapter.findUserById(
            current.user.id,
          );
          if (!freshSession || !freshUser) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              code: "MEMBER_SESSION_FAILED",
              message: "Membership was activated; sign in again",
            });
          }
          await setSessionCookie(ctx, {
            session: freshSession,
            user: freshUser,
          });
          return ctx.json({ membership: accepted });
        },
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path) => path === "/invitations/redeem",
        window: 60,
        max: 10,
      },
      {
        pathMatcher: (path) => path === "/invitations/accept",
        window: 60,
        max: 10,
      },
    ],
  } as BetterAuthPlugin;
}
