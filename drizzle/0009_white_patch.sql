ALTER TABLE "agent_identity" ADD COLUMN "last_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_identity" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
UPDATE "oauth_resource"
SET "allowed_scopes" = array_append("allowed_scopes", 'offline_access')
WHERE "allowed_scopes" IS NOT NULL
  AND NOT ('offline_access' = ANY("allowed_scopes"));
