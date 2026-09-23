import { randomUUID } from "node:crypto";
import { APIError } from "better-auth/api";
import { and, eq, gt, gte, isNotNull, isNull, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  account,
  instanceOwner,
  membershipEvent,
  ownerWorkspaceInvitation,
  projectMembership,
  user,
  workspace,
  workspaceInvitation,
  workspaceInvitationEvent,
  workspaceInvitationProject,
  workspaceMembership,
} from "../db/schema.js";
import {
  hashInvitationToken,
  invitationTokenSchema,
  normalizeInvitationEmail,
} from "../invitation-primitives.js";

export async function redeemInvitation(
  db: Database,
  rawToken: string,
  authenticatedUser: { id: string; email: string } | null,
) {
  const parsedToken = invitationTokenSchema.parse(rawToken);
  const hash = hashInvitationToken(parsedToken);
  const now = new Date();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`invitation:${hash}`}))`,
    );
    const [invite] = await tx
      .select()
      .from(workspaceInvitation)
      .where(eq(workspaceInvitation.tokenHash, hash))
      .limit(1);
    if (!invite) {
      throw new APIError("NOT_FOUND", {
        code: "INVITATION_NOT_FOUND",
        message: "Invitation not found",
      });
    }
    if (invite.revokedAt) {
      throw new APIError("FORBIDDEN", {
        code: "INVITATION_REVOKED",
        message: "This invitation was revoked",
      });
    }
    if (invite.acceptedAt) {
      throw new APIError("CONFLICT", {
        code: "INVITATION_USED",
        message: "This invitation has already been used",
      });
    }
    if (invite.expiresAt <= now) {
      throw new APIError("GONE", {
        code: "INVITATION_EXPIRED",
        message: "This invitation has expired",
      });
    }
    if (invite.claimedAt) {
      if (
        authenticatedUser?.id === invite.claimedByUserId &&
        normalizeInvitationEmail(authenticatedUser.email) === invite.email
      ) {
        return {
          invitationId: invite.id,
          userId: authenticatedUser.id,
          email: authenticatedUser.email,
          provisional: false,
          resumed: false,
          previousProvisionalSessionId: null,
        };
      }
      // Possession of the private link may resume only an inert provisional
      // identity. It never grants workspace access or replaces Google proof.
      if (!authenticatedUser && invite.claimedByUserId) {
        const [claimedUser] = await tx
          .select({
            id: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
          })
          .from(user)
          .where(eq(user.id, invite.claimedByUserId))
          .limit(1);
        const [linkedAccount] = await tx
          .select({ id: account.id })
          .from(account)
          .where(eq(account.userId, invite.claimedByUserId))
          .limit(1);
        const [existingMembership] = await tx
          .select({ workspaceId: workspaceMembership.workspaceId })
          .from(workspaceMembership)
          .where(eq(workspaceMembership.userId, invite.claimedByUserId))
          .limit(1);
        const [ownerClaim] = await tx
          .select({ id: ownerWorkspaceInvitation.id })
          .from(ownerWorkspaceInvitation)
          .where(
            and(
              eq(
                ownerWorkspaceInvitation.claimedByUserId,
                invite.claimedByUserId,
              ),
              isNotNull(ownerWorkspaceInvitation.claimedAt),
              isNull(ownerWorkspaceInvitation.acceptedAt),
              isNull(ownerWorkspaceInvitation.revokedAt),
              gt(ownerWorkspaceInvitation.expiresAt, now),
            ),
          )
          .limit(1);
        const resumableProvisionalIdentity =
          claimedUser?.emailVerified === false &&
          !linkedAccount &&
          !existingMembership &&
          !ownerClaim;
        if (
          claimedUser &&
          normalizeInvitationEmail(claimedUser.email) === invite.email &&
          resumableProvisionalIdentity
        ) {
          return {
            invitationId: invite.id,
            userId: claimedUser.id,
            email: claimedUser.email,
            provisional: true,
            resumed: true,
            previousProvisionalSessionId: invite.provisionalSessionId,
          };
        }
      }
      throw new APIError("CONFLICT", {
        code: "INVITATION_USED",
        message: "This invitation has already been used",
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
    let targetUser = existingUser;
    let provisional = false;
    if (existingUser) {
      if (!authenticatedUser) {
        // A replacement invitation may reuse only a completely inert identity.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`invitation-user:${existingUser.id}`}))`,
        );
        const [linkedAccount] = await tx
          .select({ id: account.id })
          .from(account)
          .where(eq(account.userId, existingUser.id))
          .limit(1);
        const [existingMembership] = await tx
          .select({ workspaceId: workspaceMembership.workspaceId })
          .from(workspaceMembership)
          .where(eq(workspaceMembership.userId, existingUser.id))
          .limit(1);
        const [ownedInstance] = await tx
          .select({ userId: instanceOwner.userId })
          .from(instanceOwner)
          .where(eq(instanceOwner.userId, existingUser.id))
          .limit(1);
        const [ownedWorkspace] = await tx
          .select({ id: workspace.id })
          .from(workspace)
          .where(eq(workspace.ownerId, existingUser.id))
          .limit(1);
        const [otherActiveClaim] = await tx
          .select({ id: workspaceInvitation.id })
          .from(workspaceInvitation)
          .where(
            and(
              eq(workspaceInvitation.claimedByUserId, existingUser.id),
              isNotNull(workspaceInvitation.claimedAt),
              isNull(workspaceInvitation.acceptedAt),
              isNull(workspaceInvitation.revokedAt),
              gt(workspaceInvitation.expiresAt, now),
            ),
          )
          .limit(1);
        const [ownerActiveClaim] = await tx
          .select({ id: ownerWorkspaceInvitation.id })
          .from(ownerWorkspaceInvitation)
          .where(
            and(
              eq(ownerWorkspaceInvitation.claimedByUserId, existingUser.id),
              isNotNull(ownerWorkspaceInvitation.claimedAt),
              isNull(ownerWorkspaceInvitation.acceptedAt),
              isNull(ownerWorkspaceInvitation.revokedAt),
              gt(ownerWorkspaceInvitation.expiresAt, now),
            ),
          )
          .limit(1);
        const reusableAbandonedIdentity =
          existingUser.emailVerified === false &&
          !linkedAccount &&
          !existingMembership &&
          !ownedInstance &&
          !ownedWorkspace &&
          !otherActiveClaim &&
          !ownerActiveClaim;
        if (!reusableAbandonedIdentity) {
          throw new APIError("CONFLICT", {
            code: "EXISTING_ACCOUNT_REQUIRES_SIGN_IN",
            message:
              "Sign in to the existing Issopen account before continuing",
          });
        }
        provisional = true;
      } else if (
        authenticatedUser.id !== existingUser.id ||
        normalizeInvitationEmail(authenticatedUser.email) !== invite.email
      ) {
        throw new APIError("FORBIDDEN", {
          code: "INVITATION_EMAIL_MISMATCH",
          message: "The signed-in account does not match this invitation",
        });
      }
    } else {
      if (
        authenticatedUser &&
        normalizeInvitationEmail(authenticatedUser.email) !== invite.email
      ) {
        throw new APIError("FORBIDDEN", {
          code: "INVITATION_EMAIL_MISMATCH",
          message: "The signed-in account does not match this invitation",
        });
      }
      const [created] = await tx
        .insert(user)
        .values({
          id: randomUUID(),
          email: invite.email,
          emailVerified: false,
          name: invite.email.split("@")[0] || "Invited member",
        })
        .returning({
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
        });
      if (!created) throw new Error("Invitation user insert returned no row");
      targetUser = created;
      provisional = true;
    }
    if (!targetUser) throw new Error("Invitation user was not resolved");
    const [claimed] = await tx
      .update(workspaceInvitation)
      .set({
        claimedByUserId: targetUser.id,
        claimedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(workspaceInvitation.id, invite.id),
          isNull(workspaceInvitation.claimedAt),
          isNull(workspaceInvitation.acceptedAt),
          isNull(workspaceInvitation.revokedAt),
          gt(workspaceInvitation.expiresAt, now),
        ),
      )
      .returning({ id: workspaceInvitation.id });
    if (!claimed) {
      throw new APIError("CONFLICT", {
        code: "INVITATION_USED",
        message: "This invitation has already been used",
      });
    }
    await tx.insert(workspaceInvitationEvent).values({
      id: randomUUID(),
      workspaceId: invite.workspaceId,
      invitationId: invite.id,
      actorUserId: targetUser.id,
      type: "invitation.claimed",
    });
    return {
      invitationId: invite.id,
      userId: targetUser.id,
      email: targetUser.email,
      provisional,
      resumed: false,
      previousProvisionalSessionId: null,
    };
  });
}

export async function acceptInvitation(
  db: Database,
  invitationId: string,
  authenticatedUser: { id: string; email: string },
) {
  const now = new Date();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`invitation:${invitationId}`}))`,
    );
    const [invite] = await tx
      .select()
      .from(workspaceInvitation)
      .where(eq(workspaceInvitation.id, invitationId))
      .limit(1);
    if (!invite || invite.claimedByUserId !== authenticatedUser.id) {
      throw new APIError("NOT_FOUND", {
        code: "INVITATION_NOT_FOUND",
        message: "Invitation not found",
      });
    }
    if (
      normalizeInvitationEmail(authenticatedUser.email) !== invite.email ||
      invite.revokedAt ||
      invite.expiresAt <= now ||
      !invite.claimedAt
    ) {
      throw new APIError("FORBIDDEN", {
        code: "INVITATION_UNAVAILABLE",
        message: "This invitation can no longer be accepted",
      });
    }
    if (invite.acceptedAt) {
      return {
        invitationId,
        workspaceId: invite.workspaceId,
        role: invite.role,
      };
    }
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
    if (!google) {
      throw new APIError("FORBIDDEN", {
        code: "GOOGLE_REAUTH_REQUIRED",
        message: "Verify this invitation with the matching Google account",
      });
    }
    const [existingMembership] = await tx
      .select({ workspaceId: workspaceMembership.workspaceId })
      .from(workspaceMembership)
      .where(
        and(
          eq(workspaceMembership.userId, authenticatedUser.id),
          eq(workspaceMembership.workspaceId, invite.workspaceId),
        ),
      )
      .limit(1);
    if (existingMembership) {
      throw new APIError("CONFLICT", {
        code: "MEMBERSHIP_ALREADY_EXISTS",
        message: "This account already belongs to this workspace",
      });
    }
    const assignedProjects = await tx
      .select({ projectId: workspaceInvitationProject.projectId })
      .from(workspaceInvitationProject)
      .where(eq(workspaceInvitationProject.invitationId, invitationId));
    if (assignedProjects.length === 0) {
      throw new APIError("CONFLICT", {
        code: "INVITATION_HAS_NO_PROJECTS",
        message: "This invitation has no project assignments",
      });
    }
    await tx.insert(workspaceMembership).values({
      workspaceId: invite.workspaceId,
      userId: authenticatedUser.id,
      role: "member",
    });
    await tx.insert(projectMembership).values(
      assignedProjects.map(({ projectId }) => ({
        workspaceId: invite.workspaceId,
        projectId,
        userId: authenticatedUser.id,
      })),
    );
    await tx
      .update(user)
      .set({ emailVerified: true, updatedAt: now })
      .where(eq(user.id, authenticatedUser.id));
    await tx
      .update(workspaceInvitation)
      .set({ acceptedAt: now, provisionalSessionId: null, updatedAt: now })
      .where(eq(workspaceInvitation.id, invitationId));
    await tx.insert(membershipEvent).values([
      {
        id: randomUUID(),
        workspaceId: invite.workspaceId,
        subjectUserId: authenticatedUser.id,
        actorUserId: authenticatedUser.id,
        type: "membership.accepted",
        nextRole: "member",
      },
      ...assignedProjects.map(({ projectId }) => ({
        id: randomUUID(),
        workspaceId: invite.workspaceId,
        subjectUserId: authenticatedUser.id,
        actorUserId: authenticatedUser.id,
        projectId,
        type: "project.access_granted",
        nextRole: "member" as const,
        nextPermission: "edit" as const,
      })),
    ]);
    await tx.insert(workspaceInvitationEvent).values({
      id: randomUUID(),
      workspaceId: invite.workspaceId,
      invitationId,
      actorUserId: authenticatedUser.id,
      type: "invitation.accepted",
    });
    return { invitationId, workspaceId: invite.workspaceId, role: invite.role };
  });
}
