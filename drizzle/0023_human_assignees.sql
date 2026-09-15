ALTER TABLE "issue" ADD COLUMN "human_assignee_id" text;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "human_assignee_name" varchar(120);--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_human_assignee_id_user_id_fk" FOREIGN KEY ("human_assignee_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_project_assignee_idx" ON "issue" USING btree ("project_id","human_assignee_id");--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_assignee_consistency_check" CHECK (("issue"."human_assignee_id" is null) = ("issue"."human_assignee_name" is null));