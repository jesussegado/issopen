import { pathToFileURL } from "node:url";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { z } from "zod";

const projectKey = "ISS";
const issueTitle = "Make Phase 1 dogfooding reproducible and secret-safe";
const issueDescription = [
  "Add a deterministic operator command and acceptance test for Issopen's own tracker loop.",
  "The proof must use a separate scoped Codex identity, keep Git/CI/deploy outside Issopen, and retain attributed review activity.",
].join(" ");
const reviewReason = "Prove the command is idempotent before owner acceptance.";

const inputSchema = z.object({
  baseUrl: z
    .url()
    .transform((value) => new URL(value))
    .refine(
      (url) =>
        ["http:", "https:"].includes(url.protocol) &&
        url.username === "" &&
        url.password === "",
      "ISSOPEN_BASE_URL must be a credential-free HTTP(S) URL",
    ),
  ownerEmail: z.email(),
  ownerPassword: z.string().min(12).max(128),
  codeUrl: z
    .url()
    .transform((value) => new URL(value))
    .refine(
      (url) =>
        ["http:", "https:"].includes(url.protocol) &&
        url.username === "" &&
        url.password === "",
      "ISSOPEN_DOGFOOD_CODE_URL must be a credential-free HTTP(S) URL",
    ),
  codeType: z.enum(["branch", "commit", "pull_request"]).default("commit"),
});

export type DogfoodInput = {
  baseUrl: string;
  ownerEmail: string;
  ownerPassword: string;
  codeUrl: string;
  codeType?: "branch" | "commit" | "pull_request";
};

type Project = { id: string; key: string; name: string };
type Issue = {
  id: string;
  key: string;
  title: string;
  description: string;
  status: string;
};
type Agent = { id: string; name: string };
type Activity = {
  type: string;
  actorType: "human" | "agent" | "system";
  actorId: string;
  actorDisplayName: string;
  source: "rest" | "mcp" | "system" | "operator";
  summary: string;
};

export type DogfoodResult = {
  alreadyComplete: boolean;
  projectId: string;
  issueId: string;
  issueKey: string;
  status: string;
  agentId: string | null;
  activity: Activity[];
};

export class DogfoodError extends Error {
  override readonly name = "DogfoodError";
}

function endpoint(baseUrl: URL, pathname: string) {
  return new URL(pathname, baseUrl).toString();
}

function sessionCookie(response: Response) {
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new DogfoodError("Owner sign-in returned no session.");
  return cookie;
}

async function jsonResponse<T>(response: Response, operation: string) {
  if (!response.ok) {
    throw new DogfoodError(`${operation} failed with HTTP ${response.status}.`);
  }
  return (await response.json()) as T;
}

async function ownerFetch(
  baseUrl: URL,
  cookie: string,
  pathname: string,
  init: RequestInit = {},
) {
  return fetch(endpoint(baseUrl, pathname), {
    ...init,
    headers: {
      Accept: "application/json",
      Cookie: cookie,
      Origin: baseUrl.origin,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

async function callTool(
  client: Client,
  name: string,
  arguments_: Record<string, unknown>,
) {
  const response = await client.callTool({ name, arguments: arguments_ });
  if (response.isError) throw new DogfoodError(`${name} was not accepted.`);
  return response;
}

async function completeResult(
  baseUrl: URL,
  cookie: string,
  project: Project,
  issue: Issue,
  alreadyComplete: boolean,
  agentId: string | null,
): Promise<DogfoodResult> {
  const activityResponse = await ownerFetch(
    baseUrl,
    cookie,
    `/api/v1/issues/${issue.id}/activity`,
  );
  const { activity } = await jsonResponse<{ activity: Activity[] }>(
    activityResponse,
    "Read dogfood activity",
  );
  return {
    alreadyComplete,
    projectId: project.id,
    issueId: issue.id,
    issueKey: issue.key,
    status: issue.status,
    agentId,
    activity,
  };
}

export async function runDogfood(
  rawInput: DogfoodInput,
): Promise<DogfoodResult> {
  const parsed = inputSchema.parse(rawInput);
  const baseUrl = parsed.baseUrl;
  baseUrl.pathname = "/";
  baseUrl.search = "";
  baseUrl.hash = "";

  const signIn = await fetch(endpoint(baseUrl, "/api/auth/sign-in/email"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl.origin,
    },
    body: JSON.stringify({
      email: parsed.ownerEmail,
      password: parsed.ownerPassword,
    }),
  });
  if (!signIn.ok) throw new DogfoodError("Owner sign-in failed.");
  const cookie = sessionCookie(signIn);

  const sessionResponse = await ownerFetch(baseUrl, cookie, "/api/v1/session");
  let session = await jsonResponse<{
    workspace: { id: string; name: string } | null;
  }>(sessionResponse, "Read owner session");
  if (!session.workspace) {
    await jsonResponse(
      await ownerFetch(baseUrl, cookie, "/api/v1/workspace", {
        method: "POST",
        body: JSON.stringify({ name: "Issopen dogfood" }),
      }),
      "Create dogfood workspace",
    );
    session = {
      workspace: { id: "created", name: "Issopen dogfood" },
    };
  }

  const projectsResponse = await ownerFetch(
    baseUrl,
    cookie,
    "/api/v1/projects",
  );
  const projects = await jsonResponse<{ projects: Project[] }>(
    projectsResponse,
    "List projects",
  );
  let project = projects.projects.find((item) => item.key === projectKey);
  if (!project) {
    const created = await jsonResponse<{ project: Project }>(
      await ownerFetch(baseUrl, cookie, "/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          name: "Issopen",
          key: projectKey,
          description:
            "Issopen's own private backlog for governed product dogfooding.",
        }),
      }),
      "Create Issopen dogfood project",
    );
    project = created.project;
  }

  const issuesResponse = await ownerFetch(
    baseUrl,
    cookie,
    `/api/v1/projects/${project.id}/issues`,
  );
  const issues = await jsonResponse<{ issues: Issue[] }>(
    issuesResponse,
    "List dogfood issues",
  );
  let issue = issues.issues.find((item) => item.title === issueTitle);
  if (issue?.status === "done") {
    return completeResult(baseUrl, cookie, project, issue, true, null);
  }
  if (!issue) {
    const created = await jsonResponse<{ issue: Issue }>(
      await ownerFetch(
        baseUrl,
        cookie,
        `/api/v1/projects/${project.id}/issues`,
        {
          method: "POST",
          body: JSON.stringify({
            title: issueTitle,
            description: issueDescription,
            priority: "high",
          }),
        },
      ),
      "Create dogfood issue",
    );
    issue = created.issue;
  }
  if (!issue) throw new DogfoodError("Dogfood issue was not resolved.");

  const ready = await jsonResponse<{ issue: Issue }>(
    await ownerFetch(baseUrl, cookie, `/api/v1/issues/${issue.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "ready", priority: "high" }),
    }),
    "Prioritize dogfood issue",
  );
  issue = ready.issue;

  const agentsResponse = await ownerFetch(baseUrl, cookie, "/api/v1/agents");
  const existingAgents = await jsonResponse<{ agents: Agent[] }>(
    agentsResponse,
    "List dogfood agents",
  );
  const issueKey = issue.key;
  const runNumber =
    existingAgents.agents.filter((agent) =>
      agent.name.startsWith(`Codex dogfood ${issueKey} run `),
    ).length + 1;
  const createdAgent = await jsonResponse<{
    agent: Agent;
    token: string;
  }>(
    await ownerFetch(baseUrl, cookie, "/api/v1/agents", {
      method: "POST",
      body: JSON.stringify({
        name: `Codex dogfood ${issueKey} run ${runNumber}`,
        description: "Ephemeral Phase 1 acceptance identity",
        projectIds: [project.id],
        expiresInDays: 7,
      }),
    }),
    "Create scoped dogfood agent",
  );

  const client = new Client(
    { name: "issopen-dogfood", version: "0.1.0" },
    { versionNegotiation: { mode: "auto" } },
  );
  const transport = new StreamableHTTPClientTransport(
    new URL("/mcp", baseUrl),
    { authProvider: { token: async () => createdAgent.token } },
  );
  let connected = false;
  try {
    await client.connect(transport);
    connected = true;
    await callTool(client, "claim_issue", {
      idempotencyKey: `${issueKey}:claim:first`,
      issueId: issue.id,
    });
    await callTool(client, "update_issue", {
      idempotencyKey: `${issueKey}:update:first`,
      issueId: issue.id,
      description: `${issueDescription} Implementation result is linked for owner review.`,
    });
    const detail = await jsonResponse<{ codeLinks: { url: string }[] }>(
      await ownerFetch(baseUrl, cookie, `/api/v1/issues/${issue.id}`),
      "Read dogfood issue",
    );
    if (
      !detail.codeLinks.some((link) => link.url === parsed.codeUrl.toString())
    ) {
      await callTool(client, "link_code_result", {
        idempotencyKey: `${issueKey}:link:result`,
        issueId: issue.id,
        type: parsed.codeType,
        url: parsed.codeUrl.toString(),
      });
    }
    await callTool(client, "move_issue", {
      idempotencyKey: `${issueKey}:move:first-review`,
      issueId: issue.id,
      status: "ready_for_review",
    });
    const forbiddenClose = await client.callTool({
      name: "move_issue",
      arguments: {
        idempotencyKey: `${issueKey}:move:forbidden-close`,
        issueId: issue.id,
        status: "done",
      },
    });
    if (!forbiddenClose.isError) {
      throw new DogfoodError(
        "Default Codex identity unexpectedly closed work.",
      );
    }
    await callTool(client, "release_issue", {
      idempotencyKey: `${issueKey}:release:first`,
      issueId: issue.id,
    });

    issue = (
      await jsonResponse<{ issue: Issue }>(
        await ownerFetch(
          baseUrl,
          cookie,
          `/api/v1/issues/${issue.id}/review/request-changes`,
          {
            method: "POST",
            body: JSON.stringify({ reason: reviewReason }),
          },
        ),
        "Request dogfood changes",
      )
    ).issue;

    await callTool(client, "claim_issue", {
      idempotencyKey: `${issueKey}:claim:second`,
      issueId: issue.id,
    });
    await callTool(client, "update_issue", {
      idempotencyKey: `${issueKey}:update:second`,
      issueId: issue.id,
      description: `${issueDescription} Idempotence was verified and the result is ready for final review.`,
    });
    await callTool(client, "move_issue", {
      idempotencyKey: `${issueKey}:move:second-review`,
      issueId: issue.id,
      status: "ready_for_review",
    });
    await callTool(client, "release_issue", {
      idempotencyKey: `${issueKey}:release:second`,
      issueId: issue.id,
    });

    issue = (
      await jsonResponse<{ issue: Issue }>(
        await ownerFetch(
          baseUrl,
          cookie,
          `/api/v1/issues/${issue.id}/review/accept`,
          { method: "POST", body: JSON.stringify({}) },
        ),
        "Accept dogfood result",
      )
    ).issue;
  } finally {
    if (connected) {
      await client
        .callTool({
          name: "release_issue",
          arguments: {
            idempotencyKey: `${issueKey}:release:cleanup`,
            issueId: issue.id,
          },
        })
        .catch(() => undefined);
      await client.close().catch(() => undefined);
    }
    await ownerFetch(
      baseUrl,
      cookie,
      `/api/v1/agents/${createdAgent.agent.id}/revoke`,
      { method: "POST", body: JSON.stringify({}) },
    ).catch(() => undefined);
  }

  return completeResult(
    baseUrl,
    cookie,
    project,
    issue,
    false,
    createdAgent.agent.id,
  );
}

function commandInput(): DogfoodInput {
  const baseUrl = process.env.ISSOPEN_BASE_URL;
  const ownerEmail = process.env.ISSOPEN_OWNER_EMAIL;
  const ownerPassword = process.env.ISSOPEN_OWNER_PASSWORD;
  const codeUrl = process.env.ISSOPEN_DOGFOOD_CODE_URL;
  if (!baseUrl || !ownerEmail || !ownerPassword || !codeUrl) {
    throw new DogfoodError(
      "Set ISSOPEN_BASE_URL, ISSOPEN_OWNER_EMAIL, ISSOPEN_OWNER_PASSWORD and ISSOPEN_DOGFOOD_CODE_URL for this command only.",
    );
  }
  const codeType = process.env.ISSOPEN_DOGFOOD_CODE_TYPE;
  const input: DogfoodInput = {
    baseUrl,
    ownerEmail,
    ownerPassword,
    codeUrl,
  };
  if (codeType) {
    input.codeType = z
      .enum(["branch", "commit", "pull_request"])
      .parse(codeType);
  }
  return input;
}

async function main() {
  const result = await runDogfood(commandInput());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main().catch((error) => {
    const message =
      error instanceof DogfoodError || error instanceof z.ZodError
        ? error.message
        : "Dogfood command failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
