import { randomUUID } from "node:crypto";
import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import { commentColumns, publicComment } from "../comment-projection.js";
import { issueComment, issueQuestion } from "../db/schema.js";
import { recipientColumns } from "../question-recipient-projection.js";
import {
  type AddIssueCommentInput,
  type AnswerIssueQuestionInput,
  addIssueCommentSchema,
  answerIssueQuestionSchema,
  type CreateIssueQuestionInput,
  createIssueQuestionSchema,
  type MutationContext,
  mutationContextSchema,
} from "./contracts.js";
import { DomainError } from "./errors.js";
import {
  assertExpectedVersion,
  lockActiveIssue,
  recordActivity,
} from "./tracker-mutations.js";
import {
  parseTrackerInput as parseInput,
  requireHuman,
  TrackerCapability,
  type TrackerDatabase,
} from "./tracker-support.js";

export function summarizeQuestions(
  questions: Array<typeof issueQuestion.$inferSelect>,
  viewerId?: string,
) {
  const answered = questions.filter((item) => item.answeredAt !== null).length;
  const unansweredBlocking = questions.filter(
    (item) => item.blocking && item.answeredAt === null,
  ).length;
  return {
    total: questions.length,
    answered,
    unansweredBlocking,
    ...(viewerId
      ? {
          directedUnanswered: questions.filter(
            (question) =>
              question.recipientUserId === viewerId && !question.answeredAt,
          ).length,
        }
      : {}),
  };
}

export class TrackerDiscussionCapability extends TrackerCapability {
  constructor(
    db: TrackerDatabase,
    private readonly getIssue: (
      workspaceId: string,
      issueId: string,
    ) => Promise<unknown>,
  ) {
    super(db);
  }
  async listIssueComments(workspaceId: string, issueId: string) {
    await this.getIssue(workspaceId, issueId);
    return this.db
      .select(commentColumns)
      .from(issueComment)
      .where(
        and(
          eq(issueComment.workspaceId, workspaceId),
          eq(issueComment.issueId, issueId),
        ),
      )
      .orderBy(asc(issueComment.createdAt), asc(issueComment.id));
  }

  async addIssueComment(
    contextInput: MutationContext,
    issueId: string,
    input: AddIssueCommentInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    const values = parseInput(addIssueCommentSchema, input);

    return this.transaction(async (tx) => {
      const currentIssue = await lockActiveIssue(
        tx,
        context.workspaceId,
        issueId,
      );

      const [created] = await tx
        .insert(issueComment)
        .values({
          id: randomUUID(),
          workspaceId: context.workspaceId,
          issueId,
          body: values.body,
          authorType: context.actor.type,
          authorId: context.actor.id,
          authorDisplayName: context.actor.displayName,
          source: context.source,
        })
        .returning();
      if (!created) throw new Error("Issue comment insert returned no row");

      await recordActivity(tx, context, {
        projectId: currentIssue.projectId,
        issueId,
        type: "issue.comment_added",
        summary: `Commented on ${currentIssue.key}`,
        changes: { commentId: created.id },
      });
      return publicComment(created);
    });
  }

  async listIssueQuestions(workspaceId: string, issueId: string) {
    await this.getIssue(workspaceId, issueId);
    return this.db
      .select({ ...getTableColumns(issueQuestion), ...recipientColumns })
      .from(issueQuestion)
      .where(
        and(
          eq(issueQuestion.workspaceId, workspaceId),
          eq(issueQuestion.issueId, issueId),
        ),
      )
      .orderBy(asc(issueQuestion.createdAt), asc(issueQuestion.id));
  }

  async createIssueQuestion(
    contextInput: MutationContext,
    issueId: string,
    input: CreateIssueQuestionInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    const values = parseInput(createIssueQuestionSchema, input);

    return this.transaction(async (tx) => {
      const currentIssue = await lockActiveIssue(
        tx,
        context.workspaceId,
        issueId,
      );

      const options = values.options.map((option) => ({
        id: randomUUID(),
        label: option.label,
        description: option.description,
      }));
      const recommended = options[values.recommendedOptionIndex];
      if (!recommended) {
        throw new DomainError("invalid", "Recommended option is invalid");
      }
      const [created] = await tx
        .insert(issueQuestion)
        .values({
          id: randomUUID(),
          workspaceId: context.workspaceId,
          issueId,
          prompt: values.prompt,
          recommendation: values.recommendation,
          options,
          recommendedOptionId: recommended.id,
          blocking: values.blocking,
        })
        .returning();
      if (!created) throw new Error("Issue question insert returned no row");

      await recordActivity(tx, context, {
        projectId: currentIssue.projectId,
        issueId,
        type: "issue.question_added",
        summary: `Added ${created.blocking ? "a blocking" : "an advisory"} question to ${currentIssue.key}`,
        changes: {
          questionId: created.id,
          blocking: created.blocking,
          prompt: created.prompt,
        },
      });
      return created;
    });
  }

  async answerIssueQuestion(
    contextInput: MutationContext,
    issueId: string,
    questionId: string,
    input: AnswerIssueQuestionInput,
  ) {
    const context = parseInput(mutationContextSchema, contextInput);
    requireHuman(context);
    const answer = parseInput(answerIssueQuestionSchema, input);

    return this.transaction(async (tx) => {
      const currentIssue = await lockActiveIssue(
        tx,
        context.workspaceId,
        issueId,
      );

      const [current] = await tx
        .select()
        .from(issueQuestion)
        .where(
          and(
            eq(issueQuestion.workspaceId, context.workspaceId),
            eq(issueQuestion.issueId, issueId),
            eq(issueQuestion.id, questionId),
          ),
        )
        .limit(1);
      if (!current) throw new DomainError("not_found", "Question not found");

      assertExpectedVersion(
        current.version,
        answer.expectedVersion,
        "This answer changed. Compare the latest response before saving your draft.",
      );

      if (
        answer.kind === "option" &&
        !current.options.some((option) => option.id === answer.optionId)
      ) {
        throw new DomainError("invalid", "Answer option is not available", [
          {
            field: "optionId",
            message: "Choose one of this question's options",
          },
        ]);
      }

      const next =
        answer.kind === "option"
          ? { answerOptionId: answer.optionId, answerOtherText: null }
          : { answerOptionId: null, answerOtherText: answer.text };
      if (
        current.answerOptionId === next.answerOptionId &&
        current.answerOtherText === next.answerOtherText
      ) {
        return current;
      }

      const answeredAt = new Date();
      const [updated] = await tx
        .update(issueQuestion)
        .set({
          ...next,
          answeredByUserId: context.actor.id,
          answeredAt,
          version: sql`${issueQuestion.version} + 1`,
          updatedAt: answeredAt,
        })
        .where(
          and(
            eq(issueQuestion.workspaceId, context.workspaceId),
            eq(issueQuestion.issueId, issueId),
            eq(issueQuestion.id, questionId),
          ),
        )
        .returning();
      if (!updated) throw new DomainError("not_found", "Question not found");

      await recordActivity(tx, context, {
        projectId: currentIssue.projectId,
        issueId,
        type: current.answeredAt
          ? "issue.question_answer_changed"
          : "issue.question_answered",
        summary: `${current.answeredAt ? "Changed an answer" : "Answered a question"} on ${currentIssue.key}`,
        changes: {
          questionId,
          answer: {
            from: current.answerOptionId
              ? { kind: "option", optionId: current.answerOptionId }
              : current.answerOtherText
                ? { kind: "other", text: current.answerOtherText }
                : null,
            to:
              answer.kind === "option"
                ? { kind: "option", optionId: answer.optionId }
                : { kind: "other", text: answer.text },
          },
        },
      });
      return updated;
    });
  }
}
