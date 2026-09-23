import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Database } from "../db/client.js";
import {
  membershipEvent,
  oauthAccessToken,
  oauthClient,
  oauthRefreshToken,
  project,
  projectMembership,
  workspaceMembership,
} from "../db/schema.js";
import { DomainError } from "../domain/errors.js";
import { type InvitationActor, updateMemberSchema } from "./contracts.js";
import { lockOwner } from "./owner-access.js";

export class MemberAccessService {
  constructor(private readonly db: Database) {}

  async update(
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
  async remove(
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
