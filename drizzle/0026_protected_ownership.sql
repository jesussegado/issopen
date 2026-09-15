CREATE TABLE "authentication_assurance" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"method" varchar(16) NOT NULL,
	"authenticated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authentication_assurance_method_check" CHECK ("authentication_assurance"."method" in ('password','google'))
);
--> statement-breakpoint
CREATE TABLE "ownership_event" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"transfer_id" text,
	"actor_user_id" text NOT NULL,
	"actor_name" varchar(120) NOT NULL,
	"type" varchar(64) NOT NULL,
	"changes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ownership_transfer" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"from_name" varchar(120) NOT NULL,
	"to_name" varchar(120) NOT NULL,
	"workspace_version" integer NOT NULL,
	"recipient_membership_version" text NOT NULL,
	"version" text DEFAULT gen_random_uuid()::text NOT NULL,
	"request_id" text NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "ownership_transfer_status_check" CHECK ("ownership_transfer"."status" in ('pending','accepted','cancelled')),
	CONSTRAINT "ownership_transfer_distinct_people_check" CHECK ("ownership_transfer"."from_user_id" <> "ownership_transfer"."to_user_id")
);
--> statement-breakpoint
ALTER TABLE "authentication_assurance" ADD CONSTRAINT "authentication_assurance_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authentication_assurance" ADD CONSTRAINT "authentication_assurance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_event" ADD CONSTRAINT "ownership_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_event" ADD CONSTRAINT "ownership_event_transfer_id_ownership_transfer_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."ownership_transfer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_event" ADD CONSTRAINT "ownership_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfer" ADD CONSTRAINT "ownership_transfer_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfer" ADD CONSTRAINT "ownership_transfer_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfer" ADD CONSTRAINT "ownership_transfer_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ownership_event_workspace_created_idx" ON "ownership_event" USING btree ("workspace_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "ownership_transfer_request_idx" ON "ownership_transfer" USING btree ("workspace_id","from_user_id","request_id");--> statement-breakpoint
CREATE INDEX "ownership_transfer_workspace_created_idx" ON "ownership_transfer" USING btree ("workspace_id","created_at");