import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { project, workspace } from "./access.js";

export const agentScopeValues = [
  "issues:read",
  "issues:create",
  "questions:write",
  "comments:write",
  "issues:claim",
  "issues:write",
  "code:link",
  "issues:review",
  "issues:close",
  "epics:create",
  "epics:write",
] as const;

export const agentScopeValue = pgEnum("agent_scope_value", agentScopeValues);

export const agentIdentity = pgTable(
  "agent_identity",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").default("").notNull(),
    oauthClientId: varchar("oauth_client_id", { length: 2048 }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("agent_identity_id_workspace_uidx").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("agent_identity_workspace_name_uidx").on(
      table.workspaceId,
      table.name,
    ),
    uniqueIndex("agent_identity_workspace_oauth_client_uidx").on(
      table.workspaceId,
      table.oauthClientId,
    ),
    index("agent_identity_workspace_id_idx").on(table.workspaceId),
  ],
);

export const agentScope = pgTable(
  "agent_scope",
  {
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    scope: agentScopeValue("scope").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.agentId, table.scope] }),
    foreignKey({
      columns: [table.agentId, table.workspaceId],
      foreignColumns: [agentIdentity.id, agentIdentity.workspaceId],
      name: "agent_scope_identity_workspace_fk",
    }).onDelete("cascade"),
    index("agent_scope_workspace_id_idx").on(table.workspaceId),
  ],
);

export const agentCredential = pgTable(
  "agent_credential",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    label: varchar("label", { length: 80 }).default("Primary").notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    fingerprint: varchar("fingerprint", { length: 16 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("agent_credential_agent_label_uidx").on(
      table.agentId,
      sql`lower(${table.label})`,
    ),
    uniqueIndex("agent_credential_fingerprint_uidx").on(table.fingerprint),
    foreignKey({
      columns: [table.agentId, table.workspaceId],
      foreignColumns: [agentIdentity.id, agentIdentity.workspaceId],
      name: "agent_credential_identity_workspace_fk",
    }).onDelete("restrict"),
    index("agent_credential_workspace_id_idx").on(table.workspaceId),
  ],
);

export const mcpIdempotencyRecord = pgTable(
  "mcp_idempotency_record",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    agentId: text("agent_id").notNull(),
    toolName: varchar("tool_name", { length: 64 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    response: jsonb("response").$type<Record<string, unknown>>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.agentId, table.workspaceId],
      foreignColumns: [agentIdentity.id, agentIdentity.workspaceId],
      name: "mcp_idempotency_record_identity_workspace_fk",
    }).onDelete("cascade"),
    uniqueIndex("mcp_idempotency_record_scope_key_uidx").on(
      table.workspaceId,
      table.agentId,
      table.toolName,
      table.idempotencyKey,
    ),
    index("mcp_idempotency_record_expiry_idx").on(table.expiresAt),
    index("mcp_idempotency_record_workspace_id_idx").on(table.workspaceId),
    check(
      "mcp_idempotency_record_request_hash_check",
      sql`${table.requestHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const agentProject = pgTable(
  "agent_project",
  {
    agentId: text("agent_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    projectId: text("project_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.agentId, table.projectId] }),
    foreignKey({
      columns: [table.agentId, table.workspaceId],
      foreignColumns: [agentIdentity.id, agentIdentity.workspaceId],
      name: "agent_project_identity_workspace_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [project.id, project.workspaceId],
      name: "agent_project_project_workspace_fk",
    }).onDelete("cascade"),
    index("agent_project_workspace_id_idx").on(table.workspaceId),
    index("agent_project_project_id_idx").on(table.projectId),
  ],
);
