import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { session, user } from "./identity.js";

export const instanceOwner = pgTable(
  "instance_owner",
  {
    singletonSlot: smallint("singleton_slot").primaryKey().default(1),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "instance_owner_singleton_slot_check",
      sql`${table.singletonSlot} = 1`,
    ),
  ],
);

export const workspace = pgTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("workspace_owner_id_idx").on(table.ownerId)],
);

// The singleton instance operator can invite another verified person to own a
// new, isolated workspace. The raw bearer token is never stored.
export const ownerWorkspaceInvitation = pgTable(
  "owner_workspace_invitation",
  {
    id: text("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    workspaceName: varchar("workspace_name", { length: 120 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    claimedByUserId: text("claimed_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    provisionalSessionId: text("provisional_session_id").references(
      () => session.id,
      { onDelete: "set null" },
    ),
    createdWorkspaceId: text("created_workspace_id")
      .unique()
      .references(() => workspace.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("owner_workspace_invitation_active_email_uidx")
      .on(table.email)
      .where(sql`${table.acceptedAt} IS NULL AND ${table.revokedAt} IS NULL`),
    index("owner_workspace_invitation_created_idx").on(table.createdAt),
    index("owner_workspace_invitation_expiry_idx").on(table.expiresAt),
    index("owner_workspace_invitation_claimed_user_idx").on(
      table.claimedByUserId,
    ),
    index("owner_workspace_invitation_provisional_session_idx").on(
      table.provisionalSessionId,
    ),
    check(
      "owner_workspace_invitation_token_hash_check",
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const ownerWorkspaceInvitationEvent = pgTable(
  "owner_workspace_invitation_event",
  {
    id: text("id").primaryKey(),
    invitationId: text("invitation_id")
      .notNull()
      .references(() => ownerWorkspaceInvitation.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    type: varchar("type", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("owner_workspace_invitation_event_created_idx").on(
      table.invitationId,
      table.createdAt,
    ),
  ],
);

export const ownershipTransfer = pgTable(
  "ownership_transfer",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    fromName: varchar("from_name", { length: 120 }).notNull(),
    fromSessionId: text("from_session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    toName: varchar("to_name", { length: 120 }).notNull(),
    workspaceVersion: integer("workspace_version").notNull(),
    recipientMembershipVersion: text("recipient_membership_version").notNull(),
    version: text("version").notNull().default(sql`gen_random_uuid()::text`),
    requestId: text("request_id").notNull(),
    status: varchar("status", { length: 16 })
      .$type<"pending" | "accepted" | "cancelled">()
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("ownership_transfer_request_idx").on(
      table.workspaceId,
      table.fromUserId,
      table.requestId,
    ),
    index("ownership_transfer_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    check(
      "ownership_transfer_status_check",
      sql`${table.status} in ('pending','accepted','cancelled')`,
    ),
    check(
      "ownership_transfer_distinct_people_check",
      sql`${table.fromUserId} <> ${table.toUserId}`,
    ),
  ],
);

export const ownershipEvent = pgTable(
  "ownership_event",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    transferId: text("transfer_id").references(() => ownershipTransfer.id, {
      onDelete: "restrict",
    }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    actorName: varchar("actor_name", { length: 120 }).notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    changes: jsonb("changes").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ownership_event_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const workspaceRoleValues = ["owner", "member"] as const;
export const workspaceRole = pgEnum("workspace_role", workspaceRoleValues);

export const workspaceMembership = pgTable(
  "workspace_membership",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull(),
    // Opaque compare-and-swap token also changes after removal/reinvitation.
    version: text("version").default(sql`gen_random_uuid()::text`).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index("workspace_membership_user_idx").on(table.userId),
    index("workspace_membership_workspace_role_idx").on(
      table.workspaceId,
      table.role,
    ),
  ],
);

export const workspaceInvitation = pgTable(
  "workspace_invitation",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    email: varchar("email", { length: 320 }).notNull(),
    role: workspaceRole("role").default("member").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    claimedByUserId: text("claimed_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    provisionalSessionId: text("provisional_session_id").references(
      () => session.id,
      { onDelete: "set null" },
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("workspace_invitation_id_workspace_uidx").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("workspace_invitation_active_email_uidx")
      .on(table.workspaceId, table.email)
      .where(sql`${table.acceptedAt} IS NULL AND ${table.revokedAt} IS NULL`),
    index("workspace_invitation_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("workspace_invitation_expiry_idx").on(table.expiresAt),
    index("workspace_invitation_provisional_session_idx").on(
      table.provisionalSessionId,
    ),
    check(
      "workspace_invitation_token_hash_check",
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "workspace_invitation_member_role_check",
      sql`${table.role} = 'member'::workspace_role`,
    ),
  ],
);

export const invitationDelivery = pgTable(
  "invitation_delivery",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    invitationId: text("invitation_id").notNull(),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    ciphertext: text("ciphertext"),
    status: varchar("status", { length: 16 }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leaseId: text("lease_id"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    lastErrorCode: varchar("last_error_code", { length: 32 }),
  },
  (t) => [
    foreignKey({
      columns: [t.invitationId, t.workspaceId],
      foreignColumns: [workspaceInvitation.id, workspaceInvitation.workspaceId],
    }).onDelete("restrict"),
    uniqueIndex("invitation_delivery_generation_idx").on(
      t.invitationId,
      t.tokenHash,
    ),
    index("invitation_delivery_queue_idx").on(t.status, t.nextAttemptAt),
    index("invitation_delivery_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt,
    ),
    check(
      "invitation_delivery_status_check",
      sql`${t.status} in ('queued','sending','sent','failed','cancelled')`,
    ),
    check(
      "invitation_delivery_attempts_check",
      sql`${t.attempts} between 0 and 3`,
    ),
    check(
      "invitation_delivery_ciphertext_check",
      sql`(${t.status} in ('queued','sending')) = (${t.ciphertext} is not null)`,
    ),
  ],
);

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    key: varchar("key", { length: 10 }).notNull(),
    description: text("description").default("").notNull(),
    repositoryUrl: varchar("repository_url", { length: 2048 }),
    defaultBranch: varchar("default_branch", { length: 255 }),
    repositorySubdirectory: varchar("repository_subdirectory", { length: 512 }),
    showReviewColumn: boolean("show_review_column").default(true).notNull(),
    showDoneColumn: boolean("show_done_column").default(true).notNull(),
    nextIssueNumber: integer("next_issue_number").default(1).notNull(),
    nextEpicNumber: integer("next_epic_number").default(1).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_workspace_key_uidx").on(table.workspaceId, table.key),
    uniqueIndex("project_id_workspace_uidx").on(table.id, table.workspaceId),
    index("project_workspace_id_idx").on(table.workspaceId),
    check(
      "project_key_format_check",
      sql`${table.key} ~ '^[A-Z][A-Z0-9]{1,9}$'`,
    ),
    check("project_next_issue_number_check", sql`${table.nextIssueNumber} > 0`),
    check("project_next_epic_number_check", sql`${table.nextEpicNumber} > 0`),
    check("project_version_check", sql`${table.version} > 0`),
  ],
);

export const projectPermission = pgEnum("project_permission", ["read", "edit"]);

export const projectMembership = pgTable(
  "project_membership",
  {
    workspaceId: text("workspace_id").notNull(),
    projectId: text("project_id").notNull(),
    userId: text("user_id").notNull(),
    permission: projectPermission("permission").default("edit").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    foreignKey({
      columns: [table.workspaceId, table.userId],
      foreignColumns: [
        workspaceMembership.workspaceId,
        workspaceMembership.userId,
      ],
      name: "project_membership_workspace_member_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [project.id, project.workspaceId],
      name: "project_membership_project_workspace_fk",
    }).onDelete("cascade"),
    index("project_membership_workspace_user_idx").on(
      table.workspaceId,
      table.userId,
    ),
  ],
);

export const membershipEvent = pgTable(
  "membership_event",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    subjectUserId: text("subject_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    actorName: varchar("actor_name", { length: 120 }),
    subjectName: varchar("subject_name", { length: 120 }),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "restrict",
    }),
    type: varchar("type", { length: 64 }).notNull(),
    previousRole: workspaceRole("previous_role"),
    nextRole: workspaceRole("next_role"),
    previousPermission: projectPermission("previous_permission"),
    nextPermission: projectPermission("next_permission"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("membership_event_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("membership_event_subject_created_idx").on(
      table.subjectUserId,
      table.createdAt,
    ),
  ],
);

export const workspaceInvitationProject = pgTable(
  "workspace_invitation_project",
  {
    invitationId: text("invitation_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    projectId: text("project_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.invitationId, table.projectId] }),
    foreignKey({
      columns: [table.invitationId, table.workspaceId],
      foreignColumns: [workspaceInvitation.id, workspaceInvitation.workspaceId],
      name: "workspace_invitation_project_invitation_workspace_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [project.id, project.workspaceId],
      name: "workspace_invitation_project_project_workspace_fk",
    }).onDelete("cascade"),
    index("workspace_invitation_project_workspace_idx").on(table.workspaceId),
  ],
);

export const workspaceInvitationEvent = pgTable(
  "workspace_invitation_event",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    invitationId: text("invitation_id")
      .notNull()
      .references(() => workspaceInvitation.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    actorName: varchar("actor_name", { length: 120 }),
    subjectUserId: text("subject_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    subjectName: varchar("subject_name", { length: 120 }),
    type: varchar("type", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("workspace_invitation_event_invitation_created_idx").on(
      table.invitationId,
      table.createdAt,
    ),
    index("workspace_invitation_event_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);
