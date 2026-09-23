// Drizzle relations are intentionally centralized: they describe joins across
// cohesive table modules without making those modules depend on one another in
// both directions.
import { relations } from "drizzle-orm";
import {
  instanceOwner,
  membershipEvent,
  project,
  projectMembership,
  workspace,
  workspaceInvitation,
  workspaceInvitationEvent,
  workspaceInvitationProject,
  workspaceMembership,
} from "./access.js";
import {
  agentCredential,
  agentIdentity,
  agentProject,
  agentScope,
} from "./agents.js";
import { account, session, user } from "./identity.js";
import {
  activityEvent,
  codeLink,
  epic,
  issue,
  issueComment,
  issueQuestion,
} from "./tracker.js";

export const userRelations = relations(user, ({ many, one }) => ({
  accounts: many(account),
  sessions: many(session),
  memberships: many(workspaceMembership),
  projectMemberships: many(projectMembership),
  ownedInstance: one(instanceOwner),
  workspace: one(workspace),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const ownerRelations = relations(instanceOwner, ({ one }) => ({
  user: one(user, { fields: [instanceOwner.userId], references: [user.id] }),
}));

export const workspaceRelations = relations(workspace, ({ many, one }) => ({
  owner: one(user, { fields: [workspace.ownerId], references: [user.id] }),
  memberships: many(workspaceMembership),
  membershipEvents: many(membershipEvent),
  invitations: many(workspaceInvitation),
}));

export const workspaceMembershipRelations = relations(
  workspaceMembership,
  ({ many, one }) => ({
    workspace: one(workspace, {
      fields: [workspaceMembership.workspaceId],
      references: [workspace.id],
    }),
    user: one(user, {
      fields: [workspaceMembership.userId],
      references: [user.id],
    }),
    projects: many(projectMembership),
  }),
);

export const agentIdentityRelations = relations(
  agentIdentity,
  ({ many, one }) => ({
    workspace: one(workspace, {
      fields: [agentIdentity.workspaceId],
      references: [workspace.id],
    }),
    projects: many(agentProject),
    scopes: many(agentScope),
    credentials: many(agentCredential),
    claimedIssues: many(issue),
  }),
);

export const agentCredentialRelations = relations(
  agentCredential,
  ({ one }) => ({
    agent: one(agentIdentity, {
      fields: [agentCredential.agentId],
      references: [agentIdentity.id],
    }),
  }),
);

export const agentProjectRelations = relations(agentProject, ({ one }) => ({
  agent: one(agentIdentity, {
    fields: [agentProject.agentId],
    references: [agentIdentity.id],
  }),
  project: one(project, {
    fields: [agentProject.projectId],
    references: [project.id],
  }),
}));

export const agentScopeRelations = relations(agentScope, ({ one }) => ({
  agent: one(agentIdentity, {
    fields: [agentScope.agentId],
    references: [agentIdentity.id],
  }),
}));

export const projectRelations = relations(project, ({ many, one }) => ({
  workspace: one(workspace, {
    fields: [project.workspaceId],
    references: [workspace.id],
  }),
  epics: many(epic),
  issues: many(issue),
  activity: many(activityEvent),
  memberships: many(projectMembership),
  invitationProjects: many(workspaceInvitationProject),
}));

export const workspaceInvitationRelations = relations(
  workspaceInvitation,
  ({ many, one }) => ({
    workspace: one(workspace, {
      fields: [workspaceInvitation.workspaceId],
      references: [workspace.id],
    }),
    projects: many(workspaceInvitationProject),
    events: many(workspaceInvitationEvent),
  }),
);

export const workspaceInvitationProjectRelations = relations(
  workspaceInvitationProject,
  ({ one }) => ({
    invitation: one(workspaceInvitation, {
      fields: [workspaceInvitationProject.invitationId],
      references: [workspaceInvitation.id],
    }),
    project: one(project, {
      fields: [workspaceInvitationProject.projectId],
      references: [project.id],
    }),
  }),
);

export const workspaceInvitationEventRelations = relations(
  workspaceInvitationEvent,
  ({ one }) => ({
    invitation: one(workspaceInvitation, {
      fields: [workspaceInvitationEvent.invitationId],
      references: [workspaceInvitation.id],
    }),
  }),
);

export const projectMembershipRelations = relations(
  projectMembership,
  ({ one }) => ({
    project: one(project, {
      fields: [projectMembership.projectId],
      references: [project.id],
    }),
    workspaceMembership: one(workspaceMembership, {
      fields: [projectMembership.workspaceId, projectMembership.userId],
      references: [workspaceMembership.workspaceId, workspaceMembership.userId],
    }),
  }),
);

export const membershipEventRelations = relations(
  membershipEvent,
  ({ one }) => ({
    workspace: one(workspace, {
      fields: [membershipEvent.workspaceId],
      references: [workspace.id],
    }),
    project: one(project, {
      fields: [membershipEvent.projectId],
      references: [project.id],
    }),
  }),
);

export const epicRelations = relations(epic, ({ many, one }) => ({
  workspace: one(workspace, {
    fields: [epic.workspaceId],
    references: [workspace.id],
  }),
  project: one(project, {
    fields: [epic.projectId],
    references: [project.id],
  }),
  issues: many(issue),
}));

export const issueRelations = relations(issue, ({ many, one }) => ({
  workspace: one(workspace, {
    fields: [issue.workspaceId],
    references: [workspace.id],
  }),
  project: one(project, {
    fields: [issue.projectId],
    references: [project.id],
  }),
  epic: one(epic, {
    fields: [issue.epicId],
    references: [epic.id],
  }),
  humanOwner: one(user, {
    fields: [issue.humanOwnerId],
    references: [user.id],
  }),
  codeLinks: many(codeLink),
  questions: many(issueQuestion),
  comments: many(issueComment),
  activity: many(activityEvent),
}));

export const issueQuestionRelations = relations(issueQuestion, ({ one }) => ({
  issue: one(issue, {
    fields: [issueQuestion.issueId],
    references: [issue.id],
  }),
  answeredBy: one(user, {
    fields: [issueQuestion.answeredByUserId],
    references: [user.id],
  }),
}));

export const codeLinkRelations = relations(codeLink, ({ one }) => ({
  issue: one(issue, {
    fields: [codeLink.issueId],
    references: [issue.id],
  }),
}));

export const issueCommentRelations = relations(issueComment, ({ one }) => ({
  issue: one(issue, {
    fields: [issueComment.issueId],
    references: [issue.id],
  }),
}));

export const activityEventRelations = relations(activityEvent, ({ one }) => ({
  project: one(project, {
    fields: [activityEvent.projectId],
    references: [project.id],
  }),
  issue: one(issue, {
    fields: [activityEvent.issueId],
    references: [issue.id],
  }),
}));
