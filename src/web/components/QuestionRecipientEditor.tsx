import { useEffect, useState } from "react";
import { ApiError, apiRequest } from "../lib/api.js";
import type { Issue, IssueQuestion, QuestionSummary } from "../types.js";
import { CollaboratorPicker } from "./CollaboratorPicker.js";

type Snapshot = {
  issue: Issue;
  questions: IssueQuestion[];
  questionSummary: QuestionSummary;
};
export function QuestionRecipientLabel({
  question,
}: {
  question: IssueQuestion;
}) {
  return (
    <p className="metadata assignee-label">
      Question for:{" "}
      {question.recipientUserId
        ? question.recipientName || "Collaborator"
        : "Any editor"}
      {question.recipientUserId && question.recipientCanAnswer === false ? (
        <strong className="warning-badge">
          {" "}
          ⚠ Recipient can no longer answer here. Another editor can answer or
          change the recipient.
        </strong>
      ) : null}
    </p>
  );
}

export function QuestionRecipientEditor({
  issue,
  question,
  questions,
  canEdit,
  onDirty,
  onSaved,
}: {
  issue: Issue;
  question: IssueQuestion;
  questions: IssueQuestion[];
  canEdit: boolean;
  onDirty: (dirty: boolean) => void;
  onSaved: (snapshot: Snapshot) => void;
}) {
  const [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [snapshot, setSnapshot] = useState({
    version: issue.version,
    questions: [] as { id: string; version: number }[],
  });
  const [conflict, setConflict] = useState(false),
    [error, setError] = useState("");
  const [comparison, setComparison] = useState<Snapshot | null>(null);
  useEffect(() => {
    onDirty(editing);
  }, [editing, onDirty]);
  useEffect(() => {
    if (!editing) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const data = await apiRequest<Snapshot>(
        `/api/v1/issues/${issue.id}/questions/${question.id}/recipient`,
        {
          method: "PUT",
          body: JSON.stringify({
            recipientId: target?.id ?? null,
            expectedVersion: snapshot.version,
            questionVersions: snapshot.questions,
          }),
        },
      );
      onSaved(data);
      setEditing(false);
      setComparison(null);
    } catch (caught) {
      setConflict(caught instanceof ApiError && caught.status === 409);
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not save the recipient. Your selection is kept; try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function compare() {
    setBusy(true);
    setError("");
    try {
      const current = await apiRequest<Snapshot>(`/api/v1/issues/${issue.id}`);
      if (!current.questions.some((q) => q.id === question.id))
        throw new Error("missing");
      setComparison(current);
      setSnapshot({
        version: current.issue.version,
        questions: current.questions.map((q) => ({
          id: q.id,
          version: q.version,
        })),
      });
      setConflict(false);
    } catch {
      setError(
        "Could not load the current question. Your selection is kept; check access and retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="recipient-panel" aria-label="Question recipient">
      <QuestionRecipientLabel question={question} />
      <p className="metadata">
        Optional recipient, not an exclusive reviewer. Any project editor may
        answer and review; the actual author is recorded.
      </p>
      {!editing ? (
        canEdit ? (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setTarget(
                question.recipientUserId
                  ? {
                      id: question.recipientUserId,
                      name: question.recipientName ?? "Collaborator",
                    }
                  : null,
              );
              setSnapshot({
                version: issue.version,
                questions: questions.map((q) => ({
                  id: q.id,
                  version: q.version,
                })),
              });
              setComparison(null);
              setConflict(false);
              setError("");
              setEditing(true);
            }}
          >
            Change recipient
          </button>
        ) : null
      ) : (
        <div className="form-stack">
          <p role="status">
            Selected recipient: {target?.name ?? "Any editor"}
          </p>
          {!canEdit ? (
            <p role="alert">
              You can no longer edit here. Your selection is kept.
            </p>
          ) : null}
          <CollaboratorPicker
            projectId={issue.projectId}
            disabled={busy || !canEdit}
            requireEdit
            onChoose={(person) => setTarget(person)}
          />
          <button
            className="button button-secondary"
            type="button"
            disabled={busy || !canEdit}
            onClick={() => setTarget(null)}
          >
            Open question to any editor
          </button>
          {error ? <p role="alert">{error}</p> : null}
          {conflict ? (
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => void compare()}
            >
              Compare current question recipients
            </button>
          ) : null}
          {comparison ? (
            <div className="comparison-panel">
              <p>
                Current saved ticket: {comparison.issue.title} ·{" "}
                {comparison.issue.status}
              </p>
              {comparison.questions.map((q) => (
                <div key={q.id}>
                  <strong>{q.prompt}</strong>
                  <QuestionRecipientLabel question={q} />
                  <p>
                    {q.answerOtherText ??
                      q.options.find((option) => option.id === q.answerOptionId)
                        ?.label ??
                      "Unanswered"}
                  </p>
                </div>
              ))}
              <p>
                Your selection above is unchanged. Review these answers before
                saving.
              </p>
            </div>
          ) : null}
          <div className="page-actions">
            <button
              className="button"
              type="button"
              disabled={busy || conflict || !canEdit}
              onClick={() => void save()}
            >
              Save recipient
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel recipient change
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
