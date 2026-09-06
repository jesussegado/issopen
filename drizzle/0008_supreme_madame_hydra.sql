ALTER TYPE "public"."agent_scope_value" ADD VALUE 'comments:write' BEFORE 'issues:claim';--> statement-breakpoint
UPDATE "oauth_resource"
SET "allowed_scopes" = array_append(
  coalesce("allowed_scopes", ARRAY[]::text[]),
  'comments:write'
)
WHERE NOT (
  'comments:write' = ANY(coalesce("allowed_scopes", ARRAY[]::text[]))
);--> statement-breakpoint
CREATE TABLE "issue_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"body" text NOT NULL,
	"author_type" "activity_actor_type" NOT NULL,
	"author_id" text NOT NULL,
	"author_display_name" varchar(120) NOT NULL,
	"source" "activity_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_comment" ADD CONSTRAINT "issue_comment_issue_workspace_fk" FOREIGN KEY ("issue_id","workspace_id") REFERENCES "public"."issue"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_comment_issue_created_idx" ON "issue_comment" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issue_comment_workspace_id_idx" ON "issue_comment" USING btree ("workspace_id");
--> statement-breakpoint
CREATE FUNCTION "reject_issue_comment_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'issue comments are append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "issue_comment_append_only"
BEFORE UPDATE OR DELETE ON "issue_comment"
FOR EACH ROW EXECUTE FUNCTION "reject_issue_comment_mutation"();
