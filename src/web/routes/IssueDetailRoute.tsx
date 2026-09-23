import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { AssigneeEditor } from "../components/AssigneeEditor.js";
import { CaptureEvidence } from "../components/CaptureEvidence.js";
import { ActivityPanel } from "../components/issue-detail/ActivityPanel.js";
import { CodeResultsPanel } from "../components/issue-detail/CodeResultsPanel.js";
import { CommentsPanel } from "../components/issue-detail/CommentsPanel.js";
import { IssueDetailHeader } from "../components/issue-detail/IssueDetailHeader.js";
import { commentAuthorLabel } from "../components/issue-detail/presentation.js";
import { QuestionsPanel } from "../components/issue-detail/QuestionsPanel.js";
import { RemoteChangesPanel } from "../components/issue-detail/RemoteChangesPanel.js";
import { RepositoryPanel } from "../components/issue-detail/RepositoryPanel.js";
import { ReviewPanel } from "../components/issue-detail/ReviewPanel.js";
import {
  Button,
  Field,
  OfflineBanner,
  RouteLoadError,
  Select,
  Skeleton,
  StatusBanner,
} from "../components/ui.js";
import {
  ApiError,
  apiFailureKind,
  apiRequest,
  mutationFailureMessage,
  unavailable,
} from "../lib/api.js";
import {
  initialIssueDetailSyncState,
  issueDetailDraftPhase,
  issueDetailSyncReducer,
} from "../lib/issue-detail-machine.js";
import {
  type IssueDetailSnapshot,
  readIssueDetailSnapshot,
} from "../lib/issue-detail-snapshot.js";
import { useLatestRequest } from "../lib/latest-request.js";
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
import { issueReference, issueStatuses, statusLabels } from "../types.js";
import { UnavailableRoute } from "./TrackerForms.js";

export function IssueDetailRoute({
  issueId,
  session,
}: {
  issueId: string;
  session: Session;
}) {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [epic, setEpic] = useState<Epic | null>(null);
  const [epicIssues, setEpicIssues] = useState<Issue[]>([]);
  const [links, setLinks] = useState<CodeLink[]>([]);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [mentions, setMentions] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const commentRequest = useRef<{ payload: string; id: string } | null>(null);
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
  const [sync, dispatchSync] = useReducer(
    issueDetailSyncReducer,
    initialIssueDetailSyncState,
  );
  const loading = sync.phase === "loading";
  const missing = sync.phase === "missing";
  const error = sync.error;
  const pendingSnapshot = sync.pendingSnapshot;
  const liveError = sync.live === "failed";
  const refreshing = sync.live === "refreshing";
  const submitting =
    sync.mutation.phase === "submitting" ? sync.mutation.operation : null;
  const [notice, setNotice] = useState(() =>
    new URLSearchParams(window.location.search).get("notice"),
  );
  const [linkType, setLinkType] = useState<CodeLinkType>("branch");
  const [linkUrl, setLinkUrl] = useState("");
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [reason, setReason] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [answerDirty, setAnswerDirty] = useState(false);
  const [assigneeDirty, setAssigneeDirty] = useState(false);
  const [recipientDirty, setRecipientDirty] = useState(false);
  const [comparing, setComparing] = useState(false);
  const mutationEpoch = useRef(0);
  const preservedAnswerId = useRef<string | null>(null);
  const scope = `${session.user.id}:${session.workspace?.id}:${issueId}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const latestDetailRequest = useLatestRequest(scope);
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
      issueDetailDraftPhase({
        answer: answerDirty,
        assignee: assigneeDirty,
        recipient: recipientDirty,
        comment: commentBody,
        mentionCount: mentions.length,
        linkUrl,
        reviewReason: reason,
        requestingChanges,
      }) === "dirty",
    submitting: submitting !== null,
    questionId: questions[questionIndex]?.id ?? "",
    signature: JSON.stringify({
      issue,
      epic,
      epicIssues,
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

  const refreshActivity = useCallback(async () => {
    const response = await apiRequest<{ activity: Activity[] }>(
      `/api/v1/issues/${issueId}/activity`,
    );
    setActivity(response.activity);
  }, [issueId]);

  const applySnapshot = useCallback((snapshot: IssueDetailSnapshot) => {
    const selected = snapshot.questions.findIndex(
      (q) => q.id === state.current.questionId,
    );
    setQuestionIndex(selected >= 0 ? selected : 0);
    setIssue(snapshot.issue);
    setEpic(snapshot.epic);
    setEpicIssues(snapshot.epicIssues);
    setLinks(snapshot.codeLinks);
    setComments(snapshot.comments);
    setQuestions(snapshot.questions);
    setQuestionSummary(snapshot.questionSummary);
    setActivity(snapshot.activity);
    setProject(snapshot.project);
    setComparing(false);
  }, []);

  const clearAccess = useCallback(() => {
    dispatchSync({ type: "access_lost" });
    setIssue(null);
    setEpicIssues([]);
    setQuestions([]);
    setComments([]);
    setLinks([]);
    setActivity([]);
    setCommentBody("");
    setMentions([]);
    commentRequest.current = null;
    setAnswerOtherText("");
    setAnswerOptionId("");
    setLinkUrl("");
    setReason("");
  }, []);

  const loadDetail = useCallback(() => {
    const controller = new AbortController();
    const request = latestDetailRequest.begin();
    dispatchSync({ type: "load_started" });
    setCommentBody("");
    setMentions([]);
    commentRequest.current = null;
    setLinkUrl("");
    setReason("");
    setRequestingChanges(false);
    setAnswerDirty(false);
    void readIssueDetailSnapshot(issueId, controller.signal)
      .then((snapshot) => {
        if (!controller.signal.aborted && latestDetailRequest.accept(request)) {
          applySnapshot(snapshot);
          dispatchSync({ type: "load_succeeded" });
          const directed = new URLSearchParams(window.location.search).get(
            "question",
          );
          const directedIndex = snapshot.questions.findIndex(
            (q) => q.id === directed,
          );
          if (directedIndex >= 0) setQuestionIndex(directedIndex);
        }
      })
      .catch((caught) => {
        if (controller.signal.aborted || !latestDetailRequest.accept(request))
          return;
        if (apiFailureKind(caught) === "unavailable") clearAccess();
        else
          dispatchSync({
            type: "load_failed",
            message:
              "We couldn't load this issue. Check your connection and try again.",
          });
      });
    return controller;
  }, [issueId, applySnapshot, clearAccess, latestDetailRequest]);

  useEffect(() => {
    const controller = loadDetail();
    return () => controller.abort();
  }, [loadDetail]);

  useEffect(() => {
    if (loading || !issue || window.location.hash !== "#questions-heading")
      return;
    const frame = window.requestAnimationFrame(() => {
      const heading = document.getElementById("questions-heading");
      heading?.scrollIntoView?.({ block: "start" });
      heading?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [issue, loading]);

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
      dispatchSync({ type: "live_started" });
      try {
        const next = await readIssueDetailSnapshot(issueId, controller.signal);
        if (
          stopped ||
          scopeRef.current !== scope ||
          epoch !== mutationEpoch.current ||
          state.current.submitting
        )
          return;
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
          dispatchSync({ type: "live_unchanged" });
          return;
        }
        if (state.current.dirty || document.querySelector("dialog[open]"))
          dispatchSync({ type: "live_pending", snapshot: next });
        else {
          applySnapshot(next);
          dispatchSync({ type: "live_applied" });
        }
      } catch (caught) {
        if (stopped || scopeRef.current !== scope) return;
        if (unavailable(caught)) clearAccess();
        else dispatchSync({ type: "live_failed" });
      } finally {
        inFlight = false;
        if (!stopped) dispatchSync({ type: "live_finished" });
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
  const pendingEpicIssues = useMemo(
    () =>
      epicIssues
        .filter(
          (item) =>
            Math.max(
              0,
              (item.questionSummary?.total ?? 0) -
                (item.questionSummary?.answered ?? 0),
            ) > 0,
        )
        .sort(
          (left, right) =>
            left.number - right.number || left.id.localeCompare(right.id),
        ),
    [epicIssues],
  );
  const currentEpicQuestionIndex = pendingEpicIssues.findIndex(
    (item) => item.id === issue?.id,
  );
  const previousEpicQuestionIssue =
    currentEpicQuestionIndex > 0
      ? pendingEpicIssues[currentEpicQuestionIndex - 1]
      : null;
  const nextEpicQuestionIssue =
    currentEpicQuestionIndex >= 0 &&
    currentEpicQuestionIndex < pendingEpicIssues.length - 1
      ? pendingEpicIssues[currentEpicQuestionIndex + 1]
      : null;
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
    dispatchSync({ type: "mutation_started", operation: "status" });
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
      dispatchSync({
        type: "mutation_failed",
        kind:
          caught instanceof ApiError && caught.status === 409
            ? "conflict"
            : "failed",
        message:
          caught instanceof ApiError && caught.status === 409
            ? caught.message
            : "We couldn't save your changes. Check your connection and try again.",
      });
    } finally {
      mutationEpoch.current += 1;
      dispatchSync({ type: "mutation_finished" });
    }
  }

  async function saveQuestionAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issue || !currentQuestion || recipientDirty) return;
    if (answerKind === "option" && !answerOptionId) {
      setQuestionError("Choose an option or select Other.");
      return;
    }
    if (answerKind === "other" && !answerOtherText.trim()) {
      setQuestionError("Add your answer in Other.");
      return;
    }

    mutationEpoch.current += 1;
    dispatchSync({ type: "mutation_started", operation: "question" });
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
      setEpicIssues((current) =>
        current.map((item) =>
          item.id === issue.id
            ? { ...item, questionSummary: response.questionSummary }
            : item,
        ),
      );
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
      const message =
        caught instanceof ApiError && caught.status === 409
          ? caught.message
          : caught instanceof ApiError && caught.fields[0]?.message
            ? caught.fields[0].message
            : "We couldn't save this answer. Check your connection and try again.";
      setQuestionError(message);
      dispatchSync({
        type: "mutation_failed",
        kind:
          caught instanceof ApiError && caught.status === 409
            ? "conflict"
            : "failed",
        message,
        display: "panel",
      });
    } finally {
      mutationEpoch.current += 1;
      dispatchSync({ type: "mutation_finished" });
    }
  }

  async function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issue) return;
    mutationEpoch.current += 1;
    dispatchSync({ type: "mutation_started", operation: "link" });
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
      dispatchSync({
        type: "mutation_failed",
        kind:
          caught instanceof ApiError && caught.status === 409
            ? "conflict"
            : "failed",
        message:
          caught instanceof ApiError && caught.fields[0]?.message
            ? caught.fields[0].message
            : "We couldn't save your changes. Check your connection and try again.",
      });
    } finally {
      mutationEpoch.current += 1;
      dispatchSync({ type: "mutation_finished" });
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issue || !commentBody.trim()) return;
    const requestedScope = scope;
    const payload = JSON.stringify({
      scope,
      issueId: issue.id,
      body: commentBody,
      mentionIds: mentions.map((p) => p.id).sort(),
    });
    if (commentRequest.current?.payload !== payload)
      commentRequest.current = { payload, id: crypto.randomUUID() };
    mutationEpoch.current += 1;
    dispatchSync({ type: "mutation_started", operation: "comment" });
    setNotice(null);
    try {
      const response = await apiRequest<{ comment: IssueComment }>(
        `/api/v1/issues/${issue.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            body: commentBody,
            mentionIds: mentions.map((p) => p.id),
            clientRequestId: commentRequest.current.id,
          }),
        },
      );
      if (scopeRef.current !== requestedScope) return;
      setComments((current) => [
        ...current.filter((c) => c.id !== response.comment.id),
        response.comment,
      ]);
      setCommentBody("");
      setMentions([]);
      commentRequest.current = null;
      setNotice("Comment added");
      setAnnouncement(
        `Comment added to ${issueReference(issue)} by ${commentAuthorLabel(response.comment, session.user.id)}`,
      );
      await refreshActivity();
    } catch (caught) {
      dispatchSync({
        type: "mutation_failed",
        kind:
          caught instanceof ApiError && caught.status === 409
            ? "conflict"
            : "failed",
        message:
          caught instanceof ApiError && caught.fields[0]?.message
            ? caught.fields[0].message
            : "We couldn't add this comment. Check your connection and try again.",
      });
    } finally {
      mutationEpoch.current += 1;
      dispatchSync({ type: "mutation_finished" });
    }
  }

  async function review(outcome: "accept" | "request") {
    if (!issue) return;
    mutationEpoch.current += 1;
    dispatchSync({ type: "mutation_started", operation: outcome });
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
      dispatchSync({
        type: "mutation_failed",
        kind:
          caught instanceof ApiError && caught.status === 409
            ? "conflict"
            : "failed",
        message: mutationFailureMessage(
          caught,
          "We couldn't save your changes. Check your connection and try again.",
        ),
      });
    } finally {
      mutationEpoch.current += 1;
      dispatchSync({ type: "mutation_finished" });
    }
  }

  if (loading || (issue && issue.id !== issueId))
    return <Skeleton label="Loading issue…" />;
  if (missing) return <UnavailableRoute />;
  if ((!issue || !project) && error)
    return (
      <RouteLoadError
        message={error}
        retrying={loading}
        online={online}
        onRetry={() => loadDetail()}
      />
    );
  if (!issue || !project) return <UnavailableRoute />;
  const canEdit = project.canEdit !== false;
  return (
    <div className="detail-column issue-detail-page">
      <IssueDetailHeader
        issue={issue}
        epic={epic}
        questions={questions}
        session={session}
        canEdit={canEdit}
        busy={submitting !== null}
      />
      {notice ? <StatusBanner>{notice}</StatusBanner> : null}
      {!online ? <OfflineBanner /> : null}
      {pendingSnapshot ? (
        <RemoteChangesPanel
          snapshot={pendingSnapshot}
          currentQuestion={currentQuestion}
          comparing={comparing}
          answerDirty={answerDirty}
          busy={submitting !== null}
          onToggleComparison={() => setComparing((value) => !value)}
          onApply={() => {
            preservedAnswerId.current = answerDirty
              ? (currentQuestion?.id ?? null)
              : null;
            applySnapshot(pendingSnapshot);
            dispatchSync({ type: "live_applied" });
            dispatchSync({ type: "clear_error" });
            setQuestionError(null);
            setAnnouncement(
              "Latest changes loaded. Drafts preserved; review them before saving.",
            );
          }}
        />
      ) : null}
      {liveError ? (
        <StatusBanner error>
          Live updates are temporarily unavailable. Your drafts are safe;
          refresh to check for changes.
        </StatusBanner>
      ) : null}
      <Button
        variant="secondary"
        className="detail-refresh-button"
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
                  {issueStatuses
                    .filter(
                      (status) =>
                        status !== "ready_for_review" ||
                        project?.showReviewColumn !== false ||
                        issue.status === "ready_for_review",
                    )
                    .map((status) => (
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
          <QuestionsPanel
            issue={issue}
            epic={epic}
            questions={questions}
            summary={questionSummary}
            currentQuestion={currentQuestion}
            questionIndex={questionIndex}
            pendingEpicIssues={pendingEpicIssues}
            currentEpicQuestionIndex={currentEpicQuestionIndex}
            previousEpicQuestionIssue={previousEpicQuestionIssue ?? null}
            nextEpicQuestionIssue={nextEpicQuestionIssue ?? null}
            answerKind={answerKind}
            answerOptionId={answerOptionId}
            answerOtherText={answerOtherText}
            questionError={questionError}
            recipientDirty={recipientDirty}
            canEdit={canEdit}
            online={online}
            submitting={submitting}
            onQuestionIndexChange={setQuestionIndex}
            onRecipientDirty={setRecipientDirty}
            onRecipientSaved={(snapshot) => {
              mutationEpoch.current += 1;
              preservedAnswerId.current = answerDirty
                ? (currentQuestion?.id ?? null)
                : null;
              setIssue(snapshot.issue);
              setQuestions(snapshot.questions);
              setQuestionSummary(snapshot.questionSummary);
              setNotice("Question recipient updated");
              void refreshActivity();
            }}
            onOptionChange={(optionId) => {
              setAnswerDirty(true);
              setAnswerKind("option");
              setAnswerOptionId(optionId);
            }}
            onOtherSelect={() => {
              setAnswerDirty(true);
              setAnswerKind("other");
            }}
            onOtherTextChange={(text) => {
              setAnswerDirty(true);
              setAnswerOtherText(text);
            }}
            onSubmit={saveQuestionAnswer}
          />
          <CommentsPanel
            comments={comments}
            body={commentBody}
            mentions={mentions}
            projectId={issue.projectId}
            viewerId={session.user.id}
            canEdit={canEdit}
            online={online}
            submitting={submitting}
            onBodyChange={setCommentBody}
            onMentionsChange={setMentions}
            onSubmit={addComment}
          />
          <RepositoryPanel project={project} />
          <CodeResultsPanel
            links={links}
            linkType={linkType}
            linkUrl={linkUrl}
            canEdit={canEdit}
            online={online}
            submitting={submitting}
            onTypeChange={setLinkType}
            onUrlChange={setLinkUrl}
            onSubmit={addLink}
          />
          {canEdit && issue.status === "ready_for_review" ? (
            <ReviewPanel
              linkCount={links.length}
              online={online}
              submitting={submitting}
              requestingChanges={requestingChanges}
              reason={reason}
              onAccept={() => void review("accept")}
              onRequestStart={() => setRequestingChanges(true)}
              onReasonChange={setReason}
              onRequestSubmit={(event) => {
                event.preventDefault();
                void review("request");
              }}
              onCancelRequest={() => {
                setRequestingChanges(false);
                setReason("");
              }}
            />
          ) : null}
        </div>
        <ActivityPanel
          activity={activity}
          issue={issue}
          viewerId={session.user.id}
        />
      </div>
      <p className="live-region" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
