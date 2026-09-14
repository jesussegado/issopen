ALTER TABLE "membership_event" ADD COLUMN "previous_permission" "project_permission";--> statement-breakpoint
ALTER TABLE "membership_event" ADD COLUMN "next_permission" "project_permission";--> statement-breakpoint
ALTER TABLE "workspace_membership" ADD COLUMN "version" text DEFAULT gen_random_uuid()::text NOT NULL;