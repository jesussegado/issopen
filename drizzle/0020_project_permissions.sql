CREATE TYPE "public"."project_permission" AS ENUM('read', 'edit');--> statement-breakpoint
ALTER TABLE "project_membership" ADD COLUMN "permission" "project_permission" DEFAULT 'edit' NOT NULL;