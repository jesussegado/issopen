import type {
  Activity,
  CodeLink,
  Epic,
  Issue,
  IssueComment,
  IssueQuestion,
  Project,
  QuestionSummary,
} from "../types.js";
import { apiRequest } from "./api.js";

export type IssueDetailSnapshot = {
  issue: Issue;
  epic: Epic | null;
  epicIssues: Issue[];
  codeLinks: CodeLink[];
  comments: IssueComment[];
  questions: IssueQuestion[];
  questionSummary: QuestionSummary;
  activity: Activity[];
  project: Project;
};

export async function readIssueDetailSnapshot(
  issueId: string,
  signal?: AbortSignal,
): Promise<IssueDetailSnapshot> {
  const options = { cache: "no-store" as const, ...(signal ? { signal } : {}) };
  const [detail, activity] = await Promise.all([
    apiRequest<Omit<IssueDetailSnapshot, "activity" | "project">>(
      `/api/v1/issues/${issueId}`,
      options,
    ),
    apiRequest<{ activity: Activity[] }>(
      `/api/v1/issues/${issueId}/activity`,
      options,
    ),
  ]);
  const [{ project }, epicDetail] = await Promise.all([
    apiRequest<{ project: Project }>(
      `/api/v1/projects/${detail.issue.projectId}`,
      options,
    ),
    detail.epic
      ? apiRequest<{ issues: Issue[] }>(
          `/api/v1/epics/${detail.epic.id}`,
          options,
        ).catch(() => ({ issues: [] }))
      : Promise.resolve({ issues: [] as Issue[] }),
  ]);
  return {
    issue: detail.issue,
    epic: detail.epic ?? null,
    epicIssues: epicDetail.issues,
    codeLinks: detail.codeLinks ?? [],
    comments: detail.comments ?? [],
    questions: detail.questions ?? [],
    questionSummary: detail.questionSummary,
    activity: activity.activity,
    project,
  };
}
