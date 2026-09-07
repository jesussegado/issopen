import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
} from "../types.js";
import {
  codeLinkLabels,
  codeLinkTypes,
  epicLabel,
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

function actorLabel(activity: Activity) {
  if (activity.actorType === "human") return "You";
  if (activity.actorType === "agent")
    return `Agent · ${activity.actorDisplayName}`;
  return "System";
}

function commentAuthorLabel(comment: IssueComment) {
  if (comment.authorType === "human") return "You";
  if (comment.authorType === "agent")
    return `Agent · ${comment.authorDisplayName}`;
  return "System";
}

const sourceLabels: Record<Activity["source"], string> = {
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

export function IssueDetailRoute({ issueId }: { issueId: string }) {
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
  const online = useOnlineStatus();
  const newestActivityFirst = useMemo(() => newestFirst(activity), [activity]);
  const newestCommentsFirst = useMemo(() => newestFirst(comments), [comments]);

  const refreshActivity = useCallback(async () => {
    const response = await apiRequest<{ activity: Activity[] }>(
      `/api/v1/issues/${issueId}/activity`,
    );
    setActivity(response.activity);
  }, [issueId]);

  useEffect(() => {
    async function load() {
      try {
        const [detail, activityResponse] = await Promise.all([
          apiRequest<{
            issue: Issue;
            codeLinks: CodeLink[];
            questions: IssueQuestion[];
            comments: IssueComment[];
            questionSummary: QuestionSummary;
            epic: Epic | null;
          }>(`/api/v1/issues/${issueId}`),
          apiRequest<{ activity: Activity[] }>(
            `/api/v1/issues/${issueId}/activity`,
          ),
        ]);
        const projectResponse = await apiRequest<{ project: Project }>(
          `/api/v1/projects/${detail.issue.projectId}`,
        );
        setIssue(detail.issue);
        setEpic(detail.epic ?? null);
        setLinks(detail.codeLinks);
        setQuestions(detail.questions);
        setComments(detail.comments);
        setQuestionSummary(detail.questionSummary);
        setActivity(activityResponse.activity);
        setProject(projectResponse.project);
      } catch (caught) {
        if (unavailable(caught)) setMissing(true);
        else
          setError(
            "We couldn't load this issue. Check your connection and try again.",
          );
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [issueId]);

  const currentQuestion = questions[questionIndex] ?? null;
  useEffect(() => {
    if (!currentQuestion) return;
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
    setSubmitting("status");
    setError(null);
    setNotice(null);
    setAnnouncement("");
    try {
      const response = await apiRequest<{ issue: Issue }>(
        `/api/v1/issues/${issue.id}`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setIssue({ ...response.issue, questionSummary });
      setNotice("Issue updated");
      setAnnouncement(
        `${response.issue.key} moved to ${statusLabels[response.issue.status]}`,
      );
      await refreshActivity();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? caught.message
          : "We couldn't save your changes. Check your connection and try again.",
      );
    } finally {
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
            ? { kind: "option", optionId: answerOptionId }
            : { kind: "other", text: answerOtherText },
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
        caught instanceof ApiError && caught.fields[0]?.message
          ? caught.fields[0].message
          : "We couldn't save this answer. Check your connection and try again.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  async function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issue) return;
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
      setIssue({ ...response.issue, questionSummary });
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
      setSubmitting(null);
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issue || !commentBody.trim()) return;
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
        `Comment added to ${issue.key} by ${commentAuthorLabel(response.comment)}`,
      );
      await refreshActivity();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.fields[0]?.message
          ? caught.fields[0].message
          : "We couldn't add this comment. Check your connection and try again.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  async function review(outcome: "accept" | "request") {
    if (!issue) return;
    setSubmitting(outcome);
    setError(null);
    setNotice(null);
    try {
      const response = await apiRequest<{ issue: Issue }>(
        `/api/v1/issues/${issue.id}/review/${outcome === "accept" ? "accept" : "request-changes"}`,
        {
          method: "POST",
          body: JSON.stringify(outcome === "accept" ? {} : { reason }),
        },
      );
      setIssue(response.issue);
      setRequestingChanges(false);
      setReason("");
      setNotice(outcome === "accept" ? "Result accepted" : "Changes requested");
      setAnnouncement(
        `${response.issue.key} moved to ${statusLabels[response.issue.status]}`,
      );
      await refreshActivity();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.fields[0]?.message
          ? caught.fields[0].message
          : "We couldn't save your changes. Check your connection and try again.",
      );
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) return <Skeleton label="Loading issue…" />;
  if (missing || !issue || !project) return <UnavailableRoute />;
  return (
    <div className="detail-column">
      <div className="page-header">
        <div>
          <div className="issue-metadata">
            <Badge mono>{issue.key}</Badge>
            <Badge>{priorityLabels[issue.priority]}</Badge>
          </div>
          <PageHeading>{issue.title}</PageHeading>
          <div className="issue-metadata">
            <span>Owner: You</span>
            {epic ? (
              <AppLink className="badge epic-badge" href={`/epics/${epic.id}`}>
                Epic: {epicLabel(epic)}
              </AppLink>
            ) : null}
            {issue.claimedByAgentId ? (
              <Badge>Agent: {issue.claimedByAgentId}</Badge>
            ) : (
              <Badge>Not claimed by an agent</Badge>
            )}
          </div>
        </div>
        <AppLink
          className="button button-secondary"
          href={`/issues/${issue.id}/edit`}
        >
          Edit issue
        </AppLink>
      </div>
      {notice ? <StatusBanner>{notice}</StatusBanner> : null}
      {!online ? <OfflineBanner /> : null}
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
          <section
            className="detail-panel"
            aria-labelledby="issue-status-heading"
          >
            <h2 id="issue-status-heading">Status</h2>
            <Field
              label={`Change status for ${issue.key}`}
              htmlFor="issue-status"
            >
              <Select
                id="issue-status"
                value={issue.status}
                disabled={!online || submitting === "status"}
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
                  disabled={submitting === "question"}
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
                      onChange={() => setAnswerKind("other")}
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
                          setAnswerOtherText(event.currentTarget.value)
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
                  <Button
                    type="submit"
                    disabled={!online || submitting === "question"}
                  >
                    {submitting === "question"
                      ? "Saving…"
                      : currentQuestion.answeredAt
                        ? "Change answer"
                        : "Save answer"}
                  </Button>
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
                      <Badge>{commentAuthorLabel(comment)}</Badge>
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
            <form className="form-stack" onSubmit={addComment}>
              <Field label="Add comment" htmlFor="comment-body" required>
                <TextArea
                  id="comment-body"
                  required
                  maxLength={20000}
                  value={commentBody}
                  onChange={(event) =>
                    setCommentBody(event.currentTarget.value)
                  }
                />
              </Field>
              <Button
                type="submit"
                disabled={!online || submitting === "comment"}
              >
                {submitting === "comment" ? "Adding…" : "Add comment"}
              </Button>
            </form>
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
            <form className="form-stack" onSubmit={addLink}>
              <Field label="Link type" htmlFor="link-type">
                <Select
                  id="link-type"
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
                  className="mono"
                  type="url"
                  required
                  maxLength={2048}
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.currentTarget.value)}
                />
              </Field>
              <Button type="submit" disabled={!online || submitting === "link"}>
                {submitting === "link" ? "Adding…" : "Add code link"}
              </Button>
            </form>
          </section>
          {issue.status === "ready_for_review" ? (
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
                      required
                      maxLength={1000}
                      value={reason}
                      onChange={(event) => setReason(event.currentTarget.value)}
                    />
                  </Field>
                  <div className="inline-actions">
                    <Button
                      type="submit"
                      disabled={!online || submitting === "request"}
                    >
                      {submitting === "request"
                        ? "Requesting…"
                        : "Request changes"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
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
                  <p>{item.summary}</p>
                  <div className="activity-identity">
                    <Badge>{actorLabel(item)}</Badge>
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
