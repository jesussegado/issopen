CREATE TYPE "public"."agent_scope_value" AS ENUM('issues:read', 'issues:claim', 'issues:write', 'code:link', 'issues:review', 'issues:close');--> statement-breakpoint
CREATE TABLE "agent_credential" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"fingerprint" varchar(16) NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_project" (
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	CONSTRAINT "agent_project_agent_id_project_id_pk" PRIMARY KEY("agent_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "agent_scope" (
	"agent_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"scope" "agent_scope_value" NOT NULL,
	CONSTRAINT "agent_scope_agent_id_scope_pk" PRIMARY KEY("agent_id","scope")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_identity_id_workspace_uidx" ON "agent_identity" USING btree ("id","workspace_id");--> statement-breakpoint
ALTER TABLE "agent_credential" ADD CONSTRAINT "agent_credential_identity_workspace_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent_identity"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_identity" ADD CONSTRAINT "agent_identity_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_project" ADD CONSTRAINT "agent_project_identity_workspace_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent_identity"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_project" ADD CONSTRAINT "agent_project_project_workspace_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."project"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_scope" ADD CONSTRAINT "agent_scope_identity_workspace_fk" FOREIGN KEY ("agent_id","workspace_id") REFERENCES "public"."agent_identity"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_credential_agent_uidx" ON "agent_credential" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_credential_fingerprint_uidx" ON "agent_credential" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "agent_credential_workspace_id_idx" ON "agent_credential" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_identity_workspace_name_uidx" ON "agent_identity" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "agent_identity_workspace_id_idx" ON "agent_identity" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_project_workspace_id_idx" ON "agent_project" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_project_project_id_idx" ON "agent_project" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_scope_workspace_id_idx" ON "agent_scope" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_claimed_agent_workspace_fk" FOREIGN KEY ("claimed_by_agent_id","workspace_id") REFERENCES "public"."agent_identity"("id","workspace_id") ON DELETE restrict ON UPDATE no action;
