import type { Epic, Issue, IssueQuestion, Session } from "../../types.js";
import { epicLabel, issueLabel, priorityLabels } from "../../types.js";
import { DeleteIssueButton } from "../DeleteIssueButton.js";
import { AppLink, Badge, PageHeading } from "../ui.js";

export function IssueDetailHeader({
  issue,
  epic,
  questions,
  session,
  canEdit,
  busy,
}: {
  issue: Issue;
  epic: Epic | null;
  questions: IssueQuestion[];
  session: Session;
  canEdit: boolean;
  busy: boolean;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="issue-metadata">
          <Badge>{priorityLabels[issue.priority]}</Badge>
        </div>
        <PageHeading>{issueLabel(issue)}</PageHeading>
        <div className="issue-metadata">
          <span>
            Owner:{" "}
            {issue.humanOwnerId === session.user.id ? "You" : "Workspace owner"}
          </span>
          {epic ? (
            <>
              <AppLink className="badge epic-badge" href={`/epics/${epic.id}`}>
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
        {epic && !epic.archivedAt ? (
          <AppLink
            className="button button-secondary"
            href={`/projects/${issue.projectId}?epic=${epic.id}`}
          >
            View Epic on board
          </AppLink>
        ) : null}
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
            disabled={busy}
          />
        ) : null}
      </div>
    </div>
  );
}
