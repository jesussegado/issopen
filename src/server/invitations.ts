import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { and, asc, desc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "./db/client.js";
import {
  account,
  membershipEvent,
  oauthAccessToken,
  oauthClient,
  oauthRefreshToken,
  project,
  projectMembership,
  session,
  user,
  workspace,
  workspaceInvitation,
  workspaceInvitationEvent,
  workspaceInvitationProject,
  workspaceMembership,
} from "./db/schema.js";
import { DomainError } from "./domain/index.js";
import {
  cancelInvitationMail,
  invitationMailSummaries,
  queueInvitationMail,
} from "./invitation-mail.js";
import type { MailConfig } from "./mail-config.js";

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const provisionalSessionMs = 15 * 60 * 1000;
const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const createInvitationSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
    projectIds: z.array(z.uuid()).min(1).max(100),
    delivery: z.enum(["manual", "email"]).optional(),
  })
  .strict();

export const memberVersionSchema = z
  .object({ expectedVersion: z.uuid() })
  .strict();
export const updateMemberSchema = memberVersionSchema.extend({
  grants: z
    .array(
      z
        .object({ projectId: z.uuid(), permission: z.enum(["read", "edit"]) })
        .strict(),
    )
    .max(100),
});

async function lockOwner(db: Database, actor: InvitationActor) {
  const [row] = await db
    .select({ ownerId: workspace.ownerId })
    .from(workspace)
    .where(eq(workspace.id, actor.workspaceId))
    .for("update");
  if (!row || row.ownerId !== actor.userId)
    throw new DomainError("forbidden", "Workspace owner required");
  await requireCurrentOwner(db, actor);
}

async function requireCurrentOwner(db: Database, actor: InvitationActor) {
  const [owner] = await db
    .select({ id: workspace.id })
    .from(workspace)
    .innerJoin(
      workspaceMembership,
      and(
        eq(workspaceMembership.workspaceId, workspace.id),
        eq(workspaceMembership.userId, actor.userId),
        eq(workspaceMembership.role, "owner"),
      ),
    )
    .where(
      and(
        eq(workspace.id, actor.workspaceId),
        eq(workspace.ownerId, actor.userId),
      ),
    )
    .limit(1);
  if (!owner) throw new DomainError("forbidden", "Workspace owner required");
}

export type InvitationActor = {
  workspaceId: string;
  userId: string;
};

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function invitationToken() {
  return randomBytes(32).toString("base64url");
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function invitationState(row: typeof workspaceInvitation.$inferSelect) {
  if (row.acceptedAt) return "accepted" as const;
  if (row.revokedAt) return "revoked" as const;
  if (row.expiresAt.getTime() <= Date.now()) return "expired" as const;
  if (row.claimedAt) return "claimed" as const;
  return "pending" as const;
}

function inviteSummary(
  row: typeof workspaceInvitation.$inferSelect,
  projectIds: string[],
) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    state: invitationState(row),
    projectIds,
    expiresAt: row.expiresAt,
    claimedAt: row.claimedAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

async function invitationProjects(db: Database, invitationIds: string[]) {
  if (invitationIds.length === 0) return new Map<string, string[]>();
  const rows = await db
    .select({
      invitationId: workspaceInvitationProject.invitationId,
      projectId: workspaceInvitationProject.projectId,
    })
    .from(workspaceInvitationProject)
    .where(inArray(workspaceInvitationProject.invitationId, invitationIds))
    .orderBy(
      asc(workspaceInvitationProject.invitationId),
      asc(workspaceInvitationProject.projectId),
    );
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const values = result.get(row.invitationId) ?? [];
    values.push(row.projectId);
    result.set(row.invitationId, values);
  }
  return result;
}

export class InvitationService {
  constructor(
    private readonly db: Database,
    private readonly mail: MailConfig | null = null,
  ) {}

  private emailKey(mode: "manual" | "email" | undefined) {
    if (mode !== "email") return null;
    if (!this.mail)
      throw new DomainError(
        "invalid",
        "Email sending is not configured. Create and copy a private link instead.",
      );
    return this.mail.key;
  }

  async inspect(rawToken: string) {
    const parsed = invitationTokenSchema.safeParse(rawToken);
    if (!parsed.success) return null;
    const [row] = await this.db
      .select({
        invitation: workspaceInvitation,
        workspaceName: workspace.name,
      })
      .from(workspaceInvitation)
      .innerJoin(workspace, eq(workspace.id, workspaceInvitation.workspaceId))
      .where(eq(workspaceInvitation.tokenHash, tokenHash(parsed.data)))
      .limit(1);
    if (!row) return null;
    return {
      id: row.invitation.id,
      workspaceName: row.workspaceName,
      email: maskEmail(row.invitation.email),
      state: invitationState(row.invitation),
      expiresAt: row.invitation.expiresAt,
    };
  }

  async list(actor: InvitationActor) {
    return this.db.transaction(
      (tx) => new InvitationService(tx, this.mail).listSnapshot(actor),
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  private async listSnapshot(actor: InvitationActor) {
    await requireCurrentOwner(this.db, actor);
    const deliveries = await invitationMailSummaries(
      this.db,
      actor.workspaceId,
    );
    const [invitations, members] = await Promise.all([
      this.db
        .select()
        .from(workspaceInvitation)
        .where(eq(workspaceInvitation.workspaceId, actor.workspaceId))
        .orderBy(desc(workspaceInvitation.createdAt)),
      this.db
        .select({
          userId: workspaceMembership.userId,
          role: workspaceMembership.role,
          version: workspaceMembership.version,
          name: user.name,
          email: user.email,
          createdAt: workspaceMembership.createdAt,
        })
        .from(workspaceMembership)
        .innerJoin(user, eq(user.id, workspaceMembership.userId))
        .where(eq(workspaceMembership.workspaceId, actor.workspaceId))
        .orderBy(asc(workspaceMembership.role), asc(user.email)),
    ]);
    const [inviteProjects, memberProjects] = await Promise.all([
      invitationProjects(
        this.db,
        invitations.map((row) => row.id),
      ),
      this.db
        .select({
          userId: projectMembership.userId,
          projectId: projectMembership.projectId,
          permission: projectMembership.permission,
        })
        .from(projectMembership)
        .where(eq(projectMembership.workspaceId, actor.workspaceId))
        .orderBy(
          asc(projectMembership.userId),
          asc(projectMembership.projectId),
        ),
    ]);
    const projectsByMember = new Map<string, string[]>();
    for (const row of memberProjects) {
      const values = projectsByMember.get(row.userId) ?? [];
      values.push(row.projectId);
      projectsByMember.set(row.userId, values);
    }
    return {
      emailEnabled: Boolean(this.mail),
      invitations: invitations.map((row) => ({
        ...inviteSummary(row, inviteProjects.get(row.id) ?? []),
        delivery: deliveries.get(row.id) ?? null,
      })),
      members: members.map((row) => ({
        ...row,
        projectGrants:
          row.role === "owner"
            ? null
            : memberProjects
                .filter((grant) => grant.userId === row.userId)
                .map(({ projectId, permission }) => ({
                  projectId,
                  permission,
                })),
        projectIds:
          row.role === "owner"
            ? null
            : (projectsByMember.get(row.userId) ?? []),
      })),
    };
  }

  async create(
    actor: InvitationActor,
    input: z.infer<typeof createInvitationSchema>,
  ) {
    const key = this.emailKey(input.delivery);
    const email = normalizedEmail(input.email);
    const projectIds = [...new Set(input.projectIds)];
    if (projectIds.length !== input.projectIds.length) {
      throw new DomainError("invalid", "Project assignments must be unique");
    }
    const rawToken = invitationToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + invitationLifetimeMs);
    const created = await this.db.transaction(async (tx) => {
      await lockOwner(tx, actor);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`invitation-email:${actor.workspaceId}:${email}`}))`,
      );
      const [activeInvitation] = await tx
        .select({ id: workspaceInvitation.id })
        .from(workspaceInvitation)
        .where(
          and(
            eq(workspaceInvitation.workspaceId, actor.workspaceId),
            eq(workspaceInvitation.email, email),
            isNull(workspaceInvitation.acceptedAt),
            isNull(workspaceInvitation.revokedAt),
          ),
        )
        .limit(1);
      if (activeInvitation) {
        throw new DomainError(
          "conflict",
          "An active invitation already exists for this email",
        );
      }
      const [existingUser] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);
      if (existingUser) {
        const [existingMembership] = await tx
          .select({ workspaceId: workspaceMembership.workspaceId })
          .from(workspaceMembership)
          .where(
            and(
              eq(workspaceMembership.userId, existingUser.id),
              eq(workspaceMembership.workspaceId, actor.workspaceId),
            ),
          )
          .limit(1);
        if (existingMembership) {
          throw new DomainError(
            "conflict",
            "This person is already a workspace member",
          );
        }
      }
      const assigned = await tx
        .select({ id: project.id })
        .from(project)
        .where(
          and(
            eq(project.workspaceId, actor.workspaceId),
            inArray(project.id, projectIds),
          ),
        );
      if (assigned.length !== projectIds.length) {
        throw new DomainError("not_found", "Project not found");
      }
      const [row] = await tx
        .insert(workspaceInvitation)
        .values({
          id: randomUUID(),
          workspaceId: actor.workspaceId,
          email,
          role: "member",
          tokenHash: tokenHash(rawToken),
          createdByUserId: actor.userId,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) throw new Error("Invitation insert returned no row");
      await tx.insert(workspaceInvitationProject).values(
        projectIds.map((projectId) => ({
          invitationId: row.id,
          workspaceId: actor.workspaceId,
          projectId,
        })),
      );
      await tx.insert(workspaceInvitationEvent).values({
        id: randomUUID(),
        workspaceId: actor.workspaceId,
        invitationId: row.id,
        actorUserId: actor.userId,
        type: "invitation.created",
      });
      if (key) await queueInvitationMail(tx, row, rawToken, actor.userId, key);
      return row;
    });
    return { invitation: inviteSummary(created, projectIds), token: rawToken };
  }

  async resend(
    actor: InvitationActor,
    invitationId: string,
    mode: "manual" | "email" = "manual",
  ) {
    const key = this.emailKey(mode);
    const rawToken = invitationToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + invitationLifetimeMs);
    const updated = await this.db.transaction(async (tx) => {
      await lockOwner(tx, actor);
      const [row] = await tx
        .update(workspaceInvitation)
        .set({
          tokenHash: tokenHash(rawToken),
          expiresAt,
          updatedAt: now,
        })
        .where(
          and(
            eq(workspaceInvitation.id, invitationId),
            eq(workspaceInvitation.workspaceId, actor.workspaceId),
            isNull(workspaceInvitation.claimedAt),
            isNull(workspaceInvitation.acceptedAt),
            isNull(workspaceInvitation.revokedAt),
          ),
        )
        .returning();
      if (!row) {
        throw new DomainError(
          "conflict",
          "Only an unclaimed invitation can be resent",
        );
      }
      await tx.insert(workspaceInvitationEvent).values({
        id: randomUUID(),
        workspaceId: actor.workspaceId,
        invitationId,
        actorUserId: actor.userId,
        type: "invitation.resent",
      });
      await cancelInvitationMail(tx, invitationId);
      if (key) await queueInvitationMail(tx, row, rawToken, actor.userId, key);
      return row;
    });
    const projectIds =
      (await invitationProjects(this.db, [invitationId])).get(invitationId) ??
      [];
    return { invitation: inviteSummary(updated, projectIds), token: rawToken };
  }

  async revoke(actor: InvitationActor, invitationId: string) {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await lockOwner(tx, actor);
      const [row] = await tx
        .update(workspaceInvitation)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(workspaceInvitation.id, invitationId),
            eq(workspaceInvitation.workspaceId, actor.workspaceId),
            isNull(workspaceInvitation.acceptedAt),
            isNull(workspaceInvitation.revokedAt),
          ),
        )
        .returning();
      if (!row) throw new DomainError("not_found", "Invitation not found");
      if (row.provisionalSessionId) {
        await tx
          .delete(session)
          .where(eq(session.id, row.provisionalSessionId));
      }
      await tx.insert(workspaceInvitationEvent).values({
        id: randomUUID(),
        workspaceId: actor.workspaceId,
        invitationId,
        actorUserId: actor.userId,
        type: "invitation.revoked",
      });
      await cancelInvitationMail(tx, invitationId);
      return { revoked: true, invitationId };
    });
  }

  async updateMember(
    actor: InvitationActor,
    userId: string,
    raw: z.infer<typeof updateMemberSchema>,
  ) {
    const input = updateMemberSchema.parse(raw);
    const projectIds = input.grants.map((grant) => grant.projectId);
    if (new Set(projectIds).size !== projectIds.length)
      throw new DomainError("invalid", "Project assignments must be unique");
    return this.db.transaction(async (tx) => {
      await lockOwner(tx, actor);
      const [member] = await tx
        .select()
        .from(workspaceMembership)
        .where(
          and(
            eq(workspaceMembership.workspaceId, actor.workspaceId),
            eq(workspaceMembership.userId, userId),
          ),
        )
        .for("update");
      if (!member) throw new DomainError("not_found", "Member not found");
      if (member.role === "owner")
        throw new DomainError(
          "forbidden",
          "The owner always has access to all projects",
        );
      if (member.version !== input.expectedVersion)
        throw new DomainError(
          "conflict",
          "Member access changed. Reload and review the current permissions before saving.",
        );
      const projects = projectIds.length
        ? await tx
            .select({ id: project.id })
            .from(project)
            .where(
              and(
                eq(project.workspaceId, actor.workspaceId),
                inArray(project.id, projectIds),
              ),
            )
        : [];
      if (projects.length !== projectIds.length)
        throw new DomainError("not_found", "Project not found");
      const previous = await tx
        .select()
        .from(projectMembership)
        .where(
          and(
            eq(projectMembership.workspaceId, actor.workspaceId),
            eq(projectMembership.userId, userId),
          ),
        );
      const before = new Map(
        previous.map((grant) => [grant.projectId, grant.permission]),
      );
      const after = new Map(
        input.grants.map((grant) => [grant.projectId, grant.permission]),
      );
      const deltas = [...new Set([...before.keys(), ...after.keys()])].filter(
        (projectId) => before.get(projectId) !== after.get(projectId),
      );
      if (!deltas.length)
        return { updated: false, userId, version: member.version };
      for (const projectId of deltas) {
        const permission = after.get(projectId);
        const target = and(
          eq(projectMembership.workspaceId, actor.workspaceId),
          eq(projectMembership.userId, userId),
          eq(projectMembership.projectId, projectId),
        );
        if (!permission) await tx.delete(projectMembership).where(target);
        else if (before.has(projectId))
          await tx.update(projectMembership).set({ permission }).where(target);
        else
          await tx.insert(projectMembership).values({
            workspaceId: actor.workspaceId,
            userId,
            projectId,
            permission,
          });
      }
      await tx.insert(membershipEvent).values(
        deltas.map((projectId) => ({
          id: randomUUID(),
          workspaceId: actor.workspaceId,
          subjectUserId: userId,
          actorUserId: actor.userId,
          projectId,
          type: !after.has(projectId)
            ? "project.access_revoked"
            : !before.has(projectId)
              ? "project.access_granted"
              : "project.permission_changed",
          previousPermission: before.get(projectId) ?? null,
          nextPermission: after.get(projectId) ?? null,
        })),
      );
      const version = randomUUID();
      await tx
        .update(workspaceMembership)
        .set({ version, updatedAt: new Date() })
        .where(
          and(
            eq(workspaceMembership.workspaceId, actor.workspaceId),
            eq(workspaceMembership.userId, userId),
          ),
        );
      return { updated: true, userId, version };
    });
  }

  // HTTP always supplies expectedVersion. Trusted recovery tooling can omit it
  // only after its own explicit operator confirmation; owner is still rechecked.
  async removeMember(
    actor: InvitationActor,
    userId: string,
    expectedVersion?: string,
  ) {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await lockOwner(tx, actor);
      const [member] = await tx
        .select({
          role: workspaceMembership.role,
          version: workspaceMembership.version,
        })
        .from(workspaceMembership)
        .where(
          and(
            eq(workspaceMembership.workspaceId, actor.workspaceId),
            eq(workspaceMembership.userId, userId),
          ),
        )
        .limit(1)
        .for("update");
      if (!member) throw new DomainError("not_found", "Member not found");
      if (member.role === "owner") {
        throw new DomainError(
          "forbidden",
          "The workspace owner cannot be removed",
        );
      }
      if (expectedVersion !== undefined && member.version !== expectedVersion)
        throw new DomainError(
          "conflict",
          "Member access changed. Reload and review before removing access.",
        );
      const grants = await tx
        .select()
        .from(projectMembership)
        .where(
          and(
            eq(projectMembership.workspaceId, actor.workspaceId),
            eq(projectMembership.userId, userId),
          ),
        );
      if (grants.length)
        await tx.insert(membershipEvent).values(
          grants.map((grant) => ({
            id: randomUUID(),
            workspaceId: actor.workspaceId,
            subjectUserId: userId,
            actorUserId: actor.userId,
            projectId: grant.projectId,
            type: "project.access_revoked",
            previousPermission: grant.permission,
          })),
        );
      await tx.insert(membershipEvent).values({
        id: randomUUID(),
        workspaceId: actor.workspaceId,
        subjectUserId: userId,
        actorUserId: actor.userId,
        type: "membership.revoked",
        previousRole: "member",
      });
      // Global web sessions remain valid in the person's other workspaces.
      // Only installation grants bound to this membership are revoked.
      const clients = await tx
        .select({ clientId: oauthClient.clientId })
        .from(oauthClient)
        .where(
          and(
            eq(oauthClient.userId, userId),
            eq(oauthClient.referenceId, "issopen-chrome"),
            sql`${oauthClient.metadata}->>'workspaceId' = ${actor.workspaceId}`,
          ),
        );
      const clientIds = clients.map((entry) => entry.clientId);
      if (clientIds.length) {
        await tx
          .update(oauthAccessToken)
          .set({ revoked: now })
          .where(inArray(oauthAccessToken.clientId, clientIds));
        await tx
          .update(oauthRefreshToken)
          .set({ revoked: now })
          .where(inArray(oauthRefreshToken.clientId, clientIds));
        await tx
          .update(oauthClient)
          .set({ disabled: true, updatedAt: now })
          .where(inArray(oauthClient.clientId, clientIds));
      }
      await tx
        .delete(workspaceMembership)
        .where(
          and(
            eq(workspaceMembership.workspaceId, actor.workspaceId),
            eq(workspaceMembership.userId, userId),
          ),
        );
      return { removed: true, userId };
    });
  }
}

async function redeemInvitation(
  db: Database,
  rawToken: string,
  authenticatedUser: { id: string; email: string } | null,
) {
  const parsedToken = invitationTokenSchema.parse(rawToken);
  const hash = tokenHash(parsedToken);
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
        normalizedEmail(authenticatedUser.email) === invite.email
      ) {
        return {
          invitationId: invite.id,
          userId: authenticatedUser.id,
          email: authenticatedUser.email,
          provisional: false,
        };
      }
      throw new APIError("CONFLICT", {
        code: "INVITATION_USED",
        message: "This invitation has already been used",
      });
    }

    const [existingUser] = await tx
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.email, invite.email))
      .limit(1);
    let targetUser = existingUser;
    let provisional = false;
    if (existingUser) {
      if (!authenticatedUser) {
        throw new APIError("CONFLICT", {
          code: "EXISTING_ACCOUNT_REQUIRES_SIGN_IN",
          message: "Sign in to the existing Issopen account before continuing",
        });
      }
      if (
        authenticatedUser.id !== existingUser.id ||
        normalizedEmail(authenticatedUser.email) !== invite.email
      ) {
        throw new APIError("FORBIDDEN", {
          code: "INVITATION_EMAIL_MISMATCH",
          message: "The signed-in account does not match this invitation",
        });
      }
    } else {
      if (
        authenticatedUser &&
        normalizedEmail(authenticatedUser.email) !== invite.email
      ) {
        throw new APIError("FORBIDDEN", {
          code: "INVITATION_EMAIL_MISMATCH",
          message: "The signed-in account does not match this invitation",
        });
      }
      const createdId = randomUUID();
      const [created] = await tx
        .insert(user)
        .values({
          id: createdId,
          email: invite.email,
          emailVerified: false,
          name: invite.email.split("@")[0] || "Invited member",
        })
        .returning({ id: user.id, email: user.email });
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
    };
  });
}

async function acceptInvitation(
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
      normalizedEmail(authenticatedUser.email) !== invite.email ||
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
      .set({
        acceptedAt: now,
        provisionalSessionId: null,
        updatedAt: now,
      })
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
