import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { CaptureMetadata } from "../../../shared/capture-contract.js";
import { workspace } from "./access.js";
import { user } from "./identity.js";
import { issue } from "./tracker.js";

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
