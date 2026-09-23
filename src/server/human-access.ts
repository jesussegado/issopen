import { and, asc, eq } from "drizzle-orm";
import type { OwnerSession } from "./auth.js";
import type { Database } from "./db/client.js";
import {
  projectMembership,
  workspace,
  workspaceMembership,
  type workspaceRoleValues,
} from "./db/schema.js";
import type { MutationContext } from "./domain/contracts.js";
import { DomainError } from "./domain/errors.js";

export type WorkspaceRole = (typeof workspaceRoleValues)[number];
export type HumanIdentity = Pick<OwnerSession["user"], "id" | "name" | "email">;

export type HumanAccess = {
  workspaceId: string;
  workspaceName: string;
  workspaceVersion: number;
  role: WorkspaceRole;
  projectIds: string[] | null;
  editableProjectIds: string[] | null;
  user: HumanIdentity;
};

export async function resolveHumanAccess(
  db: Database,
  user: HumanIdentity,
  workspaceId?: string,
): Promise<HumanAccess | null> {
  const memberships = await listHumanWorkspaces(db, user.id);
  // An unspecified context is only unambiguous for a single membership.
  const membership =
    workspaceId === undefined
      ? memberships.length === 1
        ? memberships[0]
        : undefined
      : memberships.find((entry) => entry.workspaceId === workspaceId);
  if (!membership) {
    if (workspaceId !== undefined)
      throw new DomainError("not_found", "Workspace not found");
    return null;
  }
  if (membership.role === "owner" && membership.workspaceOwnerId !== user.id) {
    throw new DomainError("forbidden", "Invalid workspace ownership");
  }

  const projectGrants =
    membership.role === "owner"
      ? null
      : await db
          .select({
            projectId: projectMembership.projectId,
            permission: projectMembership.permission,
          })
          .from(projectMembership)
          .where(
            and(
              eq(projectMembership.workspaceId, membership.workspaceId),
              eq(projectMembership.userId, user.id),
            ),
          )
          .orderBy(asc(projectMembership.projectId));
  return {
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspaceName,
    workspaceVersion: membership.workspaceVersion,
    role: membership.role,
    projectIds: projectGrants?.map((entry) => entry.projectId) ?? null,
    editableProjectIds:
      projectGrants
        ?.filter((entry) => entry.permission === "edit")
        .map((entry) => entry.projectId) ?? null,
    user,
  };
}

export async function listHumanWorkspaces(db: Database, userId: string) {
  const memberships = await db
    .select({
      workspaceId: workspaceMembership.workspaceId,
      workspaceName: workspace.name,
      workspaceVersion: workspace.version,
      workspaceOwnerId: workspace.ownerId,
      role: workspaceMembership.role,
    })
    .from(workspaceMembership)
    .innerJoin(workspace, eq(workspace.id, workspaceMembership.workspaceId))
    .where(eq(workspaceMembership.userId, userId))
    .orderBy(
      asc(workspaceMembership.createdAt),
      asc(workspaceMembership.workspaceId),
    );

  return memberships;
}

export function requireHumanAccess(access: HumanAccess | null): HumanAccess {
  if (!access) throw new DomainError("not_found", "Workspace not found");
  return access;
}

export function requireWorkspaceOwner(access: HumanAccess): void {
  if (access.role !== "owner") {
    throw new DomainError(
      "forbidden",
      "Only a workspace owner can perform this action",
    );
  }
}

export function canAccessProject(
  access: HumanAccess,
  projectId: string,
): boolean {
  return access.projectIds === null || access.projectIds.includes(projectId);
}

export function requireProjectAccess(
  access: HumanAccess,
  projectId: string,
): void {
  if (!canAccessProject(access, projectId)) {
    // Hide whether another workspace/project contains the identifier.
    throw new DomainError("not_found", "Project not found");
  }
}

export function humanMutationContext(access: HumanAccess): MutationContext {
  return {
    workspaceId: access.workspaceId,
    actor: {
      type: "human",
      id: access.user.id,
      displayName: access.user.name,
    },
    source: "rest",
  };
}

export function canEditProject(
  access: HumanAccess,
  projectId: string,
): boolean {
  return (
    canAccessProject(access, projectId) &&
    (access.role === "owner" ||
      access.editableProjectIds?.includes(projectId) === true)
  );
}

export function requireProjectEdit(
  access: HumanAccess,
  projectId: string,
): void {
  requireProjectAccess(access, projectId);
  if (!canEditProject(access, projectId))
    throw new DomainError(
      "forbidden",
      "This project is read-only. Ask the workspace owner for edit access.",
    );
}
