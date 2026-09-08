import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const [binary = "codex"] = process.argv.slice(2);
const endpoint = new URL(process.env.ISSOPEN_MCP_URL);
if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password)
  throw new Error("A trusted HTTPS endpoint is required");
if (!process.env.ISSOPEN_AGENT_TOKEN)
  throw new Error("ISSOPEN_AGENT_TOKEN is missing");
const child = spawn(
  binary,
  [
    "-c",
    `mcp_servers={issopen_verification={url=${JSON.stringify(endpoint.href)},bearer_token_env_var="ISSOPEN_AGENT_TOKEN",startup_timeout_sec=10}}`,
    "app-server",
    "--stdio",
  ],
  { stdio: ["pipe", "pipe", "pipe"] },
);
const pending = new Map();
let sequence = 0;
const timer = setTimeout(() => {
  console.error("Native MCP check timed out");
  child.kill();
  process.exitCode = 1;
}, 45000);
child.stderr.resume();
createInterface({ input: child.stdout }).on("line", (line) => {
  try {
    const message = JSON.parse(line);
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  } catch {
    /* Ignore non-protocol output. */
  }
});
const request = (method, params) =>
  new Promise((resolve) => {
    const id = ++sequence;
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
  });
child.on("error", () => {
  console.error("Could not start Codex");
  clearTimeout(timer);
  process.exitCode = 1;
});
try {
  const initialized = await request("initialize", {
    clientInfo: { name: "issopen-native-mcp-check", version: "1.0.0" },
    capabilities: { experimentalApi: true },
  });
  if (initialized.error) throw new Error("Native initialize failed");
  child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
  const started = await request("thread/start", {
    cwd: process.cwd(),
    ephemeral: true,
    approvalPolicy: "never",
  });
  if (started.error) throw new Error("Native thread initialization failed");
  const statuses = await request("mcpServerStatus/list", {
    threadId: started.result.thread.id,
    limit: 100,
  });
  const own = statuses.result?.data?.find(
    (server) => server.name === "issopen_verification",
  );
  console.log(
    JSON.stringify({
      nativeStatus: own
        ? {
            name: own.name,
            tools: Object.keys(own.tools ?? {}),
            keys: Object.keys(own),
          }
        : "not found",
      statusError: statuses.error?.code,
    }),
  );
  const response = await request("mcpServer/tool/call", {
    threadId: started.result.thread.id,
    server: "issopen_verification",
    tool: "list_projects",
    arguments: { limit: 1 },
  });
  if (response.error || response.result?.isError) {
    const diagnostic = JSON.stringify(response.error ?? response.result);
    console.log(
      JSON.stringify({
        protocolRejected: /protocol|version|legacy|initialize/i.test(
          diagnostic,
        ),
        unknownServer: /unknown.*server|server.*not found/i.test(diagnostic),
        missingTool: /unknown.*tool|tool.*not found/i.test(diagnostic),
        authentication: /401|unauthorized|auth/i.test(diagnostic),
      }),
    );
    // Do not print arbitrary native error payloads, which may include credentials.
    throw new Error(
      `Native MCP read failed (RPC code ${response.error?.code ?? "tool error"})`,
    );
  }
  console.log(
    JSON.stringify({
      status: "native-read-ok",
      tool: "list_projects",
      responseKeys: Object.keys(response.result),
      note: "Real native MCP call; no model turn, writes or stored configuration.",
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  child.kill();
}
