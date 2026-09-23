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
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { project, workspace } from "./access.js";
import { agentIdentity } from "./agents.js";
import { user } from "./identity.js";

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

export const issueStatus = pgEnum("issue_status", issueStatusValues);
export const issuePriority = pgEnum("issue_priority", issuePriorityValues);
export const activityActorType = pgEnum("activity_actor_type", actorTypeValues);
export const activitySource = pgEnum("activity_source", activitySourceValues);
export const codeLinkType = pgEnum("code_link_type", codeLinkTypeValues);

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
    humanAssigneeId: text("human_assignee_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    humanAssigneeName: varchar("human_assignee_name", { length: 120 }),
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
    index("issue_project_assignee_idx").on(
      table.projectId,
      table.humanAssigneeId,
    ),
    check(
      "issue_assignee_consistency_check",
      sql`(${table.humanAssigneeId} is null) = (${table.humanAssigneeName} is null)`,
    ),
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
    recipientUserId: text("recipient_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    recipientName: varchar("recipient_name", { length: 120 }),
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
    index("issue_question_recipient_idx").on(
      table.recipientUserId,
      table.issueId,
    ),
    check(
      "issue_question_recipient_consistency_check",
      sql`(${table.recipientUserId} is null) = (${table.recipientName} is null)`,
    ),
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
    mentions: jsonb("mentions")
      .$type<Array<{ id: string; name: string }>>()
      .notNull()
      .default([]),
    webRequestId: text("web_request_id"),
    webRequestHash: text("web_request_hash"),
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
    uniqueIndex("issue_comment_web_request_idx").on(
      table.workspaceId,
      table.issueId,
      table.authorId,
      table.webRequestId,
    ),
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
