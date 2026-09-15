CREATE TABLE "invitation_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"invitation_id" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"ciphertext" text,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_id" text,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error_code" varchar(32),
	CONSTRAINT "invitation_delivery_status_check" CHECK ("invitation_delivery"."status" in ('queued','sending','sent','failed','cancelled')),
	CONSTRAINT "invitation_delivery_attempts_check" CHECK ("invitation_delivery"."attempts" between 0 and 3),
	CONSTRAINT "invitation_delivery_ciphertext_check" CHECK (("invitation_delivery"."status" in ('queued','sending')) = ("invitation_delivery"."ciphertext" is not null))
);
--> statement-breakpoint
ALTER TABLE "invitation_delivery" ADD CONSTRAINT "invitation_delivery_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_delivery" ADD CONSTRAINT "invitation_delivery_invitation_id_workspace_id_workspace_invitation_id_workspace_id_fk" FOREIGN KEY ("invitation_id","workspace_id") REFERENCES "public"."workspace_invitation"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_delivery_generation_idx" ON "invitation_delivery" USING btree ("invitation_id","token_hash");--> statement-breakpoint
CREATE INDEX "invitation_delivery_queue_idx" ON "invitation_delivery" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "invitation_delivery_workspace_created_idx" ON "invitation_delivery" USING btree ("workspace_id","created_at");