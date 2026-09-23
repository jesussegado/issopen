import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { project, workspace } from "./access.js";
import { user } from "./identity.js";
import { activityEvent, issue, issueQuestion } from "./tracker.js";

export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "restrict" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    issueId: text("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "restrict" }),
    eventId: text("event_id")
      .notNull()
      .references(() => activityEvent.id, { onDelete: "restrict" }),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    kind: varchar("kind", { length: 24 })
      .$type<"assignment" | "question" | "mention" | "review">()
      .notNull(),
    questionId: text("question_id").references(() => issueQuestion.id, {
      onDelete: "restrict",
    }),
    questionVersion: integer("question_version"),
    readAt: timestamp("read_at", { withTimezone: true }),
    obsoleteAt: timestamp("obsolete_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_event_recipient_kind_idx").on(
      table.eventId,
      table.recipientId,
      table.kind,
    ),
    index("notification_inbox_idx").on(
      table.workspaceId,
      table.recipientId,
      table.createdAt,
      table.id,
    ),
    check(
      "notification_kind_check",
      sql`${table.kind} in ('assignment','question','mention','review')`,
    ),
  ],
);
