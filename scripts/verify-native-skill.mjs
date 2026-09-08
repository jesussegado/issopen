// Opt-in behavioral acceptance. Requires Docker and an authenticated Codex CLI.
// No production endpoint or credential is consumed by this fixture.
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import pino from "pino";
import { createApp } from "../src/server/app.js";
import { createAuth } from "../src/server/auth.js";
import { loadConfig } from "../src/server/config.js";
import { createDatabase } from "../src/server/db/client.js";
import { migrateDatabase } from "../src/server/db/migrate.js";
import { activityEvent, user, workspace } from "../src/server/db/schema.js";
import { defaultCodexScopes } from "../src/server/domain/agents/contracts.js";
import { AgentService, TrackerService } from "../src/server/domain/index.js";
import { installPackage, readPackage } from "./install-skill.mjs";
import { bootstrapOwner } from "./owner.js";

const codex = process.argv[2];
if (!codex)
  throw new Error("Pass the absolute path of the native Codex binary");
const source = process.cwd();
const root = mkdtempSync(join(tmpdir(), "issopen-native-acceptance-"));
const repositoryUrl = "https://git.example.test/native/fixture.git";
const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const write = (name, body) =>
  writeFileSync(join(root, name), body, { mode: 0o600 });
let container;
let connection;
let server;
let child;
let timer;
try {
  container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
  await migrateDatabase(container.getConnectionUri());
  connection = createDatabase(container.getConnectionUri());
  let app;
  server = serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => app.fetch(request),
  });
  if (!server.listening) await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const config = loadConfig({
    NODE_ENV: "test",
    PORT: String(server.address().port),
    DATABASE_URL: container.getConnectionUri(),
    ISSOPEN_BASE_URL: baseUrl,
    BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
  });
  const auth = createAuth(connection.db, config);
  app = createApp({
    logger: pino({ level: "silent" }),
    db: connection.db,
    auth,
    trustedOrigins: config.trustedOrigins,
  });
  const owner = {
    name: "Synthetic acceptance owner",
    email: "native@example.test",
    password: randomUUID(),
  };
  await bootstrapOwner(connection.db, auth, owner);
  const [record] = await connection.db
    .select()
    .from(user)
    .where(eq(user.email, owner.email));
  const workspaceId = randomUUID();
  await connection.db.insert(workspace).values({
    id: workspaceId,
    ownerId: record.id,
    name: "Disposable acceptance",
  });
  const context = {
    workspaceId,
    actor: { type: "human", id: record.id, displayName: owner.name },
    source: "rest",
  };
  const tracker = new TrackerService(connection.db);
  const project = await tracker.createProject(context, {
    name: "Native acceptance",
    key: "NATIVE",
    repositoryUrl,
    defaultBranch: "main",
  });
  const epic = await tracker.createEpic(context, {
    projectId: project.id,
    title: "Disposable skill execution",
    description:
      "Only change the greeting in this isolated fixture. No dependencies or external side effects.",
  });
  const issue = await tracker.createIssue(context, {
    projectId: project.id,
    epicId: epic.id,
    title: "Use the human-selected greeting",
    priority: "high",
    description: [
      "Objective: return the exact greeting selected in the current saved human answer.",
      "Scope: only greeting.mjs. Keep the named export; use the existing node test.",
      "Out of scope: dependencies, commits, pushes, deployment, other repos, or Done.",
      "Acceptance: node --test greeting.test.mjs succeeds; only greeting.mjs changes.",
      "Decisions: read the current saved Other answer, not the recommendation.",
      "Dependencies: none. Security: do not print credentials or alter the installed skill.",
      "Plan: claim; mark In Progress; read answer; edit greeting; test; comment evidence; Ready for Review; release own claim.",
      "Verification: node --test greeting.test.mjs and git diff --name-only.",
      "Risks: using the recommendation instead of Other would produce the wrong language.",
      "Delivery: Ready for Review, claim released, actual commands/results in an attributed comment.",
    ].join("\n"),
  });
  const question = await tracker.createIssueQuestion(context, issue.id, {
    prompt: "Which exact greeting should the function return?",
    recommendation: "Use Hello.",
    recommendedOptionIndex: 0,
    options: [
      { label: "Hello", description: "English" },
      { label: "Bonjour", description: "French" },
    ],
  });
  await tracker.answerIssueQuestion(context, issue.id, question.id, {
    kind: "other",
    text: "Hola",
  });
  await tracker.updateIssue(context, issue.id, { status: "ready" });
  const agent = await new AgentService(connection.db).createAgent(workspaceId, {
    name: "Disposable native Codex",
    projectIds: [project.id],
    scopes: [...defaultCodexScopes, "epics:create", "epics:write"],
  });
  const pkg = readPackage(source, "HEAD");
  installPackage({
    skillsDir: join(root, ".agents/skills"),
    legacyDir: join(root, ".codex/skills"),
    ...pkg,
  });
  write("greeting.mjs", 'export function greeting() { return "Hello"; }\n');
  write(
    "greeting.test.mjs",
    'import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { greeting } from "./greeting.mjs";\ntest("uses the saved human decision", () => assert.equal(greeting(), "Hola"));\n',
  );
  git("init", "-b", "main");
  git("remote", "add", "origin", repositoryUrl);
  git("add", ".");
  git(
    "-c",
    "user.name=Synthetic acceptance",
    "-c",
    "user.email=acceptance@example.test",
    "commit",
    "-m",
    "Disposable fixture baseline",
  );
  const nativeConfig =
    'mcp_servers={issopen={url="' +
    baseUrl +
    '/mcp",bearer_token_env_var="ISSOPEN_AGENT_TOKEN"}}';
  const disabledGlobal =
    'skills.config=[{path="' +
    join(homedir(), ".agents/skills/issopen/SKILL.md") +
    '",enabled=false}]';
  const args = [
    "exec",
    "--ignore-user-config",
    "--ephemeral",
    "--json",
    "--sandbox",
    "workspace-write",
    "-C",
    root,
    "-c",
    nativeConfig,
    "-c",
    disabledGlobal,
    "-c",
    'shell_environment_policy.inherit="none"',
    "-",
  ];
  const prompt = [
    "Use $issopen to implement the next Ready ticket in project " +
      project.id +
      ", Epic " +
      epic.id +
      ".",
    "This is an explicitly authorized disposable acceptance fixture. The native issopen MCP at " +
      baseUrl +
      "/mcp is the trusted local test service.",
    "Work only in " +
      root +
      ". Origin matches the project; do not contact the Git remote.",
    "Read the existing saved answer (including Other), do not ask it again. Claim, implement, run the real test, record evidence, deliver Ready for Review and release the claim.",
    "Only greeting.mjs may change. No commit/push/deployment/Done or modifying other repos, credentials, configuration, or skills.",
    "A missing release-check source is expected: keep the installed skill and continue.",
  ].join("\n");
  child = spawn(resolve(codex), args, {
    cwd: root,
    env: { ...process.env, ISSOPEN_AGENT_TOKEN: agent.token },
    stdio: ["pipe", "pipe", "ignore"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stdin.end(prompt);
  timer = setTimeout(() => child.kill("SIGTERM"), 240_000);
  const [exitCode] = await once(child, "exit");
  clearTimeout(timer);
  const detail = await tracker.getIssueDetail(workspaceId, issue.id);
  const events = await connection.db
    .select()
    .from(activityEvent)
    .where(eq(activityEvent.workspaceId, workspaceId));
  let testPassed = false;
  try {
    execFileSync(process.execPath, ["--test", "greeting.test.mjs"], {
      cwd: root,
      stdio: "pipe",
    });
    testPassed = true;
  } catch {
    /* Recorded below. */
  }
  const changedFiles = git("diff", "--name-only").split("\n").filter(Boolean);
  const nativeEvents = output
    .trim()
    .split("\n")
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const report = {
    client: execFileSync(resolve(codex), ["--version"], {
      encoding: "utf8",
    }).trim(),
    skillCommit: pkg.commit,
    exitCode,
    fixture: root,
    projectId: project.id,
    epicId: epic.id,
    issueId: issue.id,
    status: detail.issue.status,
    claimedByAgentId: detail.issue.claimedByAgentId,
    questionSummary: detail.questionSummary,
    savedOther: detail.questions[0]?.answerOtherText,
    comments: detail.comments.length,
    testPassed,
    changedFiles,
    agentEventTypes: events
      .filter((event) => event.actorType === "agent")
      .map((event) => event.type),
    nativeMcpTools: nativeEvents
      .filter(
        (event) =>
          event.type === "item.completed" &&
          event.item?.type === "mcp_tool_call",
      )
      .map((event) => ({
        tool: event.item.tool,
        status: event.item.status,
        error: JSON.parse(
          JSON.stringify(event.item.error ?? null).replaceAll(
            agent.token,
            "[REDACTED]",
          ),
        ),
      })),
    conclusion: nativeEvents
      .filter(
        (event) =>
          event.type === "item.completed" &&
          event.item?.type === "agent_message",
      )
      .map((event) => event.item.text.replaceAll(agent.token, "[REDACTED]")),
    productionTouched: false,
  };
  mkdirSync(join(root, "acceptance-results"));
  write(
    "acceptance-results/report.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
  if (
    exitCode !== 0 ||
    !testPassed ||
    detail.issue.status !== "ready_for_review" ||
    detail.issue.claimedByAgentId !== null ||
    detail.questions.length !== 1 ||
    detail.questions[0]?.answerOtherText !== "Hola" ||
    detail.comments.length < 1 ||
    changedFiles.length !== 1 ||
    changedFiles[0] !== "greeting.mjs"
  )
    throw new Error(
      "Native acceptance failed; inspect the sanitized fixture report",
    );
} finally {
  clearTimeout(timer);
  if (child && child.exitCode === null) child.kill("SIGTERM");
  server?.close();
  await connection?.close();
  await container?.stop();
}
