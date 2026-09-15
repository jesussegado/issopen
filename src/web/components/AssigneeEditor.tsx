import { useEffect, useState } from "react";
import { ApiError, apiRequest } from "../lib/api.js";
import type { Issue, IssueQuestion } from "../types.js";
import { CollaboratorPicker } from "./CollaboratorPicker.js";

export function AssigneeLabel({ issue }: { issue: Issue }) {
  return (
    <p className="metadata assignee-label">
      Human:{" "}
      {issue.humanAssigneeId
        ? issue.humanAssigneeName || "Assigned collaborator"
        : "Unassigned"}
      {issue.humanAssigneeId && issue.humanAssigneeHasAccess === false ? (
        <strong className="warning-badge">
          {" "}
          ⚠ No longer has project access
        </strong>
      ) : null}
    </p>
  );
}

export function AssigneeEditor({
  issue,
  questions,
  canEdit,
  onDirty,
  onSaved,
}: {
  issue: Issue;
  questions: IssueQuestion[];
  canEdit: boolean;
  onDirty: (dirty: boolean) => void;
  onSaved: (issue: Issue) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [version, setVersion] = useState(issue.version);
  const [questionVersions, setQuestionVersions] = useState<
    { id: string; version: number }[]
  >([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [comparison, setComparison] = useState<Issue | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<IssueQuestion[]>([]);
  useEffect(() => {
    onDirty(editing);
  }, [editing, onDirty]);
  useEffect(() => {
    if (!editing) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ issue: Issue }>(
        `/api/v1/issues/${issue.id}/assignee`,
        {
          method: "PUT",
          body: JSON.stringify({
            assigneeId: target?.id ?? null,
            expectedVersion: version,
            questionVersions,
          }),
        },
      );
      onSaved(result.issue);
      setEditing(false);
      setComparison(null);
    } catch (caught) {
      setConflict(caught instanceof ApiError && caught.status === 409);
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not save the assignment. Your selection is kept; try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function compare() {
    setBusy(true);
    setError("");
    try {
      const latest = await apiRequest<{
        issue: Issue;
        questions: IssueQuestion[];
      }>(`/api/v1/issues/${issue.id}`);
      setComparison(latest.issue);
      setVersion(latest.issue.version);
      setCurrentQuestions(latest.questions);
      setQuestionVersions(
        latest.questions.map((q) => ({ id: q.id, version: q.version })),
      );
      setConflict(false);
    } catch {
      setError(
        "Could not load the current assignment. Your selection is kept.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-panel" aria-label="Human assignment">
      <h2>Human assignee</h2>
      <AssigneeLabel issue={issue} />
      <p className="metadata">
        Assignment does not grant access or change the workspace owner or agent
        claim.
      </p>
      {!editing ? (
        canEdit ? (
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setTarget(
                issue.humanAssigneeId
                  ? {
                      id: issue.humanAssigneeId,
                      name: issue.humanAssigneeName ?? "Collaborator",
                    }
                  : null,
              );
              setVersion(issue.version);
              setQuestionVersions(
                questions.map((q) => ({ id: q.id, version: q.version })),
              );
              setError("");
              setConflict(false);
              setComparison(null);
              setEditing(true);
            }}
          >
            Change assignee
          </button>
        ) : null
      ) : (
        <div className="form-stack">
          <p role="status">Selected: {target?.name ?? "Unassigned"}</p>
          {!canEdit ? (
            <p role="alert">
              This ticket is no longer editable. Your selection has been kept.
            </p>
          ) : null}
          <CollaboratorPicker
            projectId={issue.projectId}
            disabled={busy || !canEdit}
            onChoose={(person) => setTarget(person)}
          />
          <button
            type="button"
            className="button button-secondary"
            disabled={busy || !canEdit}
            onClick={() => setTarget(null)}
          >
            Choose unassigned
          </button>
          {error ? <p role="alert">{error}</p> : null}
          {conflict ? (
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => void compare()}
            >
              Load current assignment to compare
            </button>
          ) : null}
          {comparison ? (
            <div className="comparison-panel">
              <p>Current saved assignment</p>
              <AssigneeLabel issue={comparison} />
              <p>
                {comparison.title} · {comparison.status}
              </p>
              <p>
                Your selection above is unchanged. Review the current ticket and
                answers before saving.
              </p>
              {currentQuestions.map((question) => (
                <div key={question.id}>
                  <strong>{question.prompt}</strong>
                  <p>
                    {question.answerOtherText ??
                      question.options.find(
                        (option) => option.id === question.answerOptionId,
                      )?.label ??
                      "Unanswered"}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="page-actions">
            <button
              className="button"
              type="button"
              disabled={busy || conflict || !canEdit}
              onClick={() => void save()}
            >
              Save assignee
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setError("");
              }}
            >
              Cancel assignment
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
