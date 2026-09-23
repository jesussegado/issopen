import { TrackerActivityCapability } from "./tracker-activity.js";
import {
  summarizeQuestions,
  TrackerDiscussionCapability,
} from "./tracker-discussion.js";
import { TrackerIssueCapability } from "./tracker-issues.js";
import { TrackerProjectCapability } from "./tracker-projects.js";
import type { TrackerDatabase } from "./tracker-support.js";
import { TrackerWorkflowCapability } from "./tracker-workflow.js";

export type { ActivityPageCursor } from "./tracker-activity.js";
export type { IssueClaimFilter, IssuePageCursor } from "./tracker-issues.js";
export type { ProjectPageCursor } from "./tracker-projects.js";

export class TrackerService {
  private readonly projects: TrackerProjectCapability;
  private readonly issues: TrackerIssueCapability;
  private readonly discussion: TrackerDiscussionCapability;
  private readonly workflow: TrackerWorkflowCapability;
  private readonly activity: TrackerActivityCapability;

  constructor(db: TrackerDatabase) {
    this.projects = new TrackerProjectCapability(db);
    this.issues = new TrackerIssueCapability(db);
    this.discussion = new TrackerDiscussionCapability(
      db,
      (workspaceId, issueId) => this.issues.getIssue(workspaceId, issueId),
    );
    this.workflow = new TrackerWorkflowCapability(db);
    this.activity = new TrackerActivityCapability(db, (workspaceId, issueId) =>
      this.issues.getIssue(workspaceId, issueId),
    );
  }

  createProject(
    ...args: Parameters<TrackerProjectCapability["createProject"]>
  ) {
    return this.projects.createProject(...args);
  }

  listProjects(...args: Parameters<TrackerProjectCapability["listProjects"]>) {
    return this.projects.listProjects(...args);
  }

  listProjectPage(
    ...args: Parameters<TrackerProjectCapability["listProjectPage"]>
  ) {
    return this.projects.listProjectPage(...args);
  }

  getProject(...args: Parameters<TrackerProjectCapability["getProject"]>) {
    return this.projects.getProject(...args);
  }

  updateProject(
    ...args: Parameters<TrackerProjectCapability["updateProject"]>
  ) {
    return this.projects.updateProject(...args);
  }

  createEpic(...args: Parameters<TrackerProjectCapability["createEpic"]>) {
    return this.projects.createEpic(...args);
  }

  listEpics(...args: Parameters<TrackerProjectCapability["listEpics"]>) {
    return this.projects.listEpics(...args);
  }

  getEpic(...args: Parameters<TrackerProjectCapability["getEpic"]>) {
    return this.projects.getEpic(...args);
  }

  listEpicPage(...args: Parameters<TrackerProjectCapability["listEpicPage"]>) {
    return this.projects.listEpicPage(...args);
  }

  getEpicSummary(
    ...args: Parameters<TrackerProjectCapability["getEpicSummary"]>
  ) {
    return this.projects.getEpicSummary(...args);
  }

  updateEpic(...args: Parameters<TrackerProjectCapability["updateEpic"]>) {
    return this.projects.updateEpic(...args);
  }

  async getEpicDetail(workspaceId: string, epicId: string) {
    const foundEpic = await this.projects.getEpic(workspaceId, epicId);
    const [issues, detailedEpic] = await Promise.all([
      this.issues.listIssues(
        workspaceId,
        foundEpic.projectId,
        foundEpic.id,
        true,
      ),
      this.projects.getEpicSummary(workspaceId, epicId),
    ]);
    return { epic: detailedEpic, issues };
  }

  createIssue(...args: Parameters<TrackerIssueCapability["createIssue"]>) {
    return this.issues.createIssue(...args);
  }

  listIssues(...args: Parameters<TrackerIssueCapability["listIssues"]>) {
    return this.issues.listIssues(...args);
  }

  listIssuePage(...args: Parameters<TrackerIssueCapability["listIssuePage"]>) {
    return this.issues.listIssuePage(...args);
  }

  getIssue(...args: Parameters<TrackerIssueCapability["getIssue"]>) {
    return this.issues.getIssue(...args);
  }

  updateIssue(...args: Parameters<TrackerIssueCapability["updateIssue"]>) {
    return this.issues.updateIssue(...args);
  }

  deleteIssue(...args: Parameters<TrackerIssueCapability["deleteIssue"]>) {
    return this.issues.deleteIssue(...args);
  }

  async getIssueDetail(
    workspaceId: string,
    issueId: string,
    viewerId?: string,
  ) {
    const foundIssue = await this.issues.getIssue(workspaceId, issueId);
    const [links, questions, comments, foundEpic] = await Promise.all([
      this.workflow.listCodeLinks(workspaceId, issueId),
      this.discussion.listIssueQuestions(workspaceId, issueId),
      this.discussion.listIssueComments(workspaceId, issueId),
      foundIssue.epicId
        ? this.projects.getEpic(workspaceId, foundIssue.epicId)
        : Promise.resolve(null),
    ]);
    return {
      issue: {
        ...foundIssue,
        questionSummary: summarizeQuestions(questions, viewerId),
      },
      codeLinks: links,
      questions,
      comments,
      epic: foundEpic,
      questionSummary: summarizeQuestions(questions, viewerId),
    };
  }

  listIssueComments(
    ...args: Parameters<TrackerDiscussionCapability["listIssueComments"]>
  ) {
    return this.discussion.listIssueComments(...args);
  }

  addIssueComment(
    ...args: Parameters<TrackerDiscussionCapability["addIssueComment"]>
  ) {
    return this.discussion.addIssueComment(...args);
  }

  listIssueQuestions(
    ...args: Parameters<TrackerDiscussionCapability["listIssueQuestions"]>
  ) {
    return this.discussion.listIssueQuestions(...args);
  }

  createIssueQuestion(
    ...args: Parameters<TrackerDiscussionCapability["createIssueQuestion"]>
  ) {
    return this.discussion.createIssueQuestion(...args);
  }

  answerIssueQuestion(
    ...args: Parameters<TrackerDiscussionCapability["answerIssueQuestion"]>
  ) {
    return this.discussion.answerIssueQuestion(...args);
  }

  claimIssue(...args: Parameters<TrackerWorkflowCapability["claimIssue"]>) {
    return this.workflow.claimIssue(...args);
  }

  releaseIssue(...args: Parameters<TrackerWorkflowCapability["releaseIssue"]>) {
    return this.workflow.releaseIssue(...args);
  }

  addCodeLink(...args: Parameters<TrackerWorkflowCapability["addCodeLink"]>) {
    return this.workflow.addCodeLink(...args);
  }

  acceptResult(...args: Parameters<TrackerWorkflowCapability["acceptResult"]>) {
    return this.workflow.acceptResult(...args);
  }

  requestChanges(
    ...args: Parameters<TrackerWorkflowCapability["requestChanges"]>
  ) {
    return this.workflow.requestChanges(...args);
  }

  listActivity(...args: Parameters<TrackerActivityCapability["listActivity"]>) {
    return this.activity.listActivity(...args);
  }

  listActivityPage(
    ...args: Parameters<TrackerActivityCapability["listActivityPage"]>
  ) {
    return this.activity.listActivityPage(...args);
  }
}
