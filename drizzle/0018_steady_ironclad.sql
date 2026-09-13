CREATE TABLE "workspace_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "workspace_role" DEFAULT 'member' NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_by_user_id" text NOT NULL,
	"claimed_by_user_id" text,
	"provisional_session_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invitation_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "workspace_invitation_token_hash_check" CHECK ("workspace_invitation"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "workspace_invitation_member_role_check" CHECK ("workspace_invitation"."role" = 'member'::workspace_role)
);
--> statement-breakpoint
CREATE TABLE "workspace_invitation_event" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"invitation_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"type" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invitation_project" (
	"invitation_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	CONSTRAINT "workspace_invitation_project_invitation_id_project_id_pk" PRIMARY KEY("invitation_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_claimed_by_user_id_user_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_provisional_session_id_session_id_fk" FOREIGN KEY ("provisional_session_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitation_id_workspace_uidx" ON "workspace_invitation" USING btree ("id","workspace_id");--> statement-breakpoint
ALTER TABLE "workspace_invitation_event" ADD CONSTRAINT "workspace_invitation_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation_event" ADD CONSTRAINT "workspace_invitation_event_invitation_id_workspace_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."workspace_invitation"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation_event" ADD CONSTRAINT "workspace_invitation_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation_project" ADD CONSTRAINT "workspace_invitation_project_invitation_workspace_fk" FOREIGN KEY ("invitation_id","workspace_id") REFERENCES "public"."workspace_invitation"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation_project" ADD CONSTRAINT "workspace_invitation_project_project_workspace_fk" FOREIGN KEY ("project_id","workspace_id") REFERENCES "public"."project"("id","workspace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitation_active_email_uidx" ON "workspace_invitation" USING btree ("workspace_id","email") WHERE "workspace_invitation"."accepted_at" IS NULL AND "workspace_invitation"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "workspace_invitation_workspace_created_idx" ON "workspace_invitation" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "workspace_invitation_expiry_idx" ON "workspace_invitation" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "workspace_invitation_provisional_session_idx" ON "workspace_invitation" USING btree ("provisional_session_id");--> statement-breakpoint
CREATE INDEX "workspace_invitation_event_invitation_created_idx" ON "workspace_invitation_event" USING btree ("invitation_id","created_at");--> statement-breakpoint
CREATE INDEX "workspace_invitation_event_workspace_created_idx" ON "workspace_invitation_event" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "workspace_invitation_project_workspace_idx" ON "workspace_invitation_project" USING btree ("workspace_id");--> statement-breakpoint
CREATE FUNCTION "reject_membership_audit_mutation"() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION 'membership audit events are immutable' USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "membership_event_append_only"
BEFORE UPDATE OR DELETE ON "membership_event"
FOR EACH ROW EXECUTE FUNCTION "reject_membership_audit_mutation"();--> statement-breakpoint
CREATE TRIGGER "workspace_invitation_event_append_only"
BEFORE UPDATE OR DELETE ON "workspace_invitation_event"
FOR EACH ROW EXECUTE FUNCTION "reject_membership_audit_mutation"();
