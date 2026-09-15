import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { type AuditPage, auditActions } from "../shared/audit-contract.js";
import type { Database } from "./db/client.js";
import { workspace } from "./db/schema.js";
import { DomainError } from "./domain/errors.js";
import {
  type HumanAccess,
  requireHumanAccess,
  requireWorkspaceOwner,
  resolveHumanAccess,
} from "./human-access.js";

const querySchema = z
  .object({
    person: z.string().trim().max(120).default(""),
    action: z
      .string()
      .max(64)
      .default("")
      .refine((v) => v === "" || Object.hasOwn(auditActions, v)),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).max(2048).optional(),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to);
const cursorSchema = z
  .object({
    workspace: z.uuid(),
    filters: z.string().length(64),
    at: z.iso.datetime(),
    source: z.enum(["membership", "invitation", "ownership"]),
    id: z.uuid(),
  })
  .strict();
type Row = {
  id: string;
  source: "membership" | "invitation" | "ownership";
  type: string;
  at: string;
  actor_id: string | null;
  actor_name: string | null;
  subject_id: string | null;
  subject_name: string | null;
  subject_kind: "user" | "invitation";
  project_id: string | null;
  before_role: string | null;
  after_role: string | null;
  before_permission: string | null;
  after_permission: string | null;
  old_owner: string | null;
  new_owner: string | null;
  former_role: string | null;
  retained_count: number | null;
  credential: string | null;
  web_sessions: string | null;
};

export class AccessAuditService {
  constructor(private readonly db: Database) {}
  async list(access: HumanAccess, raw: unknown): Promise<AuditPage> {
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success)
      throw new DomainError(
        "invalid",
        "Invalid audit filters. Use valid dates and a limit of 1–50.",
      );
    const q = parsed.data;
    const filters = createHash("sha256")
      .update(
        JSON.stringify([q.person, q.action, q.from ?? null, q.to ?? null]),
      )
      .digest("hex");
    let after: z.infer<typeof cursorSchema> | undefined;
    if (q.cursor) {
      try {
        after = cursorSchema.parse(
          JSON.parse(Buffer.from(q.cursor, "base64url").toString("utf8")),
        );
        if (after.workspace !== access.workspaceId || after.filters !== filters)
          throw Error("scope");
      } catch {
        throw new DomainError(
          "invalid",
          "This audit cursor belongs to different filters or workspace. Refresh the audit.",
        );
      }
    }
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.id, access.workspaceId))
        .for("share");
      requireWorkspaceOwner(
        requireHumanAccess(
          await resolveHumanAccess(tx, access.user, access.workspaceId),
        ),
      );
      const person = `%${q.person.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
      const rows = await tx.execute<Row>(sql`
        with events as (
          select m.id,'membership'::text as source,m.type,m.created_at,m.actor_user_id as actor_id,m.actor_name,
            m.subject_user_id as subject_id,m.subject_name,'user'::text as subject_kind,
            case when exists (select 1 from project p where p.id=m.project_id and p.workspace_id=m.workspace_id) then m.project_id else null end as project_id,
            m.previous_role::text as before_role,m.next_role::text as after_role,
            m.previous_permission::text as before_permission,m.next_permission::text as after_permission,
            null::text as old_owner,null::text as new_owner,null::text as former_role,null::int as retained_count,null::text as credential,null::text as web_sessions
          from membership_event m where m.workspace_id=${access.workspaceId}
          union all
          select i.id,'invitation',i.type,i.created_at,i.actor_user_id,i.actor_name,
            coalesce(i.subject_user_id,i.invitation_id),i.subject_name,case when i.subject_user_id is null then 'invitation' else 'user' end,
            null,null,null,null,null,null,null,null,null,null,null
          from workspace_invitation_event i where i.workspace_id=${access.workspaceId}
          union all
          select o.id,'ownership',o.type,o.created_at,o.actor_user_id,o.actor_name,
            coalesce(o.changes->'to'->>'id',o.changes->'subject'->>'id'),left(coalesce(o.changes->'to'->>'name',o.changes->'subject'->>'name'),120),'user',
            null,null,null,null,null,left(o.changes->'from'->>'name',120),left(o.changes->'to'->>'name',120),
            case when o.changes->>'formerOwnerRole'='member' then 'member' end,
            case when jsonb_typeof(o.changes->'retainedEditProjectIds')='array' then jsonb_array_length(o.changes->'retainedEditProjectIds') end,
            case when o.changes->>'credential' in ('rotated','created') then o.changes->>'credential' end,
            case when o.changes->>'webSessions'='all_for_identity_revoked' then 'all_for_identity_revoked' end
          from ownership_event o where o.workspace_id=${access.workspaceId}
        ) select *, to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at from events
        where ${q.action ? sql`type=${q.action}` : sql`true`}
          and ${q.person ? sql`(actor_id ilike ${person} or actor_name ilike ${person} or subject_id ilike ${person} or subject_name ilike ${person})` : sql`true`}
          and ${q.from ? sql`created_at >= ${`${q.from}T00:00:00Z`}::timestamptz` : sql`true`}
          and ${q.to ? sql`created_at < ${`${q.to}T00:00:00Z`}::timestamptz + interval '1 day'` : sql`true`}
          and ${after ? sql`(created_at,source,id) < (${after.at}::timestamptz,${after.source},${after.id})` : sql`true`}
        order by created_at desc,source desc,id desc limit ${q.limit + 1}
      `);
      const page = rows.slice(0, q.limit),
        last = page.at(-1);
      return {
        events: page.map((r) => ({
          id: r.id,
          source: r.source,
          type: r.type,
          createdAt: r.at,
          actor: { id: r.actor_id, name: r.actor_name },
          subject: {
            id: r.subject_id,
            name: r.subject_name,
            kind: r.subject_kind,
          },
          projectId: r.project_id,
          changes: {
            previousRole: r.before_role,
            nextRole: r.after_role,
            previousPermission: r.before_permission,
            nextPermission: r.after_permission,
            previousOwner: r.old_owner,
            currentOwner: r.new_owner,
            formerOwnerRole: r.former_role,
            retainedProjectCount: r.retained_count,
            credential: r.credential,
            webSessions: r.web_sessions,
          },
        })),
        nextCursor:
          rows.length > q.limit && last
            ? Buffer.from(
                JSON.stringify({
                  workspace: access.workspaceId,
                  filters,
                  at: last.at,
                  source: last.source,
                  id: last.id,
                }),
              ).toString("base64url")
            : null,
      };
    });
  }
}
