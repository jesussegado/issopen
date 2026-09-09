import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const [binary = "codex", cwd = process.cwd()] = process.argv.slice(2);
const child = spawn(binary, ["app-server", "--stdio"], {
  cwd,
  stdio: ["pipe", "pipe", "pipe"],
});
const pending = new Map();
let sequence = 0;
const timer = setTimeout(() => {
  console.error("Codex discovery timed out");
  child.kill();
  process.exitCode = 1;
}, 30000);
child.stderr.resume(); // Native diagnostics can contain unrelated host configuration.
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
    clientInfo: { name: "issopen-skill-check", version: "1.0.0" },
  });
  if (initialized.error) throw new Error("Native initialize failed");
  child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
  const response = await request("skills/list", {
    cwds: [cwd],
    forceReload: true,
  });
  if (response.error) throw new Error("Native skills/list failed");
  const matches = response.result.data
    .flatMap((entry) => entry.skills)
    .filter((skill) => skill.name === "issopen" && skill.enabled !== false);
  if (matches.length !== 1 || matches[0].enabled === false)
    throw new Error(
      `Expected one enabled Issopen skill, found ${matches.length}`,
    );
  console.log(
    JSON.stringify({
      status: "discovered",
      name: matches[0].name,
      path: matches[0].path,
      interface: matches[0].interface,
      note: "Native discovery only; no model invocation or MCP action.",
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  child.kill();
}
