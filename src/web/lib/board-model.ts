import { useCallback, useEffect, useState } from "react";
import type { Epic, Issue, IssueStatus, Project } from "../types.js";
import { apiFailureKind, apiRequest, mutationFailureMessage } from "./api.js";
import { useLatestRequest } from "./latest-request.js";
import { subscribeToProjectChanges } from "./project-live.js";

export type BoardColumn = { status: IssueStatus; issues: Issue[] };

type BoardResponse = {
  project: Project;
  columns: BoardColumn[];
  epics: Epic[];
  totalIssueCount?: number;
  hiddenIssueCount?: number;
};

export type BoardMoveResult = {
  issue: Issue;
  targetIsVisible: boolean;
};

export function useBoardModel({
  projectId,
  epicFilter,
  assigneeFilter,
  questionsForMe,
}: {
  projectId: string;
  epicFilter: string;
  assigneeFilter?: string | undefined;
  questionsForMe: boolean;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [totalIssueCount, setTotalIssueCount] = useState(0);
  const [hiddenIssueCount, setHiddenIssueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingIssue, setSavingIssue] = useState<string | null>(null);
  const routeKey = `${projectId}:${epicFilter}:${assigneeFilter ?? "all"}:${questionsForMe}`;
  const latestRequest = useLatestRequest(routeKey);

  const refresh = useCallback(
    async (initial = false) => {
      const request = latestRequest.begin();
      if (initial) {
        setLoading(true);
        setError(null);
      }
      const params = new URLSearchParams();
      if (epicFilter !== "all") params.set("epicId", epicFilter);
      if (assigneeFilter) params.set("assignee", assigneeFilter);
      if (questionsForMe) params.set("questionsFor", "mine");
      const query = params.size ? `?${params}` : "";
      try {
        const board = await apiRequest<BoardResponse>(
          `/api/v1/projects/${projectId}/board${query}`,
        );
        if (!latestRequest.accept(request)) return;
        const visibleIssueCount = board.columns.reduce(
          (total, column) => total + column.issues.length,
          0,
        );
        setProject(board.project);
        setColumns(board.columns);
        setEpics(board.epics ?? []);
        setTotalIssueCount(board.totalIssueCount ?? visibleIssueCount);
        setHiddenIssueCount(board.hiddenIssueCount ?? 0);
        setMissing(false);
        setError(null);
        setLoading(false);
      } catch (caught) {
        if (!latestRequest.accept(request)) return;
        if (apiFailureKind(caught) === "unavailable") setMissing(true);
        else if (initial)
          setError(
            "We couldn't load this board. Check your connection and try again.",
          );
        setLoading(false);
      }
    },
    [assigneeFilter, epicFilter, latestRequest, projectId, questionsForMe],
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(
    () =>
      subscribeToProjectChanges(
        projectId,
        () => void refresh(),
        () => {
          setMissing(true);
          void refresh(true);
        },
      ),
    [projectId, refresh],
  );

  const moveIssue = useCallback(
    async (
      issue: Issue,
      status: IssueStatus,
    ): Promise<BoardMoveResult | null> => {
      if (status === issue.status) return null;
      setSavingIssue(issue.id);
      setError(null);
      try {
        const response = await apiRequest<{ issue: Issue }>(
          `/api/v1/issues/${issue.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ status, expectedVersion: issue.version }),
          },
        );
        const updatedIssue: Issue = issue.questionSummary
          ? {
              ...issue,
              ...response.issue,
              questionSummary: issue.questionSummary,
            }
          : { ...issue, ...response.issue };
        const targetIsVisible = columns.some(
          (column) => column.status === updatedIssue.status,
        );
        setColumns((current) =>
          current.map((column) => ({
            ...column,
            issues:
              column.status === updatedIssue.status
                ? [
                    ...column.issues.filter(
                      (item) => item.id !== updatedIssue.id,
                    ),
                    updatedIssue,
                  ].sort((left, right) => left.number - right.number)
                : column.issues.filter((item) => item.id !== updatedIssue.id),
          })),
        );
        if (!targetIsVisible) setHiddenIssueCount((current) => current + 1);
        return { issue: updatedIssue, targetIsVisible };
      } catch (caught) {
        setError(
          mutationFailureMessage(
            caught,
            "We couldn't save your changes. Check your connection and try again.",
          ),
        );
        return null;
      } finally {
        setSavingIssue(null);
      }
    },
    [columns],
  );

  return {
    project,
    epics,
    columns,
    totalIssueCount,
    hiddenIssueCount,
    loading,
    missing,
    error,
    savingIssue,
    refresh,
    moveIssue,
  };
}
