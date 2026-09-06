import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectName = `issopen-test-${process.pid}`;
const ownerEmail = "compose-owner@example.test";
const ownerPassword = randomBytes(24).toString("base64url");
const postgresPassword = randomBytes(24).toString("hex");
const authSecret = randomBytes(32).toString("hex");
const commandOutput: string[] = [];

let port: number;
let composeEnvironment: NodeJS.ProcessEnv;
let composeStarted = false;

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate a test port"));
        return;
      }
      const selectedPort = address.port;
      server.close(() => resolve(selectedPort));
    });
  });
}

async function compose(...args: string[]) {
  const result = await execFileAsync(
    "docker",
    ["compose", "-p", projectName, ...args],
    {
      cwd: process.cwd(),
      env: composeEnvironment,
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  commandOutput.push(result.stdout, result.stderr);
  return result;
}

async function waitUntilReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/ready`);
      if (response.ok) {
        return;
      }
    } catch {
      // The container may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Issopen did not become ready before the test deadline");
}

async function signIn() {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/auth/sign-in/email`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: `http://localhost:${port}`,
      },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    },
  );
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
  return { response, cookie };
}

beforeAll(async () => {
  port = await availablePort();
  composeEnvironment = {
    ...process.env,
    ISSOPEN_PORT: String(port),
    ISSOPEN_BASE_URL: `http://localhost:${port}`,
    POSTGRES_PASSWORD: postgresPassword,
    BETTER_AUTH_SECRET: authSecret,
    ISSOPEN_OWNER_EMAIL: ownerEmail,
    ISSOPEN_OWNER_PASSWORD: ownerPassword,
  };
}, 10_000);

afterAll(async () => {
  if (composeStarted) {
    await compose("down", "--volumes", "--remove-orphans").catch(
      () => undefined,
    );
  }
});

describe("repeatable Compose runtime", () => {
  it("starts cleanly, bootstraps one owner and preserves workspace data on restart", async () => {
    await compose("config", "--quiet");
    composeStarted = true;
    await compose("up", "--build", "--detach", "--wait");
    await waitUntilReady();

    const services = await compose("ps", "--services", "--status", "running");
    expect(services.stdout).toContain("app");
    expect(services.stdout).toContain("postgres");

    const bootstrap = await compose(
      "exec",
      "-T",
      "-e",
      "ISSOPEN_OWNER_EMAIL",
      "-e",
      "ISSOPEN_OWNER_PASSWORD",
      "app",
      "node",
      "dist/runtime/scripts/owner.js",
      "bootstrap",
    );
    expect(bootstrap.stdout).toContain("Owner bootstrapped.");

    const signedIn = await signIn();
    expect(signedIn.response.status).toBe(200);
    expect(signedIn.cookie).toContain("issopen.session_token=");

    const workspace = await fetch(`http://127.0.0.1:${port}/api/v1/workspace`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: signedIn.cookie,
        Origin: `http://localhost:${port}`,
      },
      body: JSON.stringify({ name: "Persistent workspace" }),
    });
    expect(workspace.status).toBe(201);

    await compose("restart", "app");
    await waitUntilReady();

    const signedInAfterRestart = await signIn();
    expect(signedInAfterRestart.response.status).toBe(200);
    const session = await fetch(`http://127.0.0.1:${port}/api/v1/session`, {
      headers: { Cookie: signedInAfterRestart.cookie },
    });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      workspace: { name: "Persistent workspace" },
    });

    const repeatedBootstrap = await compose(
      "exec",
      "-T",
      "-e",
      "ISSOPEN_OWNER_EMAIL",
      "-e",
      "ISSOPEN_OWNER_PASSWORD",
      "app",
      "node",
      "dist/runtime/scripts/owner.js",
      "bootstrap",
    );
    expect(repeatedBootstrap.stdout).toContain("no changes made");

    const allOutput = commandOutput.join("\n");
    expect(allOutput).not.toContain(ownerPassword);
    expect(allOutput).not.toContain(postgresPassword);
    expect(allOutput).not.toContain(authSecret);
  }, 300_000);
});
