import type { FormEvent } from "react";
import type {
  Epic,
  Issue,
  IssueQuestion,
  QuestionSummary,
} from "../../types.js";
import { QuestionRecipientEditor } from "../QuestionRecipientEditor.js";
import { AppLink, Button, Field, StatusBanner, TextArea } from "../ui.js";
import { formatDetailTimestamp } from "./presentation.js";

type RecipientSnapshot = {
  issue: Issue;
  questions: IssueQuestion[];
  questionSummary: QuestionSummary;
};

export function QuestionsPanel({
  issue,
  epic,
  questions,
  summary,
  currentQuestion,
  questionIndex,
  pendingEpicIssues,
  currentEpicQuestionIndex,
  previousEpicQuestionIssue,
  nextEpicQuestionIssue,
  answerKind,
  answerOptionId,
  answerOtherText,
  questionError,
  recipientDirty,
  canEdit,
  online,
  submitting,
  onQuestionIndexChange,
  onRecipientDirty,
  onRecipientSaved,
  onOptionChange,
  onOtherSelect,
  onOtherTextChange,
  onSubmit,
}: {
  issue: Issue;
  epic: Epic | null;
  questions: IssueQuestion[];
  summary: QuestionSummary;
  currentQuestion: IssueQuestion | null;
  questionIndex: number;
  pendingEpicIssues: Issue[];
  currentEpicQuestionIndex: number;
  previousEpicQuestionIssue: Issue | null;
  nextEpicQuestionIssue: Issue | null;
  answerKind: "option" | "other";
  answerOptionId: string;
  answerOtherText: string;
  questionError: string | null;
  recipientDirty: boolean;
  canEdit: boolean;
  online: boolean;
  submitting: string | null;
  onQuestionIndexChange: (index: number) => void;
  onRecipientDirty: (dirty: boolean) => void;
  onRecipientSaved: (snapshot: RecipientSnapshot) => void;
  onOptionChange: (optionId: string) => void;
  onOtherSelect: () => void;
  onOtherTextChange: (text: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section
      className="detail-panel question-panel"
      aria-labelledby="questions-heading"
    >
      <div className="question-heading">
        <div>
          <h2 id="questions-heading" tabIndex={-1}>
            Questions
          </h2>
          {(summary.directedUnanswered ?? 0) > 0 ? (
            <p className="warning-badge">
              ⚠ {summary.directedUnanswered} unanswered for you
            </p>
          ) : null}
          <p className="metadata" aria-live="polite">
            {summary.answered} of {summary.total} answered
          </p>
        </div>
        {summary.unansweredBlocking > 0 ? (
          <span className="badge warning-badge">
            ⚠ {summary.unansweredBlocking} blocking
          </span>
        ) : null}
      </div>
      {epic && pendingEpicIssues.length > 0 ? (
        <nav
          className="epic-question-navigation"
          aria-label="Tickets with unanswered questions in this Epic"
        >
          {currentEpicQuestionIndex >= 0 ? (
            <>
              {previousEpicQuestionIssue ? (
                <AppLink
                  className="button button-secondary"
                  href={`/issues/${previousEpicQuestionIssue.id}#questions-heading`}
                >
                  Previous ticket
                </AppLink>
              ) : (
                <Button type="button" variant="secondary" disabled>
                  Previous ticket
                </Button>
              )}
              <span className="metadata">
                {currentEpicQuestionIndex + 1} of {pendingEpicIssues.length}{" "}
                tickets with unanswered questions
              </span>
              {nextEpicQuestionIssue ? (
                <AppLink
                  className="button button-secondary"
                  href={`/issues/${nextEpicQuestionIssue.id}#questions-heading`}
                >
                  Next ticket
                </AppLink>
              ) : (
                <Button type="button" variant="secondary" disabled>
                  Next ticket
                </Button>
              )}
            </>
          ) : (
            <>
              <span className="metadata">
                {pendingEpicIssues.length}{" "}
                {pendingEpicIssues.length === 1
                  ? "ticket still needs"
                  : "tickets still need"}{" "}
                answers in this Epic.
              </span>
              <AppLink
                className="button button-secondary"
                href={`/issues/${pendingEpicIssues[0]?.id}#questions-heading`}
              >
                Next unanswered ticket
              </AppLink>
            </>
          )}
        </nav>
      ) : null}
      {!currentQuestion ? (
        <p className="metadata">No questions on this ticket.</p>
      ) : (
        <form className="form-stack" onSubmit={onSubmit}>
          <div className="question-navigation">
            <Button
              type="button"
              variant="secondary"
              disabled={
                questionIndex === 0 ||
                submitting === "question" ||
                recipientDirty
              }
              onClick={() => onQuestionIndexChange(questionIndex - 1)}
            >
              Previous
            </Button>
            <span>
              Question {questionIndex + 1} of {questions.length}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={
                questionIndex === questions.length - 1 ||
                recipientDirty ||
                submitting === "question"
              }
              onClick={() => onQuestionIndexChange(questionIndex + 1)}
            >
              Next
            </Button>
          </div>
          <QuestionRecipientEditor
            key={currentQuestion.id}
            issue={issue}
            question={currentQuestion}
            questions={questions}
            canEdit={canEdit && !epic?.archivedAt}
            onDirty={onRecipientDirty}
            onSaved={onRecipientSaved}
          />
          <fieldset
            className="question-fieldset"
            disabled={!canEdit || submitting !== null || recipientDirty}
          >
            <legend>{currentQuestion.prompt}</legend>
            <div className="recommendation">
              <strong>Recommendation</strong>
              <p>{currentQuestion.recommendation}</p>
            </div>
            {currentQuestion.options.map((option) => (
              <label className="answer-option" key={option.id}>
                <input
                  type="radio"
                  name={`answer-${currentQuestion.id}`}
                  value={option.id}
                  checked={
                    answerKind === "option" && answerOptionId === option.id
                  }
                  onChange={() => onOptionChange(option.id)}
                />
                <span>
                  <strong>{option.label}</strong>{" "}
                  {option.id === currentQuestion.recommendedOptionId ? (
                    <span className="badge">Recommended</span>
                  ) : null}
                  {option.description ? (
                    <span className="option-description">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
            <label className="answer-option">
              <input
                type="radio"
                name={`answer-${currentQuestion.id}`}
                value="other"
                checked={answerKind === "other"}
                onChange={onOtherSelect}
              />
              <span>
                <strong>Other</strong>
              </span>
            </label>
            {answerKind === "other" ? (
              <Field label="Your answer" htmlFor="other-answer" required>
                <TextArea
                  id="other-answer"
                  required
                  maxLength={5000}
                  value={answerOtherText}
                  onChange={(event) =>
                    onOtherTextChange(event.currentTarget.value)
                  }
                />
              </Field>
            ) : null}
          </fieldset>
          {questionError ? (
            <StatusBanner error focus>
              {questionError}
            </StatusBanner>
          ) : null}
          <div className="inline-actions">
            {canEdit ? (
              <Button
                type="submit"
                disabled={!online || submitting !== null || recipientDirty}
              >
                {submitting === "question"
                  ? "Saving…"
                  : currentQuestion.answeredAt
                    ? "Change answer"
                    : "Save answer"}
              </Button>
            ) : null}
            {currentQuestion.answeredAt ? (
              <span className="metadata">
                Answered {formatDetailTimestamp(currentQuestion.answeredAt)}
              </span>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
