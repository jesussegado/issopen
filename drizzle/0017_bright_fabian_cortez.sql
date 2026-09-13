CREATE TYPE "public"."workspace_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "membership_event" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"subject_user_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"project_id" text,
	"type" varchar(64) NOT NULL,
	"previous_role" "workspace_role",
	"next_role" "workspace_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_membership" (
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_membership_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_membership" (
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "workspace_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_membership_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "membership_event" ADD CONSTRAINT "membership_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_event" ADD CONSTRAINT "membership_event_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_event" ADD CONSTRAINT "membership_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_event" ADD CONSTRAINT "membership_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_workspace_member_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "public"."workspace_membership"("workspace_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_project_workspace_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."project"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_membership" ADD CONSTRAINT "workspace_membership_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_membership" ADD CONSTRAINT "workspace_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "workspace_membership" ("workspace_id", "user_id", "role")
SELECT "id", "owner_id", 'owner'::"workspace_role"
FROM "workspace"
ON CONFLICT ("workspace_id", "user_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "membership_event" (
	"id",
	"workspace_id",
	"subject_user_id",
	"actor_user_id",
	"type",
	"next_role"
)
SELECT
	'owner-backfill-' || "id",
	"id",
	"owner_id",
	"owner_id",
	'membership.backfilled',
	'owner'::"workspace_role"
FROM "workspace"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
CREATE INDEX "membership_event_workspace_created_idx" ON "membership_event" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "membership_event_subject_created_idx" ON "membership_event" USING btree ("subject_user_id","created_at");--> statement-breakpoint
CREATE INDEX "project_membership_workspace_user_idx" ON "project_membership" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_membership_user_uidx" ON "workspace_membership" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_membership_workspace_role_idx" ON "workspace_membership" USING btree ("workspace_id","role");
