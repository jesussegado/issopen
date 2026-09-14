-- Bind existing installations while every user still has at most one membership.
-- Missing membership remains unusable, never silently rebound at runtime.
UPDATE "oauth_client" c SET "metadata" = COALESCE(c."metadata", '{}'::jsonb) || jsonb_build_object('workspaceId', m."workspace_id")
FROM "workspace_membership" m
WHERE c."reference_id" = 'issopen-chrome' AND c."user_id" = m."user_id"
AND NOT (COALESCE(c."metadata", '{}'::jsonb) ? 'workspaceId');--> statement-breakpoint
DROP INDEX "workspace_membership_user_uidx";--> statement-breakpoint
CREATE INDEX "workspace_membership_user_idx" ON "workspace_membership" USING btree ("user_id");
