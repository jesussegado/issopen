import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AssigneeEditor } from "../components/AssigneeEditor.js";
import { CaptureEvidence } from "../components/CaptureEvidence.js";
import { DeleteIssueButton } from "../components/DeleteIssueButton.js";
import {
  AppLink,
  Badge,
  Button,
  Field,
  OfflineBanner,
  PageHeading,
  Select,
  Skeleton,
  StatusBanner,
  TextArea,
  TextInput,
} from "../components/ui.js";
import { ApiError, apiRequest, unavailable } from "../lib/api.js";
import { useOnlineStatus } from "../lib/online.js";
import { subscribeToProjectChanges } from "../lib/project-live.js";
import type {
  Activity,
  CodeLink,
  CodeLinkType,
  Epic,
  Issue,
  IssueComment,
  IssueQuestion,
  IssueStatus,
  Project,
  QuestionSummary,
  Session,
} from "../types.js";
import {
  codeLinkLabels,
  codeLinkTypes,
  epicLabel,
  issueActivitySummary,
  issueLabel,
  issueReference,
  issueStatuses,
  priorityLabels,
  statusLabels,
} from "../types.js";
import { UnavailableRoute } from "./TrackerForms.js";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function actorLabel(activity: Activity, viewerId: string) {
  if (activity.actorType === "human")
    return activity.actorId === viewerId
      ? "You"
      : activity.actorDisplayName || "Workspace member";
  if (activity.actorType === "agent")
    return `Agent · ${activity.actorDisplayName}`;
  return "System";
}

function commentAuthorLabel(comment: IssueComment, viewerId: string) {
  if (comment.authorType === "human")
    return comment.authorId === viewerId
      ? "You"
      : comment.authorDisplayName || "Workspace member";
  if (comment.authorType === "agent")
    return `Agent · ${comment.authorDisplayName}`;
  return "System";
}

const sourceLabels: Record<Activity["source"], string> = {
  chrome_extension: "Chrome extension",
  rest: "Web",
  mcp: "MCP",
  system: "System",
  operator: "Operator",
};

function newestFirst<T extends { id: string; createdAt: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
}

type DetailSnapshot = {
  issue: Issue;
  epic: Epic | null;
  codeLinks: CodeLink[];
  comments: IssueComment[];
  questions: IssueQuestion[];
  questionSummary: QuestionSummary;
  activity: Activity[];
  project: Project;
};

async function readDetailSnapshot(
  issueId: string,
  signal?: AbortSignal,
): Promise<DetailSnapshot> {
  const options = { cache: "no-store" as const, ...(signal ? { signal } : {}) };
  const [detail, activity] = await Promise.all([
    apiRequest<Omit<DetailSnapshot, "activity" | "project">>(
      `/api/v1/issues/${issueId}`,
      options,
    ),
    apiRequest<{ activity: Activity[] }>(
      `/api/v1/issues/${issueId}/activity`,
      options,
    ),
  ]);
  const { project } = await apiRequest<{ project: Project }>(
    `/api/v1/projects/${detail.issue.projectId}`,
    options,
  );
  return {
    issue: detail.issue,
    epic: detail.epic ?? null,
    codeLinks: detail.codeLinks ?? [],
    comments: detail.comments ?? [],
    questions: detail.questions ?? [],
    questionSummary: detail.questionSummary,
    activity: activity.activity,
    project,
  };
}

export function IssueDetailRoute({
  issueId,
  session,
}: {
  issueId: string;
  session: Session;
}) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [epic, setEpic] = useState<Epic | null>(null);
  const [links, setLinks] = useState<CodeLink[]>([]);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [questions, setQuestions] = useState<IssueQuestion[]>([]);
  const [questionSummary, setQuestionSummary] = useState<QuestionSummary>({
    total: 0,
    answered: 0,
    unansweredBlocking: 0,
  });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answerKind, setAnswerKind] = useState<"option" | "other">("option");
  const [answerOptionId, setAnswerOptionId] = useState("");
  const [answerOtherText, setAnswerOtherText] = useState("");
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(() =>
    new URLSearchParams(window.location.search).get("notice"),
  );
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<CodeLinkType>("branch");
  const [linkUrl, setLinkUrl] = useState("");
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [reason, setReason] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [answerDirty, setAnswerDirty] = useState(false);
  const [assigneeDirty, setAssigneeDirty] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<DetailSnapshot | null>(
    null,
  );
  const [liveError, setLiveError] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mutationEpoch = useRef(0);
  const preservedAnswerId = useRef<string | null>(null);
  const scope = `${session.user.id}:${session.workspace?.id}:${issueId}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const state = useRef({
    dirty: false,
    submitting: false,
    questionId: "",
    signature: "",
    issueVersion: 0,
    questions: [] as IssueQuestion[],
    commentIds: [] as string[],
    linkIds: [] as string[],
  });
  state.current = {
    dirty:
      answerDirty ||
      assigneeDirty ||
      commentBody !== "" ||
      linkUrl !== "" ||
      reason !== "" ||
      requestingChanges,
    submitting: submitting !== null,
    questionId: questions[questionIndex]?.id ?? "",
    signature: JSON.stringify({
      issue,
      epic,
      codeLinks: links,
      comments,
      questions,
      questionSummary,
      activity,
      project,
    }),
    issueVersion: issue?.version ?? 0,
    questions,
    commentIds: comments.map((item) => item.id),
    linkIds: links.map((item) => item.id),
  };
  const online = useOnlineStatus();
  const newestActivityFirst = useMemo(() => newestFirst(activity), [activity]);
  const newestCommentsFirst = useMemo(() => newestFirst(comments), [comments]);

  const refreshActivity = useCallback(async () => {
    const response = await apiRequest<{ activity: Activity[] }>(
      `/api/v1/issues/${issueId}/activity`,
    );
    setActivity(response.activity);
  }, [issueId]);

  const applySnapshot = useCallback((snapshot: DetailSnapshot) => {
    const selected = snapshot.questions.findIndex(
      (q) => q.id === state.current.questionId,
    );
    setQuestionIndex(selected >= 0 ? selected : 0);
    setIssue(snapshot.issue);
    setEpic(snapshot.epic);
    setLinks(snapshot.codeLinks);
    setComments(snapshot.comments);
    setQuestions(snapshot.questions);
    setQuestionSummary(snapshot.questionSummary);
    setActivity(snapshot.activity);
    setProject(snapshot.project);
    setPendingSnapshot(null);
    setComparing(false);
    setLiveError(false);
  }, []);

  const clearAccess = useCallback(() => {
    setMissing(true);
    setIssue(null);
    setQuestions([]);
    setComments([]);
    setLinks([]);
    setActivity([]);
    setPendingSnapshot(null);
    setCommentBody("");
    setAnswerOtherText("");
    setAnswerOptionId("");
    setLinkUrl("");
    setReason("");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setMissing(false);
    setCommentBody("");
    setLinkUrl("");
    setReason("");
    setRequestingChanges(false);
    setAnswerDirty(false);
    setPendingSnapshot(null);
    void readDetailSnapshot(issueId, controller.signal)
      .then((snapshot) => {
        if (!controller.signal.aborted && scopeRef.current === scope)
          applySnapshot(snapshot);
      })
      .catch((caught) => {
        if (controller.signal.aborted || scopeRef.current !== scope) return;
        if (unavailable(caught)) clearAccess();
        else
          setError(
            "We couldn't load this issue. Check your connection and try again.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [issueId, scope, applySnapshot, clearAccess]);

  const refreshLiveRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (submitting === null && !loading) refreshLiveRef.current();
  }, [submitting, loading]);
  useEffect(() => {
    if (!issue?.projectId || missing || loading) return;
    let stopped = false;
    let inFlight = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (stopped || inFlight || state.current.submitting) return;
      inFlight = true;
      const epoch = mutationEpoch.current;
      setRefreshing(true);
      try {
        const next = await readDetailSnapshot(issueId, controller.signal);
        if (
          stopped ||
          scopeRef.current !== scope ||
          epoch !== mutationEpoch.current ||
          state.current.submitting
        )
          return;
        setLiveError(false);
        // Effective permissions update even while a content draft is preserved.
        const effectiveEdit = next.project.canEdit;
        if (effectiveEdit !== undefined)
          setProject((previous) =>
            previous ? { ...previous, canEdit: effectiveEdit } : next.project,
          );
        // A late/mixed read must not roll back an already confirmed mutation.
        const current = state.current;
        if (
          next.issue.version < current.issueVersion ||
          current.commentIds.some(
            (id) => !next.comments.some((item) => item.id === id),
          ) ||
          current.linkIds.some(
            (id) => !next.codeLinks.some((item) => item.id === id),
          ) ||
          current.questions.some((q) => {
            const incoming = next.questions.find((item) => item.id === q.id);
            return (
              incoming &&
              (incoming.version < q.version ||
                (incoming.version === q.version &&
                  (incoming.answerOptionId !== q.answerOptionId ||
                    incoming.answerOtherText !== q.answerOtherText)))
            );
          })
        )
          return;
        if (JSON.stringify(next) === state.current.signature) {
          setPendingSnapshot(null);
          return;
        }
        if (state.current.dirty || document.querySelector("dialog[open]"))
          setPendingSnapshot(next);
        else applySnapshot(next);
      } catch (caught) {
        if (stopped || scopeRef.current !== scope) return;
        if (unavailable(caught)) clearAccess();
        else setLiveError(true);
      } finally {
        inFlight = false;
        if (!stopped) setRefreshing(false);
      }
    };
    refreshLiveRef.current = () => void refresh();
    const unsubscribe = subscribeToProjectChanges(
      issue.projectId,
      () => void refresh(),
      () => {
        clearAccess();
        void apiRequest("/api/v1/session").catch(() => {});
      },
    );
    return () => {
      stopped = true;
      controller.abort();
      unsubscribe();
      refreshLiveRef.current = () => {};
    };
  }, [
    issue?.projectId,
    issueId,
    scope,
    missing,
    loading,
    applySnapshot,
    clearAccess,
  ]);

  const currentQuestion = questions[questionIndex] ?? null;
  useEffect(() => {
    if (!currentQuestion) return;
    if (preservedAnswerId.current === currentQuestion.id) {
      preservedAnswerId.current = null;
      return;
    }
    setAnswerDirty(false);
    if (currentQuestion.answerOptionId) {
      setAnswerKind("option");
      setAnswerOptionId(currentQuestion.answerOptionId);
      setAnswerOtherText("");
    } else if (currentQuestion.answerOtherText) {
      setAnswerKind("other");
      setAnswerOptionId("");
      setAnswerOtherText(currentQuestion.answerOtherText);
    } else {
      setAnswerKind("option");
      setAnswerOptionId("");
      setAnswerOtherText("");
    }
    setQuestionError(null);
  }, [currentQuestion]);

  async function updateStatus(status: IssueStatus) {
    if (!issue || issue.status === status) return;
    mutationEpoch.current += 1;
    setSubmitting("status");
    setError(null);
    setNotice(null);
    setAnnouncement("");
    try {
      const response = await apiRequest<{ issue: Issue }>(
        `/api/v1/issues/${issue.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            expectedVersion: issue?.version,
            questionVersions: questions.map(({ id, version }) => ({
              id,
              version,
            })),
          }),
        },
      );
      setIssue({ ...issue, ...response.issue, questionSummary });
      setNotice("Issue updated");
      setAnnouncement(
        `${issueReference(response.issue)} moved to ${statusLabels[response.issue.status]}`,
      );
      await refreshActivity();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? caught.message
          : "We couldn't save your changes. Check your connection and try again.",
      );
    } finally {
      mutationEpoch.current += 1;
      setSubmitting(null);
    }
  }

  async function saveQuestionAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issue || !currentQuestion) return;
    if (answerKind === "option" && !answerOptionId) {
      setQuestionError("Choose an option or select Other.");
      return;
    }
    if (answerKind === "other" && !answerOtherText.trim()) {
      setQuestionError("Add your answer in Other.");
      return;
    }

    mutationEpoch.current += 1;
    setSubmitting("question");
    setQuestionError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{
        question: IssueQuestion;
        questionSummary: QuestionSummary;
      }>(`/api/v1/issues/${issue.id}/questions/${currentQuestion.id}/answer`, {
        method: "PATCH",
        body: JSON.stringify(
          answerKind === "option"
            ? {
                kind: "option",
                optionId: answerOptionId,
                expectedVersion: currentQuestion.version,
              }
            : {
                kind: "other",
                text: answerOtherText,
                expectedVersion: currentQuestion.version,
              },
        ),
      });
      const updatedQuestions = questions.map((question) =>
        question.id === response.question.id ? response.question : question,
      );
      setQuestions(updatedQuestions);
      const nextUnanswered = updatedQuestions.findIndex(
        (question, index) => index > questionIndex && !question.answeredAt,
      );
      const firstUnanswered = updatedQuestions.findIndex(
        (question) => !question.answeredAt,
      );
      if (nextUnanswered !== -1 || firstUnanswered !== -1) {
        setQuestionIndex(
          nextUnanswered !== -1 ? nextUnanswered : firstUnanswered,
        );
      }
      setQuestionSummary(response.questionSummary);
      setIssue((current) =>
        current
          ? { ...current, questionSummary: response.questionSummary }
          : current,
      );
      setNotice(
        currentQuestion.answeredAt ? "Answer changed" : "Question answered",
      );
      setAnnouncement(
        `${response.questionSummary.answered} of ${response.questionSummary.total} questions answered`,
      );
      await refreshActivity();
    } catch (caught) {
      setQuestionError(
        caught instanceof ApiError && caught.status === 409
          ? caught.message
          : caught instanceof ApiError && caught.fields[0]?.message
            ? caught.fields[0].message
            : "We couldn't save this answer. Check your connection and try again.",
      );
    } finally {
      mutationEpoch.current += 1;
      setSubmitting(null);
    }
  }

  async function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issue) return;
    mutationEpoch.current += 1;
    setSubmitting("link");
    setError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{ issue: Issue; codeLink: CodeLink }>(
        `/api/v1/issues/${issue.id}/code-links`,
        {
          method: "POST",
          body: JSON.stringify({ type: linkType, url: linkUrl }),
        },
      );
      setIssue({ ...issue, ...response.issue, questionSummary });
      setLinks((current) => [...current, response.codeLink]);
      setLinkUrl("");
      setNotice("Code link added");
      await refreshActivity();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.fields[0]?.message
          ? caught.fields[0].message
          : "We couldn't save your changes. Check your connection and try again.",
      );
    } finally {
      mutationEpoch.current += 1;
      setSubmitting(null);
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issue || !commentBody.trim()) return;
    mutationEpoch.current += 1;
    setSubmitting("comment");
    setError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{ comment: IssueComment }>(
        `/api/v1/issues/${issue.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({ body: commentBody }),
        },
      );
      setComments((current) => [...current, response.comment]);
      setCommentBody("");
      setNotice("Comment added");
      setAnnouncement(
        `Comment added to ${issueReference(issue)} by ${commentAuthorLabel(response.comment, session.user.id)}`,
      );
      await refreshActivity();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.fields[0]?.message
          ? caught.fields[0].message
          : "We couldn't add this comment. Check your connection and try again.",
      );
    } finally {
      mutationEpoch.current += 1;
      setSubmitting(null);
    }
  }

  async function review(outcome: "accept" | "request") {
    if (!issue) return;
    mutationEpoch.current += 1;
    setSubmitting(outcome);
    setError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{ issue: Issue }>(
        `/api/v1/issues/${issue.id}/review/${outcome === "accept" ? "accept" : "request-changes"}`,
        {
          method: "POST",
          body: JSON.stringify({
            ...(outcome === "request" ? { reason } : {}),
            expectedVersion: issue.version,
            questionVersions: questions.map(({ id, version }) => ({
              id,
              version,
            })),
          }),
        },
      );
      setIssue({ ...issue, ...response.issue });
      setRequestingChanges(false);
      setReason("");
      setNotice(outcome === "accept" ? "Result accepted" : "Changes requested");
      setAnnouncement(
        `${issueReference(response.issue)} moved to ${statusLabels[response.issue.status]}`,
      );
      await refreshActivity();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? caught.message
          : caught instanceof ApiError && caught.fields[0]?.message
            ? caught.fields[0].message
            : "We couldn't save your changes. Check your connection and try again.",
      );
    } finally {
      mutationEpoch.current += 1;
      setSubmitting(null);
    }
  }

  if (loading || (issue && issue.id !== issueId))
    return <Skeleton label="Loading issue…" />;
  if (missing || !issue || !project) return <UnavailableRoute />;
  const canEdit = project.canEdit !== false;
  return (
    <div className="detail-column">
      <div className="page-header">
        <div>
          <div className="issue-metadata">
            <Badge>{priorityLabels[issue.priority]}</Badge>
          </div>
          <PageHeading>{issueLabel(issue)}</PageHeading>
          <div className="issue-metadata">
            <span>
              Owner:{" "}
              {issue.humanOwnerId === session.user.id
                ? "You"
                : "Workspace owner"}
            </span>
            {epic ? (
              <>
                <AppLink
                  className="badge epic-badge"
                  href={`/epics/${epic.id}`}
                >
                  Epic: {epicLabel(epic)}
                </AppLink>
                {epic.archivedAt ? <Badge>Archived Epic</Badge> : null}
              </>
            ) : null}
            {issue.claimedByAgentId ? (
              <Badge>Agent: {issue.claimedByAgentId}</Badge>
            ) : (
              <Badge>Not claimed by an agent</Badge>
            )}
          </div>
        </div>
        <div className="page-actions">
          {canEdit ? (
            <AppLink
              className="button button-secondary"
              href={`/issues/${issue.id}/edit`}
            >
              Edit issue
            </AppLink>
          ) : (
            <Badge>Read-only</Badge>
          )}
          {session.workspace?.role === "owner" &&
          session.workspace.id === issue.workspaceId ? (
            <DeleteIssueButton
              key={issue.id}
              issue={issue}
              questions={questions}
              disabled={submitting !== null}
            />
          ) : null}
        </div>
      </div>
      {notice ? <StatusBanner>{notice}</StatusBanner> : null}
      {!online ? <OfflineBanner /> : null}
      {pendingSnapshot ? (
        <section
          className="detail-panel form-stack"
          aria-label="Remote changes"
        >
          <StatusBanner>
            New changes are available. Your unsaved drafts have been kept.
          </StatusBanner>
          <Button
            variant="secondary"
            disabled={submitting !== null}
            onClick={() => setComparing((value) => !value)}
          >
            {comparing ? "Hide comparison" : "Compare latest changes"}
          </Button>
          {comparing ? (
            <div className="form-stack">
              <h2>Latest saved version</h2>
              <p>
                {issueLabel(pendingSnapshot.issue)} ·{" "}
                {statusLabels[pendingSnapshot.issue.status]}
              </p>
              <p className="description">
                {pendingSnapshot.issue.description || "No description"}
              </p>
              <p>
                {pendingSnapshot.comments.length} comments ·{" "}
                {pendingSnapshot.questionSummary.answered} of{" "}
                {pendingSnapshot.questionSummary.total} questions answered
              </p>
              {currentQuestion ? (
                <p className="description">
                  Saved answer: {(() => {
                    const q = pendingSnapshot.questions.find(
                      (item) => item.id === currentQuestion.id,
                    );
                    return q
                      ? (q.answerOtherText ??
                          q.options.find(
                            (option) => option.id === q.answerOptionId,
                          )?.label ??
                          "Not answered")
                      : "Question no longer available";
                  })()}
                </p>
              ) : null}
            </div>
          ) : null}
          {answerDirty &&
          currentQuestion &&
          !pendingSnapshot.questions.some(
            (q) => q.id === currentQuestion.id,
          ) ? (
            <StatusBanner error>
              This question is no longer available. Copy your draft before
              reloading this page.
            </StatusBanner>
          ) : (
            <Button
              disabled={submitting !== null || !comparing}
              onClick={() => {
                preservedAnswerId.current = answerDirty
                  ? (currentQuestion?.id ?? null)
                  : null;
                applySnapshot(pendingSnapshot);
                setError(null);
                setQuestionError(null);
                setAnnouncement(
                  "Latest changes loaded. Drafts preserved; review them before saving.",
                );
              }}
            >
              Load latest changes and keep my drafts
            </Button>
          )}
        </section>
      ) : null}
      {liveError ? (
        <StatusBanner error>
          Live updates are temporarily unavailable. Your drafts are safe;
          refresh to check for changes.
        </StatusBanner>
      ) : null}
      <Button
        variant="secondary"
        disabled={refreshing || submitting !== null || !online}
        onClick={() => refreshLiveRef.current()}
      >
        {refreshing ? "Checking for changes…" : "Check for updates"}
      </Button>
      {error ? (
        <StatusBanner error focus>
          {error}
        </StatusBanner>
      ) : null}
      {questionSummary.unansweredBlocking > 0 ? (
        <div className="question-warning" role="status">
          <strong>⚠ Questions are blocking this ticket</strong>
          <span>
            {questionSummary.unansweredBlocking} blocking{" "}
            {questionSummary.unansweredBlocking === 1
              ? "question needs"
              : "questions need"}{" "}
            an answer.
          </span>
        </div>
      ) : null}
      <div className="detail-grid">
        <div>
          <AssigneeEditor
            key={issue.id}
            issue={issue}
            questions={questions}
            canEdit={canEdit && !epic?.archivedAt}
            onDirty={setAssigneeDirty}
            onSaved={(updated) => {
              mutationEpoch.current += 1;
              setIssue({ ...updated, questionSummary });
              setNotice("Human assignee updated");
              void refreshActivity();
            }}
          />
          <section
            className="detail-panel"
            aria-labelledby="issue-status-heading"
          >
            <h2 id="issue-status-heading">Status</h2>
            {canEdit ? (
              <Field
                label={`Change status for ${issueReference(issue)}`}
                htmlFor="issue-status"
              >
                <Select
                  id="issue-status"
                  value={issue.status}
                  disabled={!online || submitting !== null}
                  aria-describedby={
                    questionSummary.unansweredBlocking > 0 &&
                    issue.status !== "ready_for_review"
                      ? "review-block-explanation"
                      : undefined
                  }
                  onChange={(event) =>
                    void updateStatus(event.currentTarget.value as IssueStatus)
                  }
                >
                  {issueStatuses.map((status) => (
                    <option
                      key={status}
                      value={status}
                      disabled={
                        status === "ready_for_review" &&
                        issue.status !== "ready_for_review" &&
                        questionSummary.unansweredBlocking > 0
                      }
                    >
                      {statusLabels[status]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <p>{statusLabels[issue.status]}</p>
            )}
            {questionSummary.unansweredBlocking > 0 &&
            issue.status !== "ready_for_review" ? (
              <p id="review-block-explanation" className="metadata">
                Answer blocking questions before moving this ticket to Ready for
                Review.
              </p>
            ) : null}
            {submitting === "status" ? (
              <p role="status" className="metadata">
                Saving…
              </p>
            ) : null}
          </section>
          <section
            className="detail-panel"
            aria-labelledby="description-heading"
          >
            <h2 id="description-heading">Description</h2>
            {issue.description ? (
              <p className="description">{issue.description}</p>
            ) : (
              <p className="metadata">No description</p>
            )}
          </section>
          <CaptureEvidence issueId={issue.id} canEdit={canEdit} />
          <section
            className="detail-panel question-panel"
            aria-labelledby="questions-heading"
          >
            <div className="question-heading">
              <div>
                <h2 id="questions-heading">Questions</h2>
                <p className="metadata" aria-live="polite">
                  {questionSummary.answered} of {questionSummary.total} answered
                </p>
              </div>
              {questionSummary.unansweredBlocking > 0 ? (
                <span className="badge warning-badge">
                  ⚠ {questionSummary.unansweredBlocking} blocking
                </span>
              ) : null}
            </div>
            {!currentQuestion ? (
              <p className="metadata">No questions on this ticket.</p>
            ) : (
              <form className="form-stack" onSubmit={saveQuestionAnswer}>
                <div className="question-navigation">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={questionIndex === 0 || submitting === "question"}
                    onClick={() => setQuestionIndex((current) => current - 1)}
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
                      submitting === "question"
                    }
                    onClick={() => setQuestionIndex((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
                <fieldset
                  className="question-fieldset"
                  disabled={!canEdit || submitting !== null}
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
                          answerKind === "option" &&
                          answerOptionId === option.id
                        }
                        onChange={() => {
                          setAnswerDirty(true);
                          setAnswerKind("option");
                          setAnswerOptionId(option.id);
                        }}
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
                      onChange={() => {
                        setAnswerDirty(true);
                        setAnswerKind("other");
                      }}
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
                        onChange={(event) => {
                          setAnswerDirty(true);
                          setAnswerOtherText(event.currentTarget.value);
                        }}
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
                      disabled={!online || submitting !== null}
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
                      Answered {formatTimestamp(currentQuestion.answeredAt)}
                    </span>
                  ) : null}
                </div>
              </form>
            )}
          </section>
          <section className="detail-panel" aria-labelledby="comments-heading">
            <h2 id="comments-heading">Comments</h2>
            {comments.length === 0 ? (
              <p className="metadata">No comments yet.</p>
            ) : (
              <ol className="comment-list">
                {newestCommentsFirst.map((comment) => (
                  <li
                    className={`comment-item comment-${comment.authorType}`}
                    key={comment.id}
                  >
                    <div className="activity-identity">
                      <Badge>
                        {commentAuthorLabel(comment, session.user.id)}
                      </Badge>
                      <Badge>{comment.authorType}</Badge>
                      <Badge>{sourceLabels[comment.source]}</Badge>
                    </div>
                    <p className="description">{comment.body}</p>
                    <time
                      className="activity-meta"
                      dateTime={comment.createdAt}
                    >
                      {formatTimestamp(comment.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
            {canEdit ? (
              <form className="form-stack" onSubmit={addComment}>
                <Field label="Add comment" htmlFor="comment-body" required>
                  <TextArea
                    id="comment-body"
                    disabled={submitting !== null}
                    required
                    maxLength={20000}
                    value={commentBody}
                    onChange={(event) =>
                      setCommentBody(event.currentTarget.value)
                    }
                  />
                </Field>
                <Button type="submit" disabled={!online || submitting !== null}>
                  {submitting === "comment" ? "Adding…" : "Add comment"}
                </Button>
              </form>
            ) : null}
          </section>
          <section
            className="detail-panel"
            aria-labelledby="repository-heading"
          >
            <h2 id="repository-heading">Repository context</h2>
            {project.repositoryUrl ? (
              <p className="mono">{project.repositoryUrl}</p>
            ) : (
              <p className="metadata">No repository context</p>
            )}
            {project.defaultBranch ? (
              <p>
                <strong>Default branch:</strong>{" "}
                <span className="mono">{project.defaultBranch}</span>
              </p>
            ) : null}
            {project.repositorySubdirectory ? (
              <p>
                <strong>Subdirectory:</strong>{" "}
                <span className="mono">{project.repositorySubdirectory}</span>
              </p>
            ) : null}
            <p className="metadata">
              Issopen stores this context but does not access the repository.
            </p>
          </section>
          <section
            className="detail-panel"
            aria-labelledby="code-results-heading"
          >
            <h2 id="code-results-heading">Code results</h2>
            {links.length === 0 ? (
              <p>No code results linked.</p>
            ) : (
              <ul className="code-links">
                {links.map((link) => (
                  <li className="code-link" key={link.id}>
                    <Badge>{codeLinkLabels[link.type]}</Badge>
                    <a
                      className="mono"
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.url}
                      <span className="external-note">
                        {" "}
                        (opens in a new tab)
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {canEdit ? (
              <form className="form-stack" onSubmit={addLink}>
                <Field label="Link type" htmlFor="link-type">
                  <Select
                    id="link-type"
                    disabled={submitting !== null}
                    value={linkType}
                    onChange={(event) =>
                      setLinkType(event.currentTarget.value as CodeLinkType)
                    }
                  >
                    {codeLinkTypes.map((type) => (
                      <option key={type} value={type}>
                        {codeLinkLabels[type]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="URL" htmlFor="link-url" required>
                  <TextInput
                    id="link-url"
                    disabled={submitting !== null}
                    className="mono"
                    type="url"
                    required
                    maxLength={2048}
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.currentTarget.value)}
                  />
                </Field>
                <Button type="submit" disabled={!online || submitting !== null}>
                  {submitting === "link" ? "Adding…" : "Add code link"}
                </Button>
              </form>
            ) : null}
          </section>
          {canEdit && issue.status === "ready_for_review" ? (
            <section className="review-panel" aria-labelledby="review-heading">
              <h2 id="review-heading">Review result</h2>
              {links.length === 0 ? (
                <StatusBanner>No code result is linked yet.</StatusBanner>
              ) : (
                <p>
                  Review the linked result before choosing an outcome. Issopen
                  does not verify, merge, or deploy it.
                </p>
              )}
              <div className="inline-actions">
                <Button
                  type="button"
                  disabled={!online || Boolean(submitting)}
                  onClick={() => void review("accept")}
                >
                  {submitting === "accept" ? "Accepting…" : "Accept result"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!online || Boolean(submitting)}
                  onClick={() => setRequestingChanges(true)}
                >
                  Request changes
                </Button>
              </div>
              {requestingChanges ? (
                <form
                  className="form-stack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void review("request");
                  }}
                >
                  <Field label="Reason" htmlFor="review-reason" required>
                    <TextArea
                      id="review-reason"
                      disabled={submitting !== null}
                      required
                      maxLength={1000}
                      value={reason}
                      onChange={(event) => setReason(event.currentTarget.value)}
                    />
                  </Field>
                  <div className="inline-actions">
                    <Button
                      type="submit"
                      disabled={!online || submitting !== null}
                    >
                      {submitting === "request"
                        ? "Requesting…"
                        : "Request changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={submitting !== null}
                      onClick={() => {
                        setRequestingChanges(false);
                        setReason("");
                      }}
                    >
                      Keep reviewing
                    </Button>
                  </div>
                </form>
              ) : null}
            </section>
          ) : null}
        </div>
        <aside className="activity-panel" aria-labelledby="activity-heading">
          <h2 id="activity-heading">Activity</h2>
          {activity.length === 0 ? (
            <p className="metadata">No activity yet</p>
          ) : (
            <ol className="activity-list">
              {newestActivityFirst.map((item) => (
                <li className="activity-item" key={item.id}>
                  <p>{issueActivitySummary(item.summary, issue)}</p>
                  <div className="activity-identity">
                    <Badge>{actorLabel(item, session.user.id)}</Badge>
                    <Badge>{item.actorType}</Badge>
                    <Badge>{sourceLabels[item.source]}</Badge>
                  </div>
                  <time className="activity-meta" dateTime={item.createdAt}>
                    {formatTimestamp(item.createdAt)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
      <p className="live-region" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
