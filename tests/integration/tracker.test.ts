import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDatabase,
  type DatabaseConnection,
} from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import {
  activityEvent,
  agentIdentity,
  codeLink,
  issue,
  issueComment,
  user,
  workspace,
} from "../../src/server/db/schema.js";
import {
  type MutationContext,
  TrackerService,
} from "../../src/server/domain/index.js";

let container: StartedPostgreSqlContainer;
let connection: DatabaseConnection;
let tracker: TrackerService;

const ownerId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const ownerContext: MutationContext = {
  workspaceId,
  actor: { type: "human", id: ownerId, displayName: "Private Owner" },
  source: "rest",
};

async function createFixtureWorkspace(
  id = workspaceId,
  fixtureOwnerId = ownerId,
) {
  await connection.db.insert(user).values({
    id: fixtureOwnerId,
    name: `Owner ${fixtureOwnerId.slice(0, 4)}`,
    email: `${fixtureOwnerId}@example.test`,
  });
  await connection.db.insert(workspace).values({
    id,
    ownerId: fixtureOwnerId,
    name: `Workspace ${id.slice(0, 4)}`,
  });
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  await migrateDatabase(container.getConnectionUri());
  connection = createDatabase(container.getConnectionUri());
  tracker = new TrackerService(connection.db);
}, 120_000);

beforeEach(async () => {
  await connection.client.unsafe(
    'TRUNCATE TABLE "activity_event", "code_link", "issue", "project", "verification", "session", "account", "workspace", "instance_owner", "user" CASCADE',
  );
  await createFixtureWorkspace();
});

afterAll(async () => {
  await connection?.close();
  await container?.stop();
});

describe("transactional tracker domain", () => {
  it("soft-deletes exactly once, hides all reads and preserves audit, questions and numbering", async () => {
    const p = await tracker.createProject(ownerContext, {
      name: "Deletion",
      key: "DEL",
    });
    const e = await tracker.createEpic(ownerContext, {
      projectId: p.id,
      title: "Epic",
    });
    const i = await tracker.createIssue(ownerContext, {
      projectId: p.id,
      epicId: e.id,
      title: "Delete me",
    });
    await tracker.addIssueComment(ownerContext, i.id, { body: "Keep history" });
    const q = await tracker.createIssueQuestion(ownerContext, i.id, {
      prompt: "Choose?",
      recommendation: "A",
      options: [{ label: "A" }, { label: "B" }],
      recommendedOptionIndex: 0,
    });
    const input = {
      expectedVersion: i.version,
      questionVersions: [{ id: q.id, version: q.version }],
    };
    const results = await Promise.all([
      tracker.deleteIssue(ownerContext, i.id, input),
      tracker.deleteIssue(ownerContext, i.id, input),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await tracker.listIssues(workspaceId, p.id)).toEqual([]);
    expect(
      (
        await tracker.listIssuePage(workspaceId, {
          projectIds: [p.id],
          claim: "any",
          agentId: ownerId,
          limit: 50,
        })
      ).items,
    ).toEqual([]);
    expect((await tracker.getEpicDetail(workspaceId, e.id)).issues).toEqual([]);
    expect(
      (await tracker.getEpicSummary(workspaceId, e.id)).summary.totalIssues,
    ).toBe(0);
    expect(
      (await tracker.listEpics(workspaceId, p.id))[0]?.summary.totalIssues,
    ).toBe(0);
    for (const read of [
      () => tracker.getIssueDetail(workspaceId, i.id),
      () => tracker.listIssueQuestions(workspaceId, i.id),
      () => tracker.listIssueComments(workspaceId, i.id),
      () => tracker.listActivity(workspaceId, i.id),
      () => tracker.listActivityPage(workspaceId, i.id, { limit: 50 }),
    ])
      await expect(read()).rejects.toMatchObject({ code: "not_found" });
    const [retained] = await connection.db
      .select()
      .from(issue)
      .where(eq(issue.id, i.id));
    expect(retained).toMatchObject({
      deletedAt: expect.any(Date),
      version: 2,
      claimedByAgentId: null,
      claimedAt: null,
    });
    expect(await connection.db.select().from(issueComment)).toHaveLength(1);
    const events = await connection.db.select().from(activityEvent);
    expect(events.filter(({ type }) => type === "issue.deleted")).toHaveLength(
      1,
    );
    expect(events.find(({ type }) => type === "issue.deleted")).toMatchObject({
      actorId: ownerId,
      source: "rest",
    });
    expect(
      (
        await tracker.createIssue(ownerContext, {
          projectId: p.id,
          title: "Next",
        })
      ).number,
    ).toBe(i.number + 1);
  });

  it("rejects agents, extension context, other owners and stale deletion confirmations", async () => {
    const p = await tracker.createProject(ownerContext, {
      name: "Delete guards",
      key: "DG",
    });
    const i = await tracker.createIssue(ownerContext, {
      projectId: p.id,
      title: "Keep me",
    });
    const input = { expectedVersion: i.version, questionVersions: [] };
    for (const ctx of [
      {
        ...ownerContext,
        actor: { ...ownerContext.actor, type: "agent" as const },
        authorization: { canCloseIssues: true },
      },
      { ...ownerContext, source: "chrome_extension" as const },
      {
        ...ownerContext,
        actor: {
          ...ownerContext.actor,
          id: "44444444-4444-4444-8444-444444444444",
        },
      },
    ])
      await expect(tracker.deleteIssue(ctx, i.id, input)).rejects.toMatchObject(
        { code: "forbidden" },
      );
    await expect(
      tracker.deleteIssue(ownerContext, i.id, { ...input, expectedVersion: 2 }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      tracker.deleteIssue(ownerContext, i.id, {} as never),
    ).rejects.toMatchObject({ code: "invalid" });
    const q = await tracker.createIssueQuestion(ownerContext, i.id, {
      prompt: "Choose?",
      recommendation: "A",
      options: [{ label: "A" }, { label: "B" }],
      recommendedOptionIndex: 0,
    });
    await expect(
      tracker.deleteIssue(ownerContext, i.id, input),
    ).rejects.toMatchObject({ code: "conflict" });
    await tracker.answerIssueQuestion(ownerContext, i.id, q.id, {
      kind: "other",
      text: "Changed",
    });
    await expect(
      tracker.deleteIssue(ownerContext, i.id, {
        ...input,
        questionVersions: [{ id: q.id, version: q.version }],
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    const otherOwner = "44444444-4444-4444-8444-444444444444";
    const otherWorkspace = "55555555-5555-4555-8555-555555555555";
    await createFixtureWorkspace(otherWorkspace, otherOwner);
    await expect(
      tracker.deleteIssue(
        {
          ...ownerContext,
          workspaceId: otherWorkspace,
          actor: { ...ownerContext.actor, id: otherOwner },
        },
        i.id,
        input,
      ),
    ).rejects.toMatchObject({ code: "not_found" });
    expect((await tracker.getIssue(workspaceId, i.id)).deletedAt).toBeNull();
  });

  it("rejects every mutation of a deleted ticket and serializes competing edits", async () => {
    const p = await tracker.createProject(ownerContext, {
      name: "Race",
      key: "RC",
    });
    const i = await tracker.createIssue(ownerContext, {
      projectId: p.id,
      title: "Race",
    });
    const q = await tracker.createIssueQuestion(ownerContext, i.id, {
      prompt: "Choose?",
      recommendation: "A",
      options: [{ label: "A" }, { label: "B" }],
      recommendedOptionIndex: 0,
    });
    const input = {
      expectedVersion: i.version,
      questionVersions: [{ id: q.id, version: q.version }],
    };
    const results = await Promise.allSettled([
      tracker.deleteIssue(ownerContext, i.id, input),
      tracker.updateIssue(ownerContext, i.id, {
        title: "Raced edit",
        expectedVersion: i.version,
      }),
    ]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const [row] = await connection.db
      .select()
      .from(issue)
      .where(eq(issue.id, i.id));
    if (!row?.deletedAt)
      await tracker.deleteIssue(ownerContext, i.id, {
        ...input,
        expectedVersion: row?.version ?? 0,
      });
    const before = await connection.db.select().from(activityEvent);
    for (const mutate of [
      () => tracker.updateIssue(ownerContext, i.id, { title: "Restore?" }),
      () => tracker.addIssueComment(ownerContext, i.id, { body: "Too late" }),
      () =>
        tracker.createIssueQuestion(ownerContext, i.id, {
          prompt: "Choose?",
          recommendation: "A",
          options: [{ label: "A" }, { label: "B" }],
          recommendedOptionIndex: 0,
        }),
      () =>
        tracker.answerIssueQuestion(ownerContext, i.id, q.id, {
          kind: "other",
          text: "Too late",
        }),
      () => tracker.claimIssue(ownerContext, i.id, ownerId),
      () => tracker.releaseIssue(ownerContext, i.id),
      () =>
        tracker.addCodeLink(ownerContext, i.id, {
          type: "commit",
          url: "https://example.test/commit",
        }),
      () => tracker.acceptResult(ownerContext, i.id),
      () => tracker.requestChanges(ownerContext, i.id, { reason: "Too late" }),
    ])
      await expect(mutate()).rejects.toMatchObject({ code: "not_found" });
    expect(await connection.db.select().from(activityEvent)).toEqual(before);
  });

  it("atomically rejects concurrent stale issue and Epic drafts", async () => {
    const p = await tracker.createProject(ownerContext, {
      name: "Concurrency",
      key: "CAS",
    });
    const i = await tracker.createIssue(ownerContext, {
      projectId: p.id,
      title: "Original",
    });
    const e = await tracker.createEpic(ownerContext, {
      projectId: p.id,
      title: "Original Epic",
    });
    const edits = await Promise.allSettled([
      tracker.updateIssue(ownerContext, i.id, {
        description: "Editor A",
        expectedVersion: i.version,
        questionVersions: [],
      }),
      tracker.updateIssue(ownerContext, i.id, {
        description: "Editor B",
        expectedVersion: i.version,
        questionVersions: [],
      }),
    ]);
    expect(
      edits.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(edits.filter((result) => result.status === "rejected")).toHaveLength(
      1,
    );
    const epics = await Promise.allSettled([
      tracker.updateEpic(ownerContext, e.id, {
        description: "A",
        expectedVersion: e.version,
      }),
      tracker.updateEpic(ownerContext, e.id, {
        description: "B",
        expectedVersion: e.version,
      }),
    ]);
    expect(
      epics.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(epics.filter((result) => result.status === "rejected")).toHaveLength(
      1,
    );
    expect((await tracker.getIssue(workspaceId, i.id)).version).toBe(
      i.version + 1,
    );
    expect((await tracker.getEpic(workspaceId, e.id)).version).toBe(
      e.version + 1,
    );
  });

  it("detects changed and newly added questions even when issue.version stays unchanged", async () => {
    const p = await tracker.createProject(ownerContext, {
      name: "Questions",
      key: "QV",
    });
    const i = await tracker.createIssue(ownerContext, {
      projectId: p.id,
      title: "Plan",
    });
    const question = {
      prompt: "Decision?",
      recommendation: "Choose A",
      options: [{ label: "A" }, { label: "B" }],
      recommendedOptionIndex: 0,
    };
    const q = await tracker.createIssueQuestion(ownerContext, i.id, question);
    await tracker.answerIssueQuestion(ownerContext, i.id, q.id, {
      kind: "other",
      text: "Keep existing UI",
    });
    expect((await tracker.getIssue(workspaceId, i.id)).version).toBe(i.version);
    await expect(
      tracker.updateIssue(ownerContext, i.id, {
        description: "Stale decision",
        expectedVersion: i.version,
        questionVersions: [{ id: q.id, version: q.version }],
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    const current = await tracker.listIssueQuestions(workspaceId, i.id);
    await tracker.createIssueQuestion(ownerContext, i.id, question);
    await expect(
      tracker.updateIssue(ownerContext, i.id, {
        description: "Incomplete decisions",
        expectedVersion: i.version,
        questionVersions: current.map(({ id, version }) => ({ id, version })),
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect((await tracker.getIssue(workspaceId, i.id)).description).toBe("");
  });
  it("keeps project and monotonic issue keys stable through edits", async () => {
    const createdProject = await tracker.createProject(ownerContext, {
      name: "Issopen",
      key: "iss",
      description: "Private dogfood tracker",
      repositoryUrl: "https://example.test/issopen.git",
      defaultBranch: "main",
      repositorySubdirectory: ".",
    });
    expect(createdProject).toMatchObject({
      showReviewColumn: true,
      showDoneColumn: true,
    });

    const createdIssues = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        tracker.createIssue(ownerContext, {
          projectId: createdProject.id,
          title: `Issue ${index + 1}`,
          priority: "high",
        }),
      ),
    );
    expect(
      createdIssues.map((item) => item.number).sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    expect(new Set(createdIssues.map((item) => item.key)).size).toBe(12);

    const firstIssue = createdIssues.find((item) => item.number === 1);
    if (!firstIssue) throw new Error("Expected first issue fixture");
    const updatedProject = await tracker.updateProject(
      ownerContext,
      createdProject.id,
      {
        name: "Issopen Tracker",
        description: "Renamed without changing keys",
        showReviewColumn: false,
        showDoneColumn: false,
      },
    );
    const updatedIssue = await tracker.updateIssue(
      ownerContext,
      firstIssue.id,
      {
        title: "Stable key after edit",
        status: "ready",
      },
    );

    expect(updatedProject.key).toBe("ISS");
    expect(updatedProject).toMatchObject({
      showReviewColumn: false,
      showDoneColumn: false,
    });
    expect(updatedIssue.key).toBe("ISS-1");
    expect(updatedIssue.version).toBe(2);
    await expect(
      tracker.updateProject(ownerContext, createdProject.id, {
        key: "NEW",
      } as never),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("assigns stable project-local Epic numbers under concurrent creation", async () => {
    const firstProject = await tracker.createProject(ownerContext, {
      name: "Epics",
      key: "EP",
    });
    const secondProject = await tracker.createProject(ownerContext, {
      name: "Independent numbers",
      key: "IN",
    });
    const created = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        tracker.createEpic(ownerContext, {
          projectId: firstProject.id,
          title: `Epic ${index + 1}`,
        }),
      ),
    );
    expect(created.map((item) => item.number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
    expect(
      (await tracker.listEpics(workspaceId, firstProject.id)).map(
        (item) => item.number,
      ),
    ).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
    const first = created.find((item) => item.number === 1);
    if (!first) throw new Error("Expected first Epic");
    expect(
      await tracker.updateEpic(ownerContext, first.id, { title: "Renamed" }),
    ).toMatchObject({
      id: first.id,
      number: 1,
      title: "Renamed",
    });
    await expect(
      tracker.updateEpic(ownerContext, first.id, { number: 9 } as never),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(
      await tracker.createEpic(ownerContext, {
        projectId: secondProject.id,
        title: "First here",
      }),
    ).toMatchObject({ number: 1 });
    expect(
      await tracker.createIssue(ownerContext, {
        projectId: firstProject.id,
        title: "Independent issue counter",
      }),
    ).toMatchObject({ number: 1 });
  });

  it("groups issues in project-scoped epics with deterministic summaries", async () => {
    const firstProject = await tracker.createProject(ownerContext, {
      name: "Issopen",
      key: "ISS",
    });
    const secondProject = await tracker.createProject(ownerContext, {
      name: "Other",
      key: "OTH",
    });
    const createdEpic = await tracker.createEpic(ownerContext, {
      projectId: firstProject.id,
      title: "Close the private MVP",
      description: "Group the remaining acceptance work.",
    });
    const backlog = await tracker.createIssue(ownerContext, {
      projectId: firstProject.id,
      epicId: createdEpic.id,
      title: "Validate ChatGPT",
    });
    await tracker.createIssue(ownerContext, {
      projectId: firstProject.id,
      epicId: createdEpic.id,
      title: "Validate deployment",
      status: "done",
    });
    const unassigned = await tracker.createIssue(ownerContext, {
      projectId: firstProject.id,
      title: "Unplanned follow-up",
    });

    expect(await tracker.listEpics(workspaceId, firstProject.id)).toEqual([
      expect.objectContaining({
        id: createdEpic.id,
        summary: {
          totalIssues: 2,
          doneIssues: 1,
          statusCounts: {
            backlog: 1,
            ready: 0,
            in_progress: 0,
            ready_for_review: 0,
            done: 1,
          },
        },
      }),
    ]);
    expect(
      (await tracker.getEpicDetail(workspaceId, createdEpic.id)).issues.map(
        (item) => item.id,
      ),
    ).toEqual([backlog.id, expect.any(String)]);
    expect(
      (await tracker.listIssues(workspaceId, firstProject.id, null)).map(
        (item) => item.id,
      ),
    ).toEqual([unassigned.id]);

    const renamed = await tracker.updateEpic(ownerContext, createdEpic.id, {
      title: "Private MVP acceptance",
    });
    expect(renamed).toMatchObject({
      title: "Private MVP acceptance",
      version: 2,
    });
    const detached = await tracker.updateIssue(ownerContext, backlog.id, {
      epicId: null,
    });
    expect(detached.epicId).toBeNull();
    expect(
      (await tracker.listActivity(workspaceId, backlog.id)).at(-1),
    ).toMatchObject({
      type: "issue.updated",
      changes: {
        epicId: { from: createdEpic.id, to: null },
      },
    });

    await expect(
      tracker.createIssue(ownerContext, {
        projectId: secondProject.id,
        epicId: createdEpic.id,
        title: "Cross-project association",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      tracker.updateIssue(ownerContext, unassigned.id, {
        epicId: (
          await tracker.createEpic(ownerContext, {
            projectId: secondProject.id,
            title: "Other project Epic",
          })
        ).id,
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(
      (
        await tracker.createIssue(ownerContext, {
          projectId: secondProject.id,
          title: "Counter remains atomic",
        })
      ).key,
    ).toBe("OTH-1");
  });

  it("archives and restores Epics without losing tickets or accepting new associations", async () => {
    const createdProject = await tracker.createProject(ownerContext, {
      name: "Archive Epics",
      key: "ARC",
    });
    const createdEpic = await tracker.createEpic(ownerContext, {
      projectId: createdProject.id,
      title: "Finished initiative",
    });
    const linkedIssue = await tracker.createIssue(ownerContext, {
      projectId: createdProject.id,
      epicId: createdEpic.id,
      title: "Retained ticket",
    });
    const unassignedIssue = await tracker.createIssue(ownerContext, {
      projectId: createdProject.id,
      title: "Future ticket",
    });

    const archived = await tracker.updateEpic(ownerContext, createdEpic.id, {
      archived: true,
      expectedVersion: createdEpic.version,
    });
    expect(archived).toMatchObject({
      id: createdEpic.id,
      archivedAt: expect.any(Date),
      version: 2,
    });
    expect(await tracker.listEpics(workspaceId, createdProject.id)).toEqual([]);
    expect(
      await tracker.listEpics(workspaceId, createdProject.id, "archived"),
    ).toEqual([
      expect.objectContaining({
        id: createdEpic.id,
        summary: expect.objectContaining({ totalIssues: 1 }),
      }),
    ]);
    expect(
      await tracker.listEpics(workspaceId, createdProject.id, "all"),
    ).toHaveLength(1);
    expect(
      (await tracker.getEpicDetail(workspaceId, createdEpic.id)).issues.map(
        (item) => item.id,
      ),
    ).toEqual([linkedIssue.id]);
    expect(
      (await tracker.listIssues(workspaceId, createdProject.id)).map(
        (item) => item.id,
      ),
    ).toEqual([unassignedIssue.id]);
    expect(await tracker.getIssue(workspaceId, linkedIssue.id)).toMatchObject({
      status: linkedIssue.status,
      epicId: createdEpic.id,
    });

    await expect(
      tracker.createIssue(ownerContext, {
        projectId: createdProject.id,
        epicId: createdEpic.id,
        title: "Late ticket",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      tracker.updateIssue(ownerContext, unassignedIssue.id, {
        epicId: createdEpic.id,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(
      await tracker.updateIssue(ownerContext, linkedIssue.id, {
        title: "Retained ticket updated",
      }),
    ).toMatchObject({ epicId: createdEpic.id });

    await expect(
      tracker.updateEpic(ownerContext, createdEpic.id, {
        archived: false,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    const restored = await tracker.updateEpic(ownerContext, createdEpic.id, {
      archived: false,
      expectedVersion: archived.version,
    });
    expect(restored).toMatchObject({ archivedAt: null, version: 3 });
    expect(
      await tracker.listEpics(workspaceId, createdProject.id),
    ).toHaveLength(1);
    expect(
      (await tracker.listIssues(workspaceId, createdProject.id)).map(
        (item) => ({ id: item.id, status: item.status }),
      ),
    ).toEqual([
      { id: linkedIssue.id, status: linkedIssue.status },
      { id: unassignedIssue.id, status: unassignedIssue.status },
    ]);
    expect(
      (await connection.db.select().from(activityEvent)).map(
        (event) => event.type,
      ),
    ).toEqual([
      "project.created",
      "epic.created",
      "issue.created",
      "issue.created",
      "epic.archived",
      "issue.updated",
      "epic.restored",
    ]);
  });

  it("keeps human ownership independent from an attributed agent claim", async () => {
    const createdProject = await tracker.createProject(ownerContext, {
      name: "Issopen",
      key: "ISS",
    });
    const createdIssue = await tracker.createIssue(ownerContext, {
      projectId: createdProject.id,
      title: "Implement claims",
    });
    const agentId = "agent-codex-synthetic";
    await connection.db.insert(agentIdentity).values({
      id: agentId,
      workspaceId,
      name: "Codex",
    });
    const agentContext: MutationContext = {
      workspaceId,
      actor: { type: "agent", id: agentId, displayName: "Codex" },
      source: "mcp",
    };

    const claimed = await tracker.claimIssue(
      agentContext,
      createdIssue.id,
      agentId,
    );
    expect(claimed.humanOwnerId).toBe(ownerId);
    expect(claimed.claimedByAgentId).toBe(agentId);
    expect(claimed.claimedAt).toBeInstanceOf(Date);

    const activity = await tracker.listActivity(workspaceId, createdIssue.id);
    expect(activity.at(-1)).toMatchObject({
      type: "issue.claimed",
      actorType: "agent",
      actorId: agentId,
      actorDisplayName: "Codex",
      source: "mcp",
    });
  });

  it("tracks blocking questions, one editable human answer and its history", async () => {
    const createdProject = await tracker.createProject(ownerContext, {
      name: "Issopen",
      key: "ISS",
    });
    const createdIssue = await tracker.createIssue(ownerContext, {
      projectId: createdProject.id,
      title: "Resolve a product decision",
    });
    const agentContext: MutationContext = {
      workspaceId,
      actor: { type: "agent", id: "agent-planner", displayName: "Planner" },
      source: "mcp",
    };
    const question = await tracker.createIssueQuestion(
      agentContext,
      createdIssue.id,
      {
        prompt: "Which answer model should we use?",
        recommendation: "Keep one editable current answer.",
        options: [
          { label: "Current answer", description: "Simple and clear" },
          { label: "Answer thread", description: "More complex" },
        ],
        recommendedOptionIndex: 0,
      },
    );
    expect(
      (await tracker.getIssueDetail(workspaceId, createdIssue.id))
        .questionSummary,
    ).toEqual({ total: 1, answered: 0, unansweredBlocking: 1 });

    await expect(
      tracker.answerIssueQuestion(agentContext, createdIssue.id, question.id, {
        kind: "option",
        optionId: question.options[0]?.id ?? "",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    const answered = await tracker.answerIssueQuestion(
      ownerContext,
      createdIssue.id,
      question.id,
      { kind: "option", optionId: question.options[0]?.id ?? "" },
    );
    expect(answered.answerOptionId).toBe(question.recommendedOptionId);
    expect(
      (await tracker.getIssueDetail(workspaceId, createdIssue.id))
        .questionSummary,
    ).toEqual({ total: 1, answered: 1, unansweredBlocking: 0 });

    const changed = await tracker.answerIssueQuestion(
      ownerContext,
      createdIssue.id,
      question.id,
      { kind: "other", text: "Use a reviewed hybrid." },
    );
    expect(changed).toMatchObject({
      answerOptionId: null,
      answerOtherText: "Use a reviewed hybrid.",
      version: 3,
    });
    expect(
      (await tracker.listActivity(workspaceId, createdIssue.id))
        .slice(-3)
        .map((event) => event.type),
    ).toEqual([
      "issue.question_added",
      "issue.question_answered",
      "issue.question_answer_changed",
    ]);

    await expect(
      tracker.answerIssueQuestion(ownerContext, createdIssue.id, question.id, {
        kind: "option",
        optionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("requires every blocking question to be answered before review", async () => {
    const createdProject = await tracker.createProject(ownerContext, {
      name: "Issopen",
      key: "ISS",
    });
    const createdIssue = await tracker.createIssue(ownerContext, {
      projectId: createdProject.id,
      title: "Gate review on product decisions",
    });
    const blockingQuestion = await tracker.createIssueQuestion(
      ownerContext,
      createdIssue.id,
      {
        prompt: "Can this enter review?",
        recommendation: "Answer the blocker first.",
        options: [
          { label: "Yes", description: "The decision is resolved" },
          { label: "No", description: "More work is required" },
        ],
        recommendedOptionIndex: 0,
        blocking: true,
      },
    );
    await tracker.createIssueQuestion(ownerContext, createdIssue.id, {
      prompt: "Which optional follow-up should we use?",
      recommendation: "Leave it for later.",
      options: [
        { label: "Later", description: "Does not block review" },
        { label: "Now", description: "Resolve it in this iteration" },
      ],
      recommendedOptionIndex: 0,
      blocking: false,
    });

    await expect(
      tracker.updateIssue(ownerContext, createdIssue.id, {
        status: "ready_for_review",
      }),
    ).rejects.toMatchObject({
      code: "conflict",
      message:
        "Answer all blocking questions before moving this issue to Ready for Human Review",
    });
    expect((await tracker.getIssue(workspaceId, createdIssue.id)).status).toBe(
      "backlog",
    );
    expect(
      (await tracker.listActivity(workspaceId, createdIssue.id)).some(
        (event) => event.type === "issue.status_changed",
      ),
    ).toBe(false);

    await tracker.answerIssueQuestion(
      ownerContext,
      createdIssue.id,
      blockingQuestion.id,
      {
        kind: "option",
        optionId: blockingQuestion.options[0]?.id ?? "",
      },
    );
    expect(
      (
        await tracker.updateIssue(ownerContext, createdIssue.id, {
          status: "ready_for_review",
        })
      ).status,
    ).toBe("ready_for_review");
  });

  it("uses Done as the completion target when human review is disabled", async () => {
    const createdProject = await tracker.createProject(ownerContext, {
      name: "Direct completion",
      key: "DIR",
    });
    await tracker.updateProject(ownerContext, createdProject.id, {
      showReviewColumn: false,
    });
    const createdIssue = await tracker.createIssue(ownerContext, {
      projectId: createdProject.id,
      title: "Finish without human review",
      status: "in_progress",
    });

    await expect(
      tracker.updateIssue(ownerContext, createdIssue.id, {
        status: "ready_for_review",
      }),
    ).rejects.toMatchObject({
      code: "conflict",
      message:
        "This project skips Ready for Human Review. Move the issue directly to Done.",
    });

    const agentContext: MutationContext = {
      workspaceId,
      actor: { type: "agent", id: "direct-agent", displayName: "Codex" },
      source: "mcp",
    };
    await expect(
      tracker.updateIssue(agentContext, createdIssue.id, { status: "done" }),
    ).rejects.toMatchObject({
      code: "forbidden",
      message: "Closing issues requires explicit permission",
    });
    expect(
      (
        await tracker.updateIssue(
          {
            ...agentContext,
            authorization: { canCloseIssues: true },
          },
          createdIssue.id,
          { status: "done" },
        )
      ).status,
    ).toBe("done");
  });

  it("scopes every lookup by workspace and never leaks foreign identifiers", async () => {
    const secondOwnerId = "33333333-3333-4333-8333-333333333333";
    const secondWorkspaceId = "44444444-4444-4444-8444-444444444444";
    await createFixtureWorkspace(secondWorkspaceId, secondOwnerId);
    const secondContext: MutationContext = {
      workspaceId: secondWorkspaceId,
      actor: {
        type: "human",
        id: secondOwnerId,
        displayName: "Second Owner",
      },
      source: "rest",
    };
    const foreignProject = await tracker.createProject(secondContext, {
      name: "Foreign project",
      key: "FOR",
    });
    const foreignIssue = await tracker.createIssue(secondContext, {
      projectId: foreignProject.id,
      title: "Private foreign issue",
    });
    const foreignEpic = await tracker.createEpic(secondContext, {
      projectId: foreignProject.id,
      title: "Private foreign Epic",
    });

    await expect(
      tracker.getProject(workspaceId, foreignProject.id),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      tracker.getIssue(workspaceId, foreignIssue.id),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      tracker.getEpic(workspaceId, foreignEpic.id),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      tracker.updateIssue(ownerContext, foreignIssue.id, { title: "Stolen" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rolls back rejected mutations and makes activity append-only", async () => {
    const createdProject = await tracker.createProject(ownerContext, {
      name: "Issopen",
      key: "ISS",
    });
    const createdIssue = await tracker.createIssue(ownerContext, {
      projectId: createdProject.id,
      title: "Atomic activity",
    });
    const beforeEvents = await connection.db
      .select({ value: count() })
      .from(activityEvent);

    await expect(
      tracker.addCodeLink(ownerContext, createdIssue.id, {
        type: "commit",
        url: "file:///etc/passwd",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
    expect(
      (await connection.db.select({ value: count() }).from(codeLink))[0]?.value,
    ).toBe(0);
    expect(
      (await connection.db.select({ value: count() }).from(activityEvent))[0]
        ?.value,
    ).toBe(beforeEvents[0]?.value);

    const event = (await tracker.listActivity(workspaceId, createdIssue.id))[0];
    if (!event) throw new Error("Expected issue activity fixture");
    await expect(
      connection.db
        .update(activityEvent)
        .set({ summary: "forged" })
        .where(eq(activityEvent.id, event.id)),
    ).rejects.toThrow();
    await expect(
      connection.db.delete(activityEvent).where(eq(activityEvent.id, event.id)),
    ).rejects.toThrow();
  });

  it("stores comments as immutable, server-attributed issue data", async () => {
    const createdProject = await tracker.createProject(ownerContext, {
      name: "Issopen",
      key: "ISS",
    });
    const createdIssue = await tracker.createIssue(ownerContext, {
      projectId: createdProject.id,
      title: "Attributed comments",
    });
    const humanComment = await tracker.addIssueComment(
      ownerContext,
      createdIssue.id,
      { body: "Human checkpoint" },
    );
    const agentContext: MutationContext = {
      workspaceId,
      actor: {
        type: "agent",
        id: "codex-commenter",
        displayName: "Codex commenter",
      },
      source: "mcp",
    };
    const agentComment = await tracker.addIssueComment(
      agentContext,
      createdIssue.id,
      { body: "Agent checkpoint <script>data()</script>" },
    );

    expect(
      await tracker.listIssueComments(workspaceId, createdIssue.id),
    ).toEqual([humanComment, agentComment]);
    expect(humanComment).toMatchObject({
      authorType: "human",
      authorId: ownerId,
      authorDisplayName: "Private Owner",
      source: "rest",
    });
    expect(agentComment).toMatchObject({
      authorType: "agent",
      authorId: "codex-commenter",
      authorDisplayName: "Codex commenter",
      source: "mcp",
    });
    await expect(
      connection.db
        .update(issueComment)
        .set({ body: "forged" })
        .where(eq(issueComment.id, humanComment.id)),
    ).rejects.toThrow();
    await expect(
      connection.db
        .delete(issueComment)
        .where(eq(issueComment.id, agentComment.id)),
    ).rejects.toThrow();
    expect(
      await tracker.listIssueComments(workspaceId, createdIssue.id),
    ).toEqual([humanComment, agentComment]);
  });

  it("rolls back a domain row when its activity insert fails", async () => {
    const createdProject = await tracker.createProject(ownerContext, {
      name: "Issopen",
      key: "ISS",
    });
    const createdIssue = await tracker.createIssue(ownerContext, {
      projectId: createdProject.id,
      title: "Before failed mutation",
    });
    await connection.client.unsafe(`
      CREATE FUNCTION reject_test_activity_insert() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'synthetic activity failure';
      END;
      $$;
      CREATE TRIGGER reject_test_activity_insert
      BEFORE INSERT ON activity_event
      FOR EACH ROW EXECUTE FUNCTION reject_test_activity_insert();
    `);

    try {
      await expect(
        tracker.updateIssue(ownerContext, createdIssue.id, {
          title: "Must roll back",
        }),
      ).rejects.toThrow();
    } finally {
      await connection.client.unsafe(`
        DROP TRIGGER IF EXISTS reject_test_activity_insert ON activity_event;
        DROP FUNCTION IF EXISTS reject_test_activity_insert();
      `);
    }

    const persisted = await tracker.getIssue(workspaceId, createdIssue.id);
    expect(persisted.title).toBe("Before failed mutation");
    expect(persisted.version).toBe(1);
  });
});
