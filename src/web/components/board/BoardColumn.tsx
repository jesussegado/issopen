import type { DragEvent } from "react";
import type { BoardColumn as BoardColumnModel } from "../../lib/board-model.js";
import type { Epic, Issue, IssueStatus } from "../../types.js";
import { statusLabels } from "../../types.js";
import { Badge } from "../ui.js";
import { BoardIssueCard } from "./BoardIssueCard.js";
import type { BoardWarningFilter } from "./BoardToolbar.js";

export type BoardColumnView = {
  warningFilter: BoardWarningFilter;
  collapsed: boolean;
  dropTarget: boolean;
  canEdit: boolean;
  online: boolean;
  savingIssue: string | null;
  expandedIssues: ReadonlySet<string>;
  showReviewColumn: boolean;
  hidden: boolean;
};

export type BoardColumnActions = {
  statusRef: (issueId: string, control: HTMLSelectElement | null) => void;
  onToggleColumn: () => void;
  onToggleIssue: (issueId: string) => void;
  onMoveIssue: (issue: Issue, status: IssueStatus) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>, issue: Issue) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
};

export function BoardColumn({
  column,
  epics,
  view,
  actions,
}: {
  column: BoardColumnModel;
  epics: Epic[];
  view: BoardColumnView;
  actions: BoardColumnActions;
}) {
  const {
    warningFilter,
    collapsed,
    dropTarget,
    canEdit,
    online,
    savingIssue,
    expandedIssues,
    showReviewColumn,
    hidden,
  } = view;
  const {
    statusRef,
    onToggleColumn,
    onToggleIssue,
    onMoveIssue,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
  } = actions;
  const visibleIssues = column.issues.filter(
    (issue) =>
      warningFilter !== "warnings" ||
      (issue.questionSummary?.unansweredBlocking ?? 0) > 0,
  );
  return (
    <section
      className={`board-column${collapsed ? " is-collapsed" : ""}${dropTarget ? " is-drop-target" : ""}`}
      aria-labelledby={`column-${column.status}`}
      hidden={hidden}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="board-column-header">
        <h2 id={`column-${column.status}`}>{statusLabels[column.status]}</h2>
        <div className="board-column-actions">
          <Badge>{visibleIssues.length}</Badge>
          <button
            className="disclosure-button"
            type="button"
            aria-expanded={!collapsed}
            aria-controls={`column-content-${column.status}`}
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${statusLabels[column.status]} column`}
            onClick={onToggleColumn}
          >
            <span aria-hidden="true">{collapsed ? "+" : "−"}</span>
          </button>
        </div>
      </div>
      <div id={`column-content-${column.status}`} hidden={collapsed}>
        {visibleIssues.length === 0 ? (
          <p className="empty-column">
            {warningFilter === "warnings"
              ? "No tickets with warnings"
              : "No issues"}
          </p>
        ) : (
          <ul className="issue-list">
            {visibleIssues.map((issue) => (
              <BoardIssueCard
                key={issue.id}
                issue={issue}
                epic={epics.find((item) => item.id === issue.epicId)}
                view={{
                  expanded: expandedIssues.has(issue.id),
                  canEdit,
                  online,
                  saving: savingIssue === issue.id,
                  dragEnabled: canEdit && online && savingIssue === null,
                  showReviewColumn,
                }}
                actions={{
                  statusRef: (control) => statusRef(issue.id, control),
                  onToggle: () => onToggleIssue(issue.id),
                  onMove: (status) => onMoveIssue(issue, status),
                  onDragStart: (event) => onDragStart(event, issue),
                  onDragEnd,
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
