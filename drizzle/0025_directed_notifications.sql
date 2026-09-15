CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"event_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"kind" varchar(24) NOT NULL,
	"question_id" text,
	"question_version" integer,
	"read_at" timestamp with time zone,
	"obsolete_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_kind_check" CHECK ("notification"."kind" in ('assignment','question','mention','review'))
);
--> statement-breakpoint
ALTER TABLE "issue_comment" ADD COLUMN "mentions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_comment" ADD COLUMN "web_request_id" text;--> statement-breakpoint
ALTER TABLE "issue_comment" ADD COLUMN "web_request_hash" text;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_event_id_activity_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."activity_event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_question_id_issue_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."issue_question"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_event_recipient_kind_idx" ON "notification" USING btree ("event_id","recipient_id","kind");--> statement-breakpoint
CREATE INDEX "notification_inbox_idx" ON "notification" USING btree ("workspace_id","recipient_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_comment_web_request_idx" ON "issue_comment" USING btree ("workspace_id","issue_id","author_id","web_request_id");