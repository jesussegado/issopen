ALTER TYPE "public"."agent_scope_value" ADD VALUE 'questions:write' BEFORE 'issues:claim';--> statement-breakpoint
CREATE TABLE "issue_question" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"prompt" text NOT NULL,
	"recommendation" text NOT NULL,
	"options" jsonb NOT NULL,
	"recommended_option_id" text NOT NULL,
	"blocking" boolean DEFAULT true NOT NULL,
	"answer_option_id" text,
	"answer_other_text" text,
	"answered_by_user_id" text,
	"answered_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_question_version_check" CHECK ("issue_question"."version" > 0),
	CONSTRAINT "issue_question_answer_consistency_check" CHECK ((
        "issue_question"."answer_option_id" is null and
        "issue_question"."answer_other_text" is null and
        "issue_question"."answered_by_user_id" is null and
        "issue_question"."answered_at" is null
      ) or (
        (("issue_question"."answer_option_id" is not null and "issue_question"."answer_other_text" is null) or
         ("issue_question"."answer_option_id" is null and "issue_question"."answer_other_text" is not null)) and
        "issue_question"."answered_by_user_id" is not null and
        "issue_question"."answered_at" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "issue_question" ADD CONSTRAINT "issue_question_answered_by_user_id_user_id_fk" FOREIGN KEY ("answered_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_question" ADD CONSTRAINT "issue_question_issue_workspace_fk" FOREIGN KEY ("issue_id","workspace_id") REFERENCES "public"."issue"("id","workspace_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "issue_question_id_workspace_uidx" ON "issue_question" USING btree ("id","workspace_id");--> statement-breakpoint
CREATE INDEX "issue_question_issue_created_idx" ON "issue_question" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issue_question_workspace_id_idx" ON "issue_question" USING btree ("workspace_id");