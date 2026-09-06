CREATE TABLE "epic" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"title" varchar(240) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "epic_version_check" CHECK ("epic"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "epic_id" text;--> statement-breakpoint
ALTER TABLE "epic" ADD CONSTRAINT "epic_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epic" ADD CONSTRAINT "epic_project_workspace_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."project"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "epic_id_workspace_project_uidx" ON "epic" USING btree ("id","workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "epic_project_created_idx" ON "epic" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "epic_workspace_id_idx" ON "epic" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_epic_workspace_project_fk" FOREIGN KEY ("epic_id","workspace_id","project_id") REFERENCES "public"."epic"("id","workspace_id","project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_epic_status_idx" ON "issue" USING btree ("epic_id","status");