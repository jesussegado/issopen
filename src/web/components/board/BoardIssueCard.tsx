import type { DragEvent } from "react";
import type { Epic, Issue, IssueStatus } from "../../types.js";
import {
  epicLabel,
  issueLabel,
  issueReference,
  issueStatuses,
  priorityLabels,
  statusLabels,
} from "../../types.js";
import { AssigneeLabel } from "../AssigneeEditor.js";
import { AppLink, Badge, Select } from "../ui.js";

export type BoardIssueCardView = {
  expanded: boolean;
  canEdit: boolean;
  online: boolean;
  saving: boolean;
  dragEnabled: boolean;
  showReviewColumn: boolean;
};

export type BoardIssueCardActions = {
  statusRef: (control: HTMLSelectElement | null) => void;
  onToggle: () => void;
  onMove: (status: IssueStatus) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
};

export function BoardIssueCard({
  issue,
  epic,
  view,
  actions,
}: {
  issue: Issue;
  epic?: Epic | undefined;
  view: BoardIssueCardView;
  actions: BoardIssueCardActions;
}) {
  const { expanded, canEdit, online, saving, dragEnabled, showReviewColumn } =
    view;
  const { statusRef, onToggle, onMove, onDragStart, onDragEnd } = actions;
  const blocking = issue.questionSummary?.unansweredBlocking ?? 0;
  return (
    <li
      className="issue-card"
      draggable={dragEnabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="issue-card-summary">
        <AppLink
          className="issue-card-title"
          href={`/issues/${issue.id}`}
          aria-label={issueLabel(issue)}
        >
          <span className="issue-card-number" aria-hidden="true">
            {issue.number}-
          </span>
          <span className="issue-card-title-text" aria-hidden="true">
            {issue.title}
          </span>
        </AppLink>
        <button
          className="disclosure-button"
          type="button"
          aria-expanded={expanded}
          aria-controls={`issue-preview-${issue.id}`}
          aria-label={`${expanded ? "Hide" : "Show"} details for ${issueReference(issue)}`}
          onClick={onToggle}
        >
          <span aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
      </div>
      <div className="issue-card-compact-meta">
        <Badge>{priorityLabels[issue.priority]}</Badge>
        <AssigneeLabel issue={issue} />
      </div>
      {(issue.questionSummary?.directedUnanswered ?? 0) > 0 ? (
        <AppLink
          className="badge warning-badge warning-link"
          href={`/issues/${issue.id}#questions-heading`}
        >
          ⚠ {issue.questionSummary?.directedUnanswered} for you
        </AppLink>
      ) : null}
      {blocking > 0 ? (
        <AppLink
          className="badge warning-badge warning-link"
          href={`/issues/${issue.id}#questions-heading`}
        >
          ⚠ {blocking} unanswered
        </AppLink>
      ) : null}
      <div
        id={`issue-preview-${issue.id}`}
        className="issue-card-details"
        hidden={!expanded}
      >
        <div className="issue-metadata">
          {issue.epicId ? (
            <>
              <AppLink
                className="badge epic-badge"
                href={`/epics/${issue.epicId}`}
              >
                {epic ? epicLabel(epic) : "Epic"}
              </AppLink>
              {epic?.archivedAt ? <Badge>Archived Epic</Badge> : null}
            </>
          ) : null}
          {(issue.questionSummary?.total ?? 0) > 0 ? (
            <Badge>
              {issue.questionSummary?.answered}/{issue.questionSummary?.total}{" "}
              answers
            </Badge>
          ) : null}
        </div>
        <p className="issue-card-description">
          {issue.description || "No description"}
        </p>
        {issue.claimedByAgentId ? (
          <p className="metadata">Agent: {issue.claimedByAgentId}</p>
        ) : null}
        {canEdit ? (
          <div className="card-status">
            <label htmlFor={`status-${issue.id}`}>
              <span>Status</span>
              <Select
                id={`status-${issue.id}`}
                ref={statusRef}
                aria-label={`Change status for ${issueReference(issue)}`}
                aria-describedby={
                  blocking > 0 && issue.status !== "ready_for_review"
                    ? `review-block-${issue.id}`
                    : undefined
                }
                value={issue.status}
                disabled={!online || saving}
                onChange={(event) =>
                  onMove(event.currentTarget.value as IssueStatus)
                }
              >
                {issueStatuses
                  .filter(
                    (status) =>
                      status !== "ready_for_review" ||
                      showReviewColumn ||
                      issue.status === "ready_for_review",
                  )
                  .map((status) => (
                    <option
                      key={status}
                      value={status}
                      disabled={
                        status === "ready_for_review" &&
                        issue.status !== "ready_for_review" &&
                        blocking > 0
                      }
                    >
                      {statusLabels[status]}
                    </option>
                  ))}
              </Select>
            </label>
            {blocking > 0 && issue.status !== "ready_for_review" ? (
              <span id={`review-block-${issue.id}`} className="metadata">
                Answer blocking questions before review.
              </span>
            ) : null}
            {saving ? (
              <span role="status" className="metadata">
                Saving…
              </span>
            ) : null}
          </div>
        ) : (
          <p className="metadata">{statusLabels[issue.status]}</p>
        )}
      </div>
    </li>
  );
}
