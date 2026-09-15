ALTER TABLE "issue_question" ADD COLUMN "recipient_user_id" text;--> statement-breakpoint
ALTER TABLE "issue_question" ADD COLUMN "recipient_name" varchar(120);--> statement-breakpoint
ALTER TABLE "issue_question" ADD CONSTRAINT "issue_question_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_question_recipient_idx" ON "issue_question" USING btree ("recipient_user_id","issue_id");--> statement-breakpoint
ALTER TABLE "issue_question" ADD CONSTRAINT "issue_question_recipient_consistency_check" CHECK (("issue_question"."recipient_user_id" is null) = ("issue_question"."recipient_name" is null));