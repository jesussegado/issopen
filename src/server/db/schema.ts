import { relations, sql } from "drizzle-orm";
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
import type { CaptureMetadata } from "../../shared/capture-contract.js";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("account_issuer_account_id_uidx").on(
      table.issuer,
      table.accountId,
    ),
    index("account_user_id_idx").on(table.userId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  alg: text("alg"),
  crv: text("crv"),
});

export const oauthClient = pgTable(
  "oauth_client",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: boolean("disabled").default(false),
    skipConsent: boolean("skip_consent"),
    enableEndSession: boolean("enable_end_session"),
    subjectType: text("subject_type"),
    scopes: text("scopes").array(),
    clientCredentialsScopes: text("client_credentials_scopes")
      .array()
      .default(sql`ARRAY[]::text[]`),
    userId: text("user_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts").array(),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris").array().notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: boolean(
      "backchannel_logout_session_required",
    ),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: text("grant_types").array(),
    responseTypes: text("response_types").array(),
    requirePKCE: boolean("require_pkce"),
    dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
    referenceId: text("reference_id"),
    metadata: jsonb("metadata"),
  },
  (table) => [index("oauth_client_user_id_idx").on(table.userId)],
);

export const oauthResource = pgTable("oauth_resource", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: text("allowed_scopes").array(),
  customClaims: jsonb("custom_claims"),
  dpopBoundAccessTokensRequired: boolean(
    "dpop_bound_access_tokens_required",
  ).default(false),
  disabled: boolean("disabled").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  policyVersion: integer("policy_version").default(1),
  metadata: jsonb("metadata"),
});

export const oauthClientResource = pgTable(
  "oauth_client_resource",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: "cascade" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("oauth_client_resource_client_resource_uidx").on(
      table.clientId,
      table.resourceId,
    ),
    index("oauth_client_resource_client_id_idx").on(table.clientId),
    index("oauth_client_resource_resource_id_idx").on(table.resourceId),
  ],
);

export const oauthRefreshToken = pgTable(
  "oauth_refresh_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    revoked: timestamp("revoked", { withTimezone: true }),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: timestamp("rotation_replay_expires_at", {
      withTimezone: true,
    }),
    authTime: timestamp("auth_time", { withTimezone: true }),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (table) => [
    index("oauth_refresh_token_client_id_idx").on(table.clientId),
    index("oauth_refresh_token_session_id_idx").on(table.sessionId),
    index("oauth_refresh_token_user_id_idx").on(table.userId),
    index("oauth_refresh_token_authorization_code_id_idx").on(
      table.authorizationCodeId,
    ),
  ],
);

export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    token: text("token").unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    refreshId: text("refresh_id").references(() => oauthRefreshToken.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    revoked: timestamp("revoked", { withTimezone: true }),
    confirmation: jsonb("confirmation"),
    scopes: text("scopes").array().notNull(),
  },
  (table) => [
    index("oauth_access_token_client_id_idx").on(table.clientId),
    index("oauth_access_token_session_id_idx").on(table.sessionId),
    index("oauth_access_token_user_id_idx").on(table.userId),
    index("oauth_access_token_authorization_code_id_idx").on(
      table.authorizationCodeId,
    ),
    index("oauth_access_token_refresh_id_idx").on(table.refreshId),
  ],
);

export const oauthConsent = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId),
    userId: text("user_id").references(() => user.id),
    referenceId: text("reference_id"),
    resources: text("resources").array(),
    requestedUserInfoClaims: text("requested_user_info_claims").array(),
    scopes: text("scopes").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("oauth_consent_client_id_idx").on(table.clientId),
    index("oauth_consent_user_id_idx").on(table.userId),
  ],
);

export const oauthClientAssertion = pgTable("oauth_client_assertion", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    uniqueIndex("workspace_membership_user_uidx").on(table.userId),
    index("workspace_membership_workspace_role_idx").on(
      table.workspaceId,
      table.role,
    ),
  ],
);

export const issueStatusValues = [
  "backlog",
  "ready",
  "in_progress",
  "ready_for_review",
  "done",
] as const;

export const issuePriorityValues = ["low", "medium", "high", "urgent"] as const;

export const actorTypeValues = ["human", "agent", "system"] as const;
export const activitySourceValues = [
  "rest",
  "chrome_extension",
  "mcp",
  "system",
  "operator",
] as const;
export const codeLinkTypeValues = ["branch", "commit", "pull_request"] as const;
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

export const issueStatus = pgEnum("issue_status", issueStatusValues);
export const issuePriority = pgEnum("issue_priority", issuePriorityValues);
export const activityActorType = pgEnum("activity_actor_type", actorTypeValues);
export const activitySource = pgEnum("activity_source", activitySourceValues);
export const codeLinkType = pgEnum("code_link_type", codeLinkTypeValues);
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
    uniqueIndex("agent_credential_agent_uidx").on(table.agentId),
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

export const projectMembership = pgTable(
  "project_membership",
  {
    workspaceId: text("workspace_id").notNull(),
    projectId: text("project_id").notNull(),
    userId: text("user_id").notNull(),
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
    projectId: text("project_id").references(() => project.id, {
      onDelete: "restrict",
    }),
    type: varchar("type", { length: 64 }).notNull(),
    previousRole: workspaceRole("previous_role"),
    nextRole: workspaceRole("next_role"),
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

export const epic = pgTable(
  "epic",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    projectId: text("project_id").notNull(),
    number: integer("number").notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description").default("").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [project.id, project.workspaceId],
      name: "epic_project_workspace_fk",
    }).onDelete("restrict"),
    uniqueIndex("epic_id_workspace_project_uidx").on(
      table.id,
      table.workspaceId,
      table.projectId,
    ),
    index("epic_project_created_idx").on(table.projectId, table.createdAt),
    index("epic_project_archived_number_idx").on(
      table.projectId,
      table.archivedAt,
      table.number,
    ),
    uniqueIndex("epic_project_number_uidx").on(table.projectId, table.number),
    index("epic_workspace_id_idx").on(table.workspaceId),
    check("epic_number_check", sql`${table.number} > 0`),
    check("epic_version_check", sql`${table.version} > 0`),
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

export const issue = pgTable(
  "issue",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    projectId: text("project_id").notNull(),
    epicId: text("epic_id"),
    number: integer("number").notNull(),
    key: varchar("key", { length: 32 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description").default("").notNull(),
    priority: issuePriority("priority").default("medium").notNull(),
    status: issueStatus("status").default("backlog").notNull(),
    humanOwnerId: text("human_owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    claimedByAgentId: text("claimed_by_agent_id"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [project.id, project.workspaceId],
      name: "issue_project_workspace_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.epicId, table.workspaceId, table.projectId],
      foreignColumns: [epic.id, epic.workspaceId, epic.projectId],
      name: "issue_epic_workspace_project_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.claimedByAgentId, table.workspaceId],
      foreignColumns: [agentIdentity.id, agentIdentity.workspaceId],
      name: "issue_claimed_agent_workspace_fk",
    }).onDelete("restrict"),
    uniqueIndex("issue_project_number_uidx").on(table.projectId, table.number),
    uniqueIndex("issue_workspace_key_uidx").on(table.workspaceId, table.key),
    uniqueIndex("issue_id_workspace_uidx").on(table.id, table.workspaceId),
    index("issue_project_status_idx").on(table.projectId, table.status),
    index("issue_epic_status_idx").on(table.epicId, table.status),
    index("issue_workspace_id_idx").on(table.workspaceId),
    check("issue_number_check", sql`${table.number} > 0`),
    check("issue_version_check", sql`${table.version} > 0`),
    check(
      "issue_claim_consistency_check",
      sql`(${table.claimedByAgentId} is null and ${table.claimedAt} is null) or (${table.claimedByAgentId} is not null and ${table.claimedAt} is not null)`,
    ),
  ],
);

export type IssueQuestionOption = {
  id: string;
  label: string;
  description: string;
};

export const issueQuestion = pgTable(
  "issue_question",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    issueId: text("issue_id").notNull(),
    prompt: text("prompt").notNull(),
    recommendation: text("recommendation").notNull(),
    options: jsonb("options").$type<IssueQuestionOption[]>().notNull(),
    recommendedOptionId: text("recommended_option_id").notNull(),
    blocking: boolean("blocking").default(true).notNull(),
    answerOptionId: text("answer_option_id"),
    answerOtherText: text("answer_other_text"),
    answeredByUserId: text("answered_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.issueId, table.workspaceId],
      foreignColumns: [issue.id, issue.workspaceId],
      name: "issue_question_issue_workspace_fk",
    }).onDelete("restrict"),
    uniqueIndex("issue_question_id_workspace_uidx").on(
      table.id,
      table.workspaceId,
    ),
    index("issue_question_issue_created_idx").on(
      table.issueId,
      table.createdAt,
    ),
    index("issue_question_workspace_id_idx").on(table.workspaceId),
    check("issue_question_version_check", sql`${table.version} > 0`),
    check(
      "issue_question_answer_consistency_check",
      sql`(
        ${table.answerOptionId} is null and
        ${table.answerOtherText} is null and
        ${table.answeredByUserId} is null and
        ${table.answeredAt} is null
      ) or (
        ((${table.answerOptionId} is not null and ${table.answerOtherText} is null) or
         (${table.answerOptionId} is null and ${table.answerOtherText} is not null)) and
        ${table.answeredByUserId} is not null and
        ${table.answeredAt} is not null
      )`,
    ),
  ],
);

export const issueComment = pgTable(
  "issue_comment",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    issueId: text("issue_id").notNull(),
    body: text("body").notNull(),
    authorType: activityActorType("author_type").notNull(),
    authorId: text("author_id").notNull(),
    authorDisplayName: varchar("author_display_name", {
      length: 120,
    }).notNull(),
    source: activitySource("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.issueId, table.workspaceId],
      foreignColumns: [issue.id, issue.workspaceId],
      name: "issue_comment_issue_workspace_fk",
    }).onDelete("restrict"),
    index("issue_comment_issue_created_idx").on(table.issueId, table.createdAt),
    index("issue_comment_workspace_id_idx").on(table.workspaceId),
  ],
);

export const codeLink = pgTable(
  "code_link",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    issueId: text("issue_id").notNull(),
    type: codeLinkType("type").notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.issueId, table.workspaceId],
      foreignColumns: [issue.id, issue.workspaceId],
      name: "code_link_issue_workspace_fk",
    }).onDelete("restrict"),
    index("code_link_issue_id_idx").on(table.issueId),
    index("code_link_workspace_id_idx").on(table.workspaceId),
  ],
);

export const activityEvent = pgTable(
  "activity_event",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    issueId: text("issue_id").references(() => issue.id, {
      onDelete: "restrict",
    }),
    type: varchar("type", { length: 64 }).notNull(),
    actorType: activityActorType("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    actorDisplayName: varchar("actor_display_name", { length: 120 }).notNull(),
    source: activitySource("source").notNull(),
    summary: varchar("summary", { length: 500 }).notNull(),
    changes: jsonb("changes").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("activity_event_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    index("activity_event_issue_created_idx").on(
      table.issueId,
      table.createdAt,
    ),
    index("activity_event_workspace_id_idx").on(table.workspaceId),
  ],
);

export const userRelations = relations(user, ({ many, one }) => ({
  accounts: many(account),
  sessions: many(session),
  memberships: many(workspaceMembership),
  projectMemberships: many(projectMembership),
  ownedInstance: one(instanceOwner),
  workspace: one(workspace),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const ownerRelations = relations(instanceOwner, ({ one }) => ({
  user: one(user, { fields: [instanceOwner.userId], references: [user.id] }),
}));

export const workspaceRelations = relations(workspace, ({ many, one }) => ({
  owner: one(user, { fields: [workspace.ownerId], references: [user.id] }),
  memberships: many(workspaceMembership),
  membershipEvents: many(membershipEvent),
}));

export const workspaceMembershipRelations = relations(
  workspaceMembership,
  ({ many, one }) => ({
    workspace: one(workspace, {
      fields: [workspaceMembership.workspaceId],
      references: [workspace.id],
    }),
    user: one(user, {
      fields: [workspaceMembership.userId],
      references: [user.id],
    }),
    projects: many(projectMembership),
  }),
);

export const agentIdentityRelations = relations(
  agentIdentity,
  ({ many, one }) => ({
    workspace: one(workspace, {
      fields: [agentIdentity.workspaceId],
      references: [workspace.id],
    }),
    projects: many(agentProject),
    scopes: many(agentScope),
    credentials: many(agentCredential),
    claimedIssues: many(issue),
  }),
);

export const agentCredentialRelations = relations(
  agentCredential,
  ({ one }) => ({
    agent: one(agentIdentity, {
      fields: [agentCredential.agentId],
      references: [agentIdentity.id],
    }),
  }),
);

export const agentProjectRelations = relations(agentProject, ({ one }) => ({
  agent: one(agentIdentity, {
    fields: [agentProject.agentId],
    references: [agentIdentity.id],
  }),
  project: one(project, {
    fields: [agentProject.projectId],
    references: [project.id],
  }),
}));

export const agentScopeRelations = relations(agentScope, ({ one }) => ({
  agent: one(agentIdentity, {
    fields: [agentScope.agentId],
    references: [agentIdentity.id],
  }),
}));

export const projectRelations = relations(project, ({ many, one }) => ({
  workspace: one(workspace, {
    fields: [project.workspaceId],
    references: [workspace.id],
  }),
  epics: many(epic),
  issues: many(issue),
  activity: many(activityEvent),
  memberships: many(projectMembership),
}));

export const projectMembershipRelations = relations(
  projectMembership,
  ({ one }) => ({
    project: one(project, {
      fields: [projectMembership.projectId],
      references: [project.id],
    }),
    workspaceMembership: one(workspaceMembership, {
      fields: [projectMembership.workspaceId, projectMembership.userId],
      references: [workspaceMembership.workspaceId, workspaceMembership.userId],
    }),
  }),
);

export const membershipEventRelations = relations(
  membershipEvent,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [membershipEvent.workspaceId],
      references: [workspace.id],
    }),
    project: one(project, {
      fields: [membershipEvent.projectId],
      references: [project.id],
    }),
  }),
);

export const epicRelations = relations(epic, ({ many, one }) => ({
  workspace: one(workspace, {
    fields: [epic.workspaceId],
    references: [workspace.id],
  }),
  project: one(project, {
    fields: [epic.projectId],
    references: [project.id],
  }),
  issues: many(issue),
}));

export const issueRelations = relations(issue, ({ many, one }) => ({
  workspace: one(workspace, {
    fields: [issue.workspaceId],
    references: [workspace.id],
  }),
  project: one(project, {
    fields: [issue.projectId],
    references: [project.id],
  }),
  epic: one(epic, {
    fields: [issue.epicId],
    references: [epic.id],
  }),
  humanOwner: one(user, {
    fields: [issue.humanOwnerId],
    references: [user.id],
  }),
  codeLinks: many(codeLink),
  questions: many(issueQuestion),
  comments: many(issueComment),
  activity: many(activityEvent),
}));

export const issueQuestionRelations = relations(issueQuestion, ({ one }) => ({
  issue: one(issue, {
    fields: [issueQuestion.issueId],
    references: [issue.id],
  }),
  answeredBy: one(user, {
    fields: [issueQuestion.answeredByUserId],
    references: [user.id],
  }),
}));

// Receipts deliberately survive installation revocation/reconnection. A human
// retry uses the same owner/workspace/key, never an invented agent identity.
export const extensionReceipt = pgTable(
  "extension_receipt",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    operation: text("operation").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("extension_receipt_owner_key_uidx").on(
      t.workspaceId,
      t.ownerId,
      t.operation,
      t.key,
    ),
  ],
);

export const captureEvidence = pgTable(
  "capture_evidence",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id),
    issueId: text("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    metadata: jsonb("metadata").$type<CaptureMetadata | null>(),
    fileKey: text("file_key").unique(),
    mime: text("mime"),
    bytes: integer("bytes").notNull().default(0),
    sha256: text("sha256"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("capture_evidence_issue_idx").on(t.issueId)],
);

export const codeLinkRelations = relations(codeLink, ({ one }) => ({
  issue: one(issue, {
    fields: [codeLink.issueId],
    references: [issue.id],
  }),
}));

export const issueCommentRelations = relations(issueComment, ({ one }) => ({
  issue: one(issue, {
    fields: [issueComment.issueId],
    references: [issue.id],
  }),
}));

export const activityEventRelations = relations(activityEvent, ({ one }) => ({
  project: one(project, {
    fields: [activityEvent.projectId],
    references: [project.id],
  }),
  issue: one(issue, {
    fields: [activityEvent.issueId],
    references: [issue.id],
  }),
}));
