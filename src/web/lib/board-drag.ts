import { type DragEvent, useState } from "react";
import type { Issue, IssueStatus } from "../types.js";
import { issueReference, statusLabels } from "../types.js";
import type { BoardColumn } from "./board-model.js";

export function useBoardDrag({
  columns,
  canEdit,
  online,
  savingIssue,
  moveIssue,
  announce,
}: {
  columns: BoardColumn[];
  canEdit: boolean;
  online: boolean;
  savingIssue: string | null;
  moveIssue: (issue: Issue, status: IssueStatus) => void;
  announce: (message: string) => void;
}) {
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<IssueStatus | null>(
    null,
  );

  function findIssue(issueId: string) {
    return columns
      .flatMap((column) => column.issues)
      .find((issue) => issue.id === issueId);
  }

  function canDropIssue(issue: Issue, status: IssueStatus) {
    return (
      canEdit &&
      online &&
      savingIssue === null &&
      status !== issue.status &&
      !(
        status === "ready_for_review" &&
        (issue.questionSummary?.unansweredBlocking ?? 0) > 0
      )
    );
  }

  function issueFromDrag(event: DragEvent<HTMLElement>) {
    const issueId = draggedIssueId || event.dataTransfer.getData("text/plain");
    return issueId ? findIssue(issueId) : undefined;
  }

  function startDragging(event: DragEvent<HTMLLIElement>, issue: Issue) {
    if (!canEdit || !online || savingIssue !== null) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", issue.id);
    setDraggedIssueId(issue.id);
    setDragOverStatus(null);
    announce(`Dragging ${issueReference(issue)}. Choose a destination column.`);
  }

  function dragOverColumn(event: DragEvent<HTMLElement>, status: IssueStatus) {
    const issue = issueFromDrag(event);
    if (!issue || !canDropIssue(issue, status)) {
      event.dataTransfer.dropEffect = "none";
      if (dragOverStatus === status) setDragOverStatus(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStatus(status);
  }

  function leaveColumn(event: DragEvent<HTMLElement>, status: IssueStatus) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    )
      return;
    setDragOverStatus((current) => (current === status ? null : current));
  }

  function dropOnColumn(event: DragEvent<HTMLElement>, status: IssueStatus) {
    event.preventDefault();
    const issue = issueFromDrag(event);
    setDraggedIssueId(null);
    setDragOverStatus(null);
    if (!issue) return;
    if (!canDropIssue(issue, status)) {
      if (
        status === "ready_for_review" &&
        (issue.questionSummary?.unansweredBlocking ?? 0) > 0
      )
        announce(
          `Answer blocking questions before moving ${issueReference(issue)} to ${statusLabels[status]}.`,
        );
      return;
    }
    moveIssue(issue, status);
  }

  function finishDragging() {
    setDraggedIssueId(null);
    setDragOverStatus(null);
  }

  return {
    dragOverStatus,
    startDragging,
    dragOverColumn,
    leaveColumn,
    dropOnColumn,
    finishDragging,
  };
}
