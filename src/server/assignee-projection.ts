import { eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { issue } from "./db/schema.js";

// Correlated to each issue; no directory or identity enumeration outside its project.
export const assigneeHasAccess = sql<boolean>`exists (
  select 1 from workspace_membership m
  join workspace w on w.id = m.workspace_id
  where m.workspace_id = ${issue.workspaceId} and m.user_id = ${issue.humanAssigneeId}
  and ((m.role = 'owner' and w.owner_id = m.user_id) or
    (m.role = 'member' and exists (select 1 from project_membership p
      where p.workspace_id = m.workspace_id and p.project_id = ${issue.projectId}
      and p.user_id = m.user_id))))`;

export const assigneeColumns = {
  humanAssigneeId: issue.humanAssigneeId,
  // Removed collaborators retain the name recorded at assignment, not future profile edits.
  humanAssigneeName: sql<string | null>`case when ${assigneeHasAccess}
    then coalesce((select u.name from "user" u where u.id = ${issue.humanAssigneeId}), ${issue.humanAssigneeName})
    else ${issue.humanAssigneeName} end`,
  humanAssigneeHasAccess: assigneeHasAccess,
};

export const assigneeFilterSchema = z.union([
  z.literal("unassigned"),
  z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
]);
export function assigneePredicate(value?: string) {
  return value === "unassigned"
    ? isNull(issue.humanAssigneeId)
    : value
      ? eq(issue.humanAssigneeId, value)
      : undefined;
}
