CREATE TYPE "public"."activity_actor_type" AS ENUM('human', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."activity_source" AS ENUM('rest', 'mcp', 'system', 'operator');--> statement-breakpoint
CREATE TYPE "public"."code_link_type" AS ENUM('branch', 'commit', 'pull_request');--> statement-breakpoint
CREATE TYPE "public"."issue_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('backlog', 'ready', 'in_progress', 'ready_for_review', 'done');--> statement-breakpoint
CREATE TABLE "activity_event" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"issue_id" text,
	"type" varchar(64) NOT NULL,
	"actor_type" "activity_actor_type" NOT NULL,
	"actor_id" text NOT NULL,
	"actor_display_name" varchar(120) NOT NULL,
	"source" "activity_source" NOT NULL,
	"summary" varchar(500) NOT NULL,
	"changes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_link" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"type" "code_link_type" NOT NULL,
	"url" varchar(2048) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"number" integer NOT NULL,
	"key" varchar(32) NOT NULL,
	"title" varchar(240) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" "issue_priority" DEFAULT 'medium' NOT NULL,
	"status" "issue_status" DEFAULT 'backlog' NOT NULL,
	"human_owner_id" text NOT NULL,
	"claimed_by_agent_id" text,
	"claimed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_number_check" CHECK ("issue"."number" > 0),
	CONSTRAINT "issue_version_check" CHECK ("issue"."version" > 0),
	CONSTRAINT "issue_claim_consistency_check" CHECK (("issue"."claimed_by_agent_id" is null and "issue"."claimed_at" is null) or ("issue"."claimed_by_agent_id" is not null and "issue"."claimed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"key" varchar(10) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"repository_url" varchar(2048),
	"default_branch" varchar(255),
	"repository_subdirectory" varchar(512),
	"next_issue_number" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_key_format_check" CHECK ("project"."key" ~ '^[A-Z][A-Z0-9]{1,9}$'),
	CONSTRAINT "project_next_issue_number_check" CHECK ("project"."next_issue_number" > 0),
	CONSTRAINT "project_version_check" CHECK ("project"."version" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_id_workspace_uidx" ON "project" USING btree ("id","workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_id_workspace_uidx" ON "issue" USING btree ("id","workspace_id");--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_link" ADD CONSTRAINT "code_link_issue_workspace_fk" FOREIGN KEY ("issue_id","workspace_id") REFERENCES "public"."issue"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_human_owner_id_user_id_fk" FOREIGN KEY ("human_owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_project_workspace_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."project"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_event_project_created_idx" ON "activity_event" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_event_issue_created_idx" ON "activity_event" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_event_workspace_id_idx" ON "activity_event" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "code_link_issue_id_idx" ON "code_link" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "code_link_workspace_id_idx" ON "code_link" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_project_number_uidx" ON "issue" USING btree ("project_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_workspace_key_uidx" ON "issue" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "issue_project_status_idx" ON "issue" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "issue_workspace_id_idx" ON "issue" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_workspace_key_uidx" ON "project" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "project_workspace_id_idx" ON "project" USING btree ("workspace_id");--> statement-breakpoint
CREATE FUNCTION "reject_activity_event_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'activity events are immutable' USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "activity_event_append_only"
BEFORE UPDATE OR DELETE ON "activity_event"
FOR EACH ROW EXECUTE FUNCTION "reject_activity_event_mutation"();
