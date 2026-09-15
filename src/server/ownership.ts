import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, ilike, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { OwnerSession } from "./auth.js";
import {
  assuranceLifetimeMs,
  requireRecentAuthentication,
} from "./auth-assurance.js";
import type { Database } from "./db/client.js";
import {
  issue,
  ownershipEvent,
  ownershipTransfer,
  project,
  projectMembership,
  user,
  workspace,
  workspaceMembership,
} from "./db/schema.js";
import { DomainError } from "./domain/errors.js";
import {
  type HumanAccess,
  requireHumanAccess,
  requireWorkspaceOwner,
  resolveHumanAccess,
} from "./human-access.js";

export const ownershipStartSchema = z
  .object({
    recipientId: z.string().min(1).max(128),
    recipientMembershipVersion: z.uuid(),
    expectedWorkspaceVersion: z.number().int().positive(),
    confirmation: z.string().max(120),
    clientRequestId: z.uuid(),
  })
  .strict();
export const ownershipFinishSchema = z
  .object({ expectedVersion: z.uuid(), confirmation: z.string().max(120) })
  .strict();
export const ownershipCancelSchema = z
  .object({ expectedVersion: z.uuid() })
  .strict();
export const ownershipPeopleSchema = z
  .object({
    q: z.string().max(80).default(""),
    after: z.string().min(1).max(128).optional(),
  })
  .strict();
function publicTransfer(t: typeof ownershipTransfer.$inferSelect) {
  return {
    id: t.id,
    fromUserId: t.fromUserId,
    toUserId: t.toUserId,
    fromName: t.fromName,
    toName: t.toName,
    version: t.version,
    status:
      t.status === "pending" && t.expiresAt <= new Date()
        ? "expired"
        : t.status,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    completedAt: t.completedAt,
  };
}
async function targetMember(db: Database, workspaceId: string, id: string) {
  const [target] = await db
    .select({
      id: user.id,
      name: user.name,
      verified: user.emailVerified,
      membershipVersion: workspaceMembership.version,
    })
    .from(workspaceMembership)
    .innerJoin(user, eq(user.id, workspaceMembership.userId))
    .where(
      and(
        eq(workspaceMembership.workspaceId, workspaceId),
        eq(workspaceMembership.userId, id),
        eq(workspaceMembership.role, "member"),
      ),
    );
  if (!target?.verified)
    throw new DomainError(
      "invalid",
      "Choose a verified Member of this workspace.",
    );
  const [owned] = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerId, id));
  if (owned)
    throw new DomainError(
      "conflict",
      "This person already owns a workspace. This version supports one owned workspace per person.",
    );
  return target;
}
function uniqueFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && error.code === "23505") ||
      ("cause" in error && uniqueFailure(error.cause)))
  );
}

export class OwnershipService {
  constructor(private readonly db: Database) {}
  private async locked<T>(
    access: HumanAccess,
    fn: (tx: Database, current: HumanAccess) => Promise<T>,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        await tx
          .select({ id: workspace.id })
          .from(workspace)
          .where(eq(workspace.id, access.workspaceId))
          .for("update");
        const fresh = requireHumanAccess(
          await resolveHumanAccess(tx, access.user, access.workspaceId),
        );
        return fn(tx, fresh);
      });
    } catch (error) {
      if (uniqueFailure(error))
        throw new DomainError(
          "conflict",
          "Ownership changed concurrently. Refresh and review before trying again.",
        );
      throw error;
    }
  }
  async snapshot(access: HumanAccess, currentSession: OwnerSession) {
    return this.locked(access, async (db, fresh) => {
      let freshUntil: Date | null = null;
      try {
        freshUntil = new Date(
          (
            await requireRecentAuthentication(
              db,
              currentSession.session.id,
              fresh.user.id,
            )
          ).getTime() + assuranceLifetimeMs,
        );
      } catch (error) {
        if (!(error instanceof DomainError && error.code === "forbidden"))
          throw error;
      }
      const transfers = await db
        .select()
        .from(ownershipTransfer)
        .where(
          and(
            eq(ownershipTransfer.workspaceId, fresh.workspaceId),
            fresh.role === "owner"
              ? undefined
              : or(
                  eq(ownershipTransfer.toUserId, fresh.user.id),
                  eq(ownershipTransfer.fromUserId, fresh.user.id),
                ),
          ),
        )
        .orderBy(desc(ownershipTransfer.createdAt), desc(ownershipTransfer.id))
        .limit(20);
      return {
        workspaceName: fresh.workspaceName,
        workspaceVersion: fresh.workspaceVersion,
        canPropose: fresh.role === "owner",
        userId: fresh.user.id,
        freshUntil,
        transfers: transfers.map(publicTransfer),
      };
    });
  }
  async people(
    access: HumanAccess,
    input: z.infer<typeof ownershipPeopleSchema>,
  ) {
    return this.locked(access, async (db, fresh) => {
      requireWorkspaceOwner(fresh);
      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          membershipVersion: workspaceMembership.version,
          verified: user.emailVerified,
          ownsWorkspace: sql<boolean>`exists (select 1 from workspace owned where owned.owner_id = "user"."id")`,
        })
        .from(workspaceMembership)
        .innerJoin(user, eq(user.id, workspaceMembership.userId))
        .where(
          and(
            eq(workspaceMembership.workspaceId, fresh.workspaceId),
            eq(workspaceMembership.role, "member"),
            ilike(
              user.name,
              `%${input.q.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
            ),
            input.after ? gt(user.id, input.after) : undefined,
          ),
        )
        .orderBy(asc(user.id))
        .limit(21);
      const page = rows.slice(0, 20);
      return {
        people: page.map((p) => ({
          id: p.id,
          name: p.name,
          membershipVersion: p.membershipVersion,
          eligible: p.verified && !p.ownsWorkspace,
          reason: !p.verified
            ? "Email not verified"
            : p.ownsWorkspace
              ? "Already owns a workspace"
              : null,
        })),
        nextAfter: rows.length > 20 ? (page.at(-1)?.id ?? null) : null,
      };
    });
  }
  async propose(
    access: HumanAccess,
    currentSession: OwnerSession,
    input: z.infer<typeof ownershipStartSchema>,
  ) {
    return this.locked(access, async (db, fresh) => {
      requireWorkspaceOwner(fresh);
      const authenticatedAt = await requireRecentAuthentication(
        db,
        currentSession.session.id,
        fresh.user.id,
      );
      if (input.confirmation !== fresh.workspaceName)
        throw new DomainError(
          "invalid",
          "Type the exact workspace name to confirm the proposal.",
        );
      const [previous] = await db
        .select()
        .from(ownershipTransfer)
        .where(
          and(
            eq(ownershipTransfer.workspaceId, fresh.workspaceId),
            eq(ownershipTransfer.fromUserId, fresh.user.id),
            eq(ownershipTransfer.requestId, input.clientRequestId),
          ),
        );
      if (previous) {
        if (
          previous.toUserId !== input.recipientId ||
          previous.recipientMembershipVersion !==
            input.recipientMembershipVersion ||
          previous.workspaceVersion !== input.expectedWorkspaceVersion
        )
          throw new DomainError(
            "conflict",
            "This retry identifier belongs to a different proposal.",
          );
        return publicTransfer(previous);
      }
      if (fresh.workspaceVersion !== input.expectedWorkspaceVersion)
        throw new DomainError(
          "conflict",
          "Workspace changed. Refresh and review the current owner before proposing.",
        );
      const [pending] = await db
        .select({ id: ownershipTransfer.id })
        .from(ownershipTransfer)
        .where(
          and(
            eq(ownershipTransfer.workspaceId, fresh.workspaceId),
            eq(ownershipTransfer.status, "pending"),
            gt(ownershipTransfer.expiresAt, new Date()),
          ),
        );
      if (pending)
        throw new DomainError(
          "conflict",
          "A transfer is already pending. Review or cancel it before starting another.",
        );
      const target = await targetMember(
        db,
        fresh.workspaceId,
        input.recipientId,
      );
      if (target.membershipVersion !== input.recipientMembershipVersion)
        throw new DomainError(
          "conflict",
          "Recipient access changed. Search again and review the new membership.",
        );
      const [created] = await db
        .insert(ownershipTransfer)
        .values({
          id: randomUUID(),
          workspaceId: fresh.workspaceId,
          fromUserId: fresh.user.id,
          toUserId: target.id,
          fromName: fresh.user.name.slice(0, 120),
          toName: target.name.slice(0, 120),
          fromSessionId: currentSession.session.id,
          workspaceVersion: fresh.workspaceVersion,
          recipientMembershipVersion: target.membershipVersion,
          requestId: input.clientRequestId,
          expiresAt: new Date(authenticatedAt.getTime() + assuranceLifetimeMs),
        })
        .returning();
      if (!created) throw Error("Ownership proposal insert failed");
      await db.insert(ownershipEvent).values({
        id: randomUUID(),
        workspaceId: fresh.workspaceId,
        transferId: created.id,
        actorUserId: fresh.user.id,
        actorName: fresh.user.name.slice(0, 120),
        type: "ownership.proposed",
        changes: {
          from: { id: created.fromUserId, name: created.fromName },
          to: { id: created.toUserId, name: created.toName },
        },
      });
      return publicTransfer(created);
    });
  }
  async cancel(
    access: HumanAccess,
    id: string,
    input: z.infer<typeof ownershipCancelSchema>,
  ) {
    return this.locked(access, async (db, fresh) => {
      const [t] = await db
        .select()
        .from(ownershipTransfer)
        .where(
          and(
            eq(ownershipTransfer.id, id),
            eq(ownershipTransfer.workspaceId, fresh.workspaceId),
          ),
        )
        .for("update");
      if (
        !t ||
        (fresh.role !== "owner" &&
          t.toUserId !== fresh.user.id &&
          t.fromUserId !== fresh.user.id)
      )
        throw new DomainError("not_found", "Transfer not found");
      if (t.status === "cancelled") return publicTransfer(t);
      if (t.status !== "pending" || t.version !== input.expectedVersion)
        throw new DomainError(
          "conflict",
          "Transfer changed. Refresh before cancelling.",
        );
      const [updated] = await db
        .update(ownershipTransfer)
        .set({
          status: "cancelled",
          version: randomUUID(),
          completedAt: new Date(),
        })
        .where(eq(ownershipTransfer.id, id))
        .returning();
      await db.insert(ownershipEvent).values({
        id: randomUUID(),
        workspaceId: fresh.workspaceId,
        transferId: id,
        actorUserId: fresh.user.id,
        actorName: fresh.user.name.slice(0, 120),
        type: "ownership.cancelled",
        changes: {
          from: { id: t.fromUserId, name: t.fromName },
          to: { id: t.toUserId, name: t.toName },
        },
      });
      if (!updated) throw Error("Ownership cancellation failed");
      return publicTransfer(updated);
    });
  }
  async accept(
    access: HumanAccess,
    currentSession: OwnerSession,
    id: string,
    input: z.infer<typeof ownershipFinishSchema>,
  ) {
    return this.locked(access, async (db, fresh) => {
      const [t] = await db
        .select()
        .from(ownershipTransfer)
        .where(
          and(
            eq(ownershipTransfer.id, id),
            eq(ownershipTransfer.workspaceId, fresh.workspaceId),
          ),
        );
      if (!t || t.toUserId !== fresh.user.id)
        throw new DomainError("not_found", "Transfer not found");
      if (
        t.status !== "pending" ||
        t.version !== input.expectedVersion ||
        t.expiresAt <= new Date()
      )
        throw new DomainError(
          "conflict",
          "This transfer changed, expired or was already completed. Refresh its status.",
        );
      await requireRecentAuthentication(
        db,
        currentSession.session.id,
        fresh.user.id,
      );
      if (!t.fromSessionId)
        throw new DomainError(
          "conflict",
          "The proposing Owner signed out. Ask them to sign in and create a new proposal.",
        );
      await requireRecentAuthentication(db, t.fromSessionId, t.fromUserId);
      const [canonical] = await db
        .select()
        .from(workspace)
        .where(eq(workspace.id, fresh.workspaceId));
      if (
        !canonical ||
        canonical.ownerId !== t.fromUserId ||
        canonical.version !== t.workspaceVersion
      )
        throw new DomainError(
          "conflict",
          "Workspace ownership changed. Ask the current Owner for a new proposal.",
        );
      if (input.confirmation !== canonical.name)
        throw new DomainError(
          "invalid",
          "Type the exact workspace name to accept ownership.",
        );
      await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, t.toUserId))
        .for("update");
      const target = await targetMember(db, fresh.workspaceId, t.toUserId);
      if (target.membershipVersion !== t.recipientMembershipVersion)
        throw new DomainError(
          "conflict",
          "Your membership changed since the proposal. Ask the Owner to propose again.",
        );
      const [former] = await db
        .select()
        .from(workspaceMembership)
        .where(
          and(
            eq(workspaceMembership.workspaceId, fresh.workspaceId),
            eq(workspaceMembership.userId, t.fromUserId),
            eq(workspaceMembership.role, "owner"),
          ),
        )
        .for("update");
      if (!former)
        throw new DomainError(
          "conflict",
          "Current Owner membership needs operator reconciliation.",
        );
      const projects = await db
        .select({ id: project.id })
        .from(project)
        .where(eq(project.workspaceId, fresh.workspaceId));
      for (const p of projects)
        await db
          .insert(projectMembership)
          .values({
            workspaceId: fresh.workspaceId,
            projectId: p.id,
            userId: t.fromUserId,
            permission: "edit",
          })
          .onConflictDoUpdate({
            target: [projectMembership.projectId, projectMembership.userId],
            set: { permission: "edit" },
          });
      await db
        .update(workspaceMembership)
        .set({ role: "member", version: randomUUID(), updatedAt: new Date() })
        .where(
          and(
            eq(workspaceMembership.workspaceId, fresh.workspaceId),
            eq(workspaceMembership.userId, t.fromUserId),
          ),
        );
      await db
        .update(workspaceMembership)
        .set({ role: "owner", version: randomUUID(), updatedAt: new Date() })
        .where(
          and(
            eq(workspaceMembership.workspaceId, fresh.workspaceId),
            eq(workspaceMembership.userId, t.toUserId),
          ),
        );
      await db
        .update(workspace)
        .set({
          ownerId: t.toUserId,
          version: sql`${workspace.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(workspace.id, fresh.workspaceId));
      const changedIssues = await db
        .update(issue)
        .set({
          humanOwnerId: t.toUserId,
          version: sql`${issue.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(issue.workspaceId, fresh.workspaceId),
            ne(issue.humanOwnerId, t.toUserId),
          ),
        )
        .returning({ id: issue.id });
      const [updated] = await db
        .update(ownershipTransfer)
        .set({
          status: "accepted",
          version: randomUUID(),
          completedAt: new Date(),
        })
        .where(eq(ownershipTransfer.id, id))
        .returning();
      await db.insert(ownershipEvent).values({
        id: randomUUID(),
        workspaceId: fresh.workspaceId,
        transferId: id,
        actorUserId: fresh.user.id,
        actorName: fresh.user.name.slice(0, 120),
        type: "ownership.transferred",
        changes: {
          from: { id: t.fromUserId, name: t.fromName, role: "owner" },
          to: { id: t.toUserId, name: t.toName, role: "owner" },
          formerOwnerRole: "member",
          retainedEditProjectIds: projects.map((p) => p.id),
          reconciledIssues: changedIssues.length,
        },
      });
      if (!updated) throw Error("Ownership acceptance failed");
      return publicTransfer(updated);
    });
  }
}
