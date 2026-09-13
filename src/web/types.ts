export const issueStatuses = [
  "backlog",
  "ready",
  "in_progress",
  "ready_for_review",
  "done",
] as const;

export const issuePriorities = ["low", "medium", "high", "urgent"] as const;
export const codeLinkTypes = ["branch", "commit", "pull_request"] as const;

export type IssueStatus = (typeof issueStatuses)[number];
export type IssuePriority = (typeof issuePriorities)[number];
export type CodeLinkType = (typeof codeLinkTypes)[number];

export type Session = {
  user: { id: string; name: string; email: string };
  workspace: {
    id: string;
    name: string;
    version: number;
    role: "owner" | "member";
  } | null;
};

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string;
  repositoryUrl: string | null;
  defaultBranch: string | null;
  repositorySubdirectory: string | null;
  showReviewColumn: boolean;
  showDoneColumn: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type EpicSummary = {
  totalIssues: number;
  doneIssues: number;
  statusCounts: Record<IssueStatus, number>;
};

export type Epic = {
  id: string;
  workspaceId: string;
  projectId: string;
  number: number;
  title: string;
  description: string;
  archivedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  summary: EpicSummary;
};

export function epicLabel(epic: Pick<Epic, "number" | "title">) {
  return `${epic.number}-${epic.title}`;
}

export const agentScopes = [
  "issues:read",
  "issues:create",
  "questions:write",
  "comments:write",
  "issues:claim",
  "issues:write",
  "code:link",
  "issues:review",
  "issues:close",
  "epics:create",
  "epics:write",
] as const;

export type AgentScope = (typeof agentScopes)[number];

export type Agent = {
  id: string;
  name: string;
  description: string;
  projects: Pick<Project, "id" | "name" | "key">[];
  projectIds: string[];
  scopes: AgentScope[];
  credential: {
    id: string;
    fingerprint: string;
    expiresAt: string | null;
    revokedAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
  } | null;
  access: {
    kind: "pat" | "oauth";
    expiresAt: string | null;
    revokedAt: string | null;
    lastUsedAt: string | null;
  };
  createdAt: string;
};

export type Issue = {
  id: string;
  workspaceId: string;
  projectId: string;
  epicId: string | null;
  number: number;
  key: string;
  title: string;
  description: string;
  priority: IssuePriority;
  status: IssueStatus;
  humanOwnerId: string;
  claimedByAgentId: string | null;
  claimedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  questionSummary?: QuestionSummary;
};

export type QuestionSummary = {
  total: number;
  answered: number;
  unansweredBlocking: number;
};

export function issueReference(issue: Pick<Issue, "number">) {
  return String(issue.number);
}

export function issueLabel(issue: Pick<Issue, "number" | "title">) {
  return `${issueReference(issue)}-${issue.title}`;
}

export function issueActivitySummary(
  summary: string,
  issue: Pick<Issue, "key" | "number">,
) {
  const escapedKey = issue.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return summary.replace(
    new RegExp(`(?<![\\w-])${escapedKey}(?![\\w-])`),
    issueReference(issue),
  );
}

export type IssueQuestionOption = {
  id: string;
  label: string;
  description: string;
};

export type IssueQuestion = {
  id: string;
  workspaceId: string;
  issueId: string;
  prompt: string;
  recommendation: string;
  options: IssueQuestionOption[];
  recommendedOptionId: string;
  blocking: boolean;
  answerOptionId: string | null;
  answerOtherText: string | null;
  answeredByUserId: string | null;
  answeredAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CodeLink = {
  id: string;
  workspaceId: string;
  issueId: string;
  type: CodeLinkType;
  url: string;
  createdAt: string;
};

export type IssueComment = {
  id: string;
  workspaceId: string;
  issueId: string;
  body: string;
  authorType: "human" | "agent" | "system";
  authorId: string;
  authorDisplayName: string;
  source: "rest" | "mcp" | "system" | "operator" | "chrome_extension";
  createdAt: string;
};

export type Activity = {
  id: string;
  issueId: string | null;
  type: string;
  actorType: "human" | "agent" | "system";
  actorId: string;
  actorDisplayName: string;
  source: "rest" | "mcp" | "system" | "operator" | "chrome_extension";
  summary: string;
  changes: Record<string, unknown>;
  createdAt: string;
};

export const statusLabels: Record<IssueStatus, string> = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Progress",
  ready_for_review: "Ready for Human Review",
  done: "Done",
};

export const priorityLabels: Record<IssuePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const codeLinkLabels: Record<CodeLinkType, string> = {
  branch: "Branch",
  commit: "Commit",
  pull_request: "Pull request",
};
