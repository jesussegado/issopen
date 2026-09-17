CREATE TABLE "owner_workspace_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"workspace_name" varchar(120) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_by_user_id" text NOT NULL,
	"claimed_by_user_id" text,
	"provisional_session_id" text,
	"created_workspace_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_workspace_invitation_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "owner_workspace_invitation_created_workspace_id_unique" UNIQUE("created_workspace_id"),
	CONSTRAINT "owner_workspace_invitation_token_hash_check" CHECK ("owner_workspace_invitation"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "owner_workspace_invitation_event" (
	"id" text PRIMARY KEY NOT NULL,
	"invitation_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"type" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "owner_workspace_invitation" ADD CONSTRAINT "owner_workspace_invitation_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_workspace_invitation" ADD CONSTRAINT "owner_workspace_invitation_claimed_by_user_id_user_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_workspace_invitation" ADD CONSTRAINT "owner_workspace_invitation_provisional_session_id_session_id_fk" FOREIGN KEY ("provisional_session_id") REFERENCES "public"."session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_workspace_invitation" ADD CONSTRAINT "owner_workspace_invitation_created_workspace_id_workspace_id_fk" FOREIGN KEY ("created_workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_workspace_invitation_event" ADD CONSTRAINT "owner_workspace_invitation_event_invitation_id_owner_workspace_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."owner_workspace_invitation"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_workspace_invitation_event" ADD CONSTRAINT "owner_workspace_invitation_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "owner_workspace_invitation_active_email_uidx" ON "owner_workspace_invitation" USING btree ("email") WHERE "owner_workspace_invitation"."accepted_at" IS NULL AND "owner_workspace_invitation"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "owner_workspace_invitation_created_idx" ON "owner_workspace_invitation" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "owner_workspace_invitation_expiry_idx" ON "owner_workspace_invitation" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "owner_workspace_invitation_claimed_user_idx" ON "owner_workspace_invitation" USING btree ("claimed_by_user_id");--> statement-breakpoint
CREATE INDEX "owner_workspace_invitation_provisional_session_idx" ON "owner_workspace_invitation" USING btree ("provisional_session_id");--> statement-breakpoint
CREATE INDEX "owner_workspace_invitation_event_created_idx" ON "owner_workspace_invitation_event" USING btree ("invitation_id","created_at");--> statement-breakpoint
CREATE TRIGGER "owner_workspace_invitation_event_append_only"
BEFORE UPDATE OR DELETE ON "owner_workspace_invitation_event"
FOR EACH ROW EXECUTE FUNCTION "reject_membership_audit_mutation"();
