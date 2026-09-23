import { sql } from "drizzle-orm";
import { issueQuestion } from "./db/schema.js";

export const recipientCanAnswer = sql<boolean>`exists (
  select 1 from issue qi join workspace_membership m on m.workspace_id = qi.workspace_id
  join workspace w on w.id = qi.workspace_id
  where qi.id = "issue_question"."issue_id" and qi.workspace_id = "issue_question"."workspace_id"
  and m.user_id = "issue_question"."recipient_user_id"
  and ((m.role = 'owner' and w.owner_id = m.user_id) or
    (m.role = 'member' and exists (select 1 from project_membership p
      where p.workspace_id = m.workspace_id and p.project_id = qi.project_id
      and p.user_id = m.user_id and p.permission = 'edit'))))`;

export const recipientColumns = {
  recipientUserId: issueQuestion.recipientUserId,
  recipientName: sql<string | null>`case when ${recipientCanAnswer}
    then coalesce((select u.name from "user" u where u.id = "issue_question"."recipient_user_id"), "issue_question"."recipient_name")
    else "issue_question"."recipient_name" end`,
  recipientCanAnswer,
};
