ALTER TYPE "public"."activity_source" ADD VALUE 'chrome_extension' BEFORE 'mcp';--> statement-breakpoint
CREATE TABLE "capture_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"metadata" jsonb,
	"file_key" text,
	"mime" text,
	"bytes" integer DEFAULT 0 NOT NULL,
	"sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capture_evidence_file_key_unique" UNIQUE("file_key")
);
--> statement-breakpoint
CREATE TABLE "extension_receipt" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"operation" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capture_evidence" ADD CONSTRAINT "capture_evidence_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_evidence" ADD CONSTRAINT "capture_evidence_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capture_evidence" ADD CONSTRAINT "capture_evidence_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_receipt" ADD CONSTRAINT "extension_receipt_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extension_receipt" ADD CONSTRAINT "extension_receipt_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capture_evidence_issue_idx" ON "capture_evidence" USING btree ("issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "extension_receipt_owner_key_uidx" ON "extension_receipt" USING btree ("workspace_id","owner_id","operation","key");