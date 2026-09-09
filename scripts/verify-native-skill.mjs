// Opt-in behavioral acceptance. Requires Docker and an authenticated Codex CLI.
// No production endpoint or credential is consumed by this fixture.
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import {
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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
const flags = process.argv.slice(3);
const editorMode = flags.includes("--editor");
const planningMode = flags.includes("--planning");
const backgroundMode = flags.includes("--background");
if (!codex)
  throw new Error("Pass the absolute path of the native Codex binary");
if (
  flags.some(
    (flag) => !["--editor", "--planning", "--background"].includes(flag),
  )
)
  throw new Error("Supported flags: --editor [--planning] [--background]");
if (planningMode && !editorMode)
  throw new Error("Planning acceptance requires interactive --editor approval");
if (backgroundMode) {
  if (!editorMode) throw new Error("Background mode requires --editor");
  const logDirectory = mkdtempSync(join(tmpdir(), "issopen-native-launch-"));
  const logPath = join(logDirectory, "fixture.log");
  const log = openSync(logPath, "wx", 0o600);
  const processHandle = spawn(
    process.execPath,
    [
      ...process.execArgv,
      fileURLToPath(import.meta.url),
      resolve(codex),
      ...flags.filter((flag) => flag !== "--background"),
    ],
    { cwd: process.cwd(), detached: true, stdio: ["ignore", log, log] },
  );
  await once(processHandle, "spawn");
  processHandle.unref();
  console.log(JSON.stringify({ backgroundPid: processHandle.pid, logPath }));
  process.exit(0);
}
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
  let acceptanceSnapshot;
  server = serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      if (
        editorMode &&
        new URL(request.url).pathname === "/__acceptance/status" &&
        acceptanceSnapshot
      )
        return Response.json(await acceptanceSnapshot());
      return app.fetch(request);
    },
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
  const planningEpic = planningMode
    ? await tracker.createEpic(context, {
        projectId: project.id,
        title: "Saludo configurable",
        description:
          "Nota humana que se debe conservar: todos los mensajes deben respetar el saludo elegido por la persona. Epic vacío para planificar biblioteca y comando local; no ejecutar aún.",
      })
    : null;
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
  if (editorMode) {
    const control = mkdtempSync(join(tmpdir(), "issopen-ide-control-"));
    const globalConfig = join(homedir(), ".codex/config.toml");
    const globalHash = () =>
      createHash("sha256").update(readFileSync(globalConfig)).digest("hex");
    const initialGlobalHash = globalHash();
    const runtimeArgs = [
      "-c",
      'approval_policy="on-request"',
      "-c",
      'approvals_reviewer="user"',
      "-c",
      'sandbox_mode="workspace-write"',
      "-c",
      nativeConfig,
      "-c",
      'mcp_servers.issopen.default_tools_approval_mode="writes"',
      "-c",
      disabledGlobal,
      "-c",
      `projects.${JSON.stringify(root)}.trust_level="trusted"`,
    ];
    const stateFile = join(control, "runtime.json");
    writeFileSync(
      stateFile,
      JSON.stringify({
        binary: resolve(codex),
        args: runtimeArgs,
        token: agent.token,
      }),
      { mode: 0o600 },
    );
    if (planningMode)
      writeFileSync(
        join(control, "synthetic-owner.json"),
        JSON.stringify({
          baseUrl,
          email: owner.email,
          password: owner.password,
        }),
        { mode: 0o600 },
      );
    const launcher = join(control, "codex-fixture.mjs");
    writeFileSync(
      launcher,
      [
        "#!/usr/bin/env node",
        'import { readFileSync } from "node:fs";',
        'import { spawn } from "node:child_process";',
        `const s = JSON.parse(readFileSync(${JSON.stringify(stateFile)}, "utf8"));`,
        'const p = spawn(s.binary, [...s.args, ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, ISSOPEN_AGENT_TOKEN: s.token } });',
        'for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => p.kill(signal));',
        'p.on("error", () => { console.error("Native fixture client could not start"); process.exitCode = 1; });',
        'p.on("exit", (code) => { process.exitCode = code ?? 1; });',
        "",
      ].join("\n"),
      { mode: 0o700 },
    );
    const profile = join(control, "vscode-profile");
    mkdirSync(join(profile, "User"), { recursive: true });
    writeFileSync(
      join(profile, "User/settings.json"),
      JSON.stringify(
        {
          "chatgpt.cliExecutable": launcher,
          "chatgpt.openOnStartup": true,
          "extensions.autoUpdate": false,
          "extensions.autoCheckUpdates": false,
          "window.title": "Issopen 43 — isolated acceptance",
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    const extensions = join(control, "extensions");
    mkdirSync(extensions);
    const installedExtension = dirname(dirname(dirname(resolve(codex))));
    symlinkSync(
      installedExtension,
      join(extensions, "openai.chatgpt-test"),
      "dir",
    );
    const readPrompt = [
      `Usa $issopen para consultar el proyecto ${project.id} y el Epic ${planningEpic?.id ?? epic.id}.`,
      `Es una prueba aislada autorizada; MCP confiable ${baseUrl}/mcp.`,
      "Comprueba identidad, permisos, Epic y preguntas actuales. No cambies archivos, tickets, respuestas, claims, configuración ni permisos.",
      "No contactes al remoto Git. Si hay un fallo del comprobador de versiones, conserva la instalación y continúa.",
    ].join("\n");
    const planningPrompt = planningEpic
      ? [
          `Usa $issopen en modo planificación para el proyecto ${project.id}, Epic ${planningEpic.id} (Saludo configurable).`,
          `Prueba aislada autorizada; MCP confiable ${baseUrl}/mcp. Trabaja sólo con ese proyecto, sin contactar al remoto Git.`,
          "Quiero dos resultados utilizables: la función de saludo debe poder recibir un nombre opcional y conservar el saludo elegido por la persona; además quiero ejecutar ese saludo desde un comando local de Node.",
          "Revisa lo que ya hay en el proyecto y reutiliza el trabajo equivalente. Conserva las notas humanas y respuestas vigentes. Completa los planes técnicos, relaciones y pruebas dentro de Issopen; mantén el trabajo sin ejecutar en Backlog.",
          "Para la salida del comando aún no he decidido entre texto simple o JSON: deja una pregunta bloqueante con recomendación y opciones en el ticket correspondiente. No elijas ni respondas por mí.",
          "No implementes, no reclames tickets, no cambies respuestas ni archivos locales, no crees proyectos ni otros Epics. Sin commit, push, cierre, despliegue, cambios de permisos o instalación.",
          "Si falta fuente de actualizaciones, conserva la skill y continúa. Todas las escrituras requieren aprobación interactiva del owner.",
        ].join("\n")
      : null;
    write(
      "START-HERE.md",
      [
        "# Issopen 43 — sesión aislada",
        "",
        "La base de datos, identidad y repositorio son desechables. No hay credenciales de producción.",
        "Si VS Code muestra Restricted Mode, el owner debe autorizar sólo esta carpeta temporal desde Manage → Trust antes de activar Codex.",
        "Usa el panel Codex de esta ventana. Conserva las aprobaciones interactivas: no selecciones aprobar siempre.",
        "No es una publicación estable ni el piloto real del ticket 44.",
        "",
        "## 1. Consulta sin mutación",
        "",
        readPrompt,
        "",
        planningMode
          ? "## 2. Planificación con aprobación del owner"
          : "## 2. Ejecución con aprobación del owner",
        "",
        planningPrompt ?? prompt,
        ...(planningMode
          ? [
              "",
              "## 3. Repetición del mismo encargo",
              "",
              "En la misma conversación, repite la petición de planificación. Compara IDs, planes y preguntas con el snapshot anterior: no deben aparecer copias semánticas ni sobrescribirse decisiones.",
              "",
              "## 4. Cambio de respuesta y sesión nueva",
              "",
              "El operador usa exclusivamente el owner sintético del fichero privado de control para responder y cambiar después la respuesta desde la web local. Nunca credenciales de producción. Registrar ambas versiones y comprobar issue.version independientemente.",
              "Abrir una sesión nueva y pedir revisar las respuestas antes de pedir explícitamente retomar planificación. No se autoriza implementar ni cambiar la política de aprobación.",
            ]
          : []),
        "",
        "## Evidencia independiente",
        "",
        `GET ${baseUrl}/__acceptance/status muestra estado, preguntas, actividad y resultado del test.`,
        "El coordinador registra el resultado; no basta la afirmación del modelo.",
      ].join("\n"),
    );
    git("add", "START-HERE.md");
    git(
      "-c",
      "user.name=Synthetic acceptance",
      "-c",
      "user.email=acceptance@example.test",
      "commit",
      "-m",
      "Add isolated editor acceptance instructions",
    );
    const baselineCommit = git("rev-parse", "HEAD");
    const snapshot = async () => {
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
        /* Not completed yet. */
      }
      return {
        scenario: planningMode ? "planning" : "execution",
        skillCommit: pkg.commit,
        fixture: root,
        control,
        launcher,
        baseUrl,
        projectId: project.id,
        epicId: epic.id,
        issueId: issue.id,
        planning: planningEpic
          ? {
              epic: await tracker.getEpicDetail(workspaceId, planningEpic.id),
              issues: await Promise.all(
                (await tracker.listIssues(workspaceId, project.id)).map(
                  ({ id }) => tracker.getIssueDetail(workspaceId, id),
                ),
              ),
              prompt: planningPrompt,
            }
          : null,
        status: detail.issue.status,
        claimedByAgentId: detail.issue.claimedByAgentId,
        questions: detail.questionSummary,
        savedOther: detail.questions[0]?.answerOtherText,
        comments: detail.comments.map(({ body, authorType }) => ({
          body,
          authorType,
        })),
        events: events
          .filter((event) => event.actorType === "agent")
          .map(({ type }) => type),
        testPassed,
        changedFiles: git("diff", "--name-only").split("\n").filter(Boolean),
        stagedFiles: git("diff", "--cached", "--name-only")
          .split("\n")
          .filter(Boolean),
        untrackedFiles: git("ls-files", "--others", "--exclude-standard")
          .split("\n")
          .filter(Boolean),
        baselineCommit,
        currentCommit: git("rev-parse", "HEAD"),
        gitRemoteUnchanged:
          git("remote", "get-url", "origin") === repositoryUrl,
        globalConfigUnchanged: globalHash() === initialGlobalHash,
        productionTouched: false,
      };
    };
    acceptanceSnapshot = snapshot;
    const codeProcess = spawn(
      "code",
      [
        "--user-data-dir",
        profile,
        "--extensions-dir",
        extensions,
        "--new-window",
        root,
        join(root, "START-HERE.md"),
      ],
      {
        cwd: root,
        env: process.env,
        stdio: ["ignore", "ignore", "ignore"],
      },
    );
    codeProcess.on("error", () =>
      console.error("Unable to launch the isolated VS Code window"),
    );
    console.log(
      JSON.stringify({
        editorFixtureReady: true,
        pid: process.pid,
        ...(await snapshot()),
      }),
    );
    await new Promise((done) => {
      process.once("SIGINT", done);
      process.once("SIGTERM", done);
    });
    writeFileSync(
      join(control, "final-report.json"),
      JSON.stringify(await snapshot(), null, 2),
      { mode: 0o600 },
    );
  } else {
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
  }
} finally {
  clearTimeout(timer);
  if (child && child.exitCode === null) child.kill("SIGTERM");
  server?.close();
  await connection?.close();
  await container?.stop();
}
