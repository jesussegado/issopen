import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "../db/client.js";
import {
  project,
  projectMembership,
  session,
  user,
  workspace,
  workspaceInvitation,
  workspaceInvitationEvent,
  workspaceInvitationProject,
  workspaceMembership,
} from "../db/schema.js";
import { DomainError } from "../domain/errors.js";
import {
  cancelInvitationMail,
  invitationMailSummaries,
  queueInvitationMail,
} from "../invitation-mail.js";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationLifetimeMs,
  invitationState,
  invitationTokenSchema,
  maskInvitationEmail,
  normalizeInvitationEmail,
} from "../invitation-primitives.js";
import type { MailConfig } from "../mail-config.js";
import type { createInvitationSchema, InvitationActor } from "./contracts.js";
import { lockOwner, requireCurrentOwner } from "./owner-access.js";

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

export class InvitationLifecycleService {
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
      .where(
        eq(workspaceInvitation.tokenHash, hashInvitationToken(parsed.data)),
      )
      .limit(1);
    if (!row) return null;
    return {
      id: row.invitation.id,
      workspaceName: row.workspaceName,
      email: maskInvitationEmail(row.invitation.email),
      state: invitationState(row.invitation),
      expiresAt: row.invitation.expiresAt,
    };
  }

  async list(actor: InvitationActor) {
    return this.db.transaction(
      (tx) => new InvitationLifecycleService(tx, this.mail).listSnapshot(actor),
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
    const email = normalizeInvitationEmail(input.email);
    const projectIds = [...new Set(input.projectIds)];
    if (projectIds.length !== input.projectIds.length)
      throw new DomainError("invalid", "Project assignments must be unique");
    const rawToken = createInvitationToken();
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
      if (activeInvitation)
        throw new DomainError(
          "conflict",
          "An active invitation already exists for this email",
        );
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
        if (existingMembership)
          throw new DomainError(
            "conflict",
            "This person is already a workspace member",
          );
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
      if (assigned.length !== projectIds.length)
        throw new DomainError("not_found", "Project not found");
      const [row] = await tx
        .insert(workspaceInvitation)
        .values({
          id: randomUUID(),
          workspaceId: actor.workspaceId,
          email,
          role: "member",
          tokenHash: hashInvitationToken(rawToken),
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
    const rawToken = createInvitationToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + invitationLifetimeMs);
    const updated = await this.db.transaction(async (tx) => {
      await lockOwner(tx, actor);
      const [row] = await tx
        .update(workspaceInvitation)
        .set({
          tokenHash: hashInvitationToken(rawToken),
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
      if (!row)
        throw new DomainError(
          "conflict",
          "Only an unclaimed invitation can be resent",
        );
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
      if (row.provisionalSessionId)
        await tx
          .delete(session)
          .where(eq(session.id, row.provisionalSessionId));
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
}
