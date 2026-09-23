import type { IssueDetailSnapshot } from "../../lib/issue-detail-snapshot.js";
import type { IssueQuestion } from "../../types.js";
import { issueLabel, statusLabels } from "../../types.js";
import { Button, StatusBanner } from "../ui.js";

export function RemoteChangesPanel({
  snapshot,
  currentQuestion,
  comparing,
  answerDirty,
  busy,
  onToggleComparison,
  onApply,
}: {
  snapshot: IssueDetailSnapshot;
  currentQuestion: IssueQuestion | null;
  comparing: boolean;
  answerDirty: boolean;
  busy: boolean;
  onToggleComparison: () => void;
  onApply: () => void;
}) {
  const questionRemoved =
    answerDirty &&
    currentQuestion &&
    !snapshot.questions.some((question) => question.id === currentQuestion.id);
  return (
    <section className="detail-panel form-stack" aria-label="Remote changes">
      <StatusBanner>
        New changes are available. Your unsaved drafts have been kept.
      </StatusBanner>
      <Button variant="secondary" disabled={busy} onClick={onToggleComparison}>
        {comparing ? "Hide comparison" : "Compare latest changes"}
      </Button>
      {comparing ? (
        <div className="form-stack">
          <h2>Latest saved version</h2>
          <p>
            {issueLabel(snapshot.issue)} · {statusLabels[snapshot.issue.status]}
          </p>
          <p className="description">
            {snapshot.issue.description || "No description"}
          </p>
          <p>
            {snapshot.comments.length} comments ·{" "}
            {snapshot.questionSummary.answered} of{" "}
            {snapshot.questionSummary.total} questions answered
          </p>
          {currentQuestion ? (
            <p className="description">
              Saved answer: {(() => {
                const question = snapshot.questions.find(
                  (item) => item.id === currentQuestion.id,
                );
                return question
                  ? (question.answerOtherText ??
                      question.options.find(
                        (option) => option.id === question.answerOptionId,
                      )?.label ??
                      "Not answered")
                  : "Question no longer available";
              })()}
            </p>
          ) : null}
        </div>
      ) : null}
      {questionRemoved ? (
        <StatusBanner error>
          This question is no longer available. Copy your draft before reloading
          this page.
        </StatusBanner>
      ) : (
        <Button disabled={busy || !comparing} onClick={onApply}>
          Load latest changes and keep my drafts
        </Button>
      )}
    </section>
  );
}
