import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { workspace, workspaceMembership } from "../db/schema.js";
import { DomainError } from "../domain/errors.js";
import type { InvitationActor } from "./contracts.js";

export async function requireCurrentOwner(
  db: Database,
  actor: InvitationActor,
) {
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

export async function lockOwner(db: Database, actor: InvitationActor) {
  const [row] = await db
    .select({ ownerId: workspace.ownerId })
    .from(workspace)
    .where(eq(workspace.id, actor.workspaceId))
    .for("update");
  if (!row || row.ownerId !== actor.userId)
    throw new DomainError("forbidden", "Workspace owner required");
  await requireCurrentOwner(db, actor);
}
