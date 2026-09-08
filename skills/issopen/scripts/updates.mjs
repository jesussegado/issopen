import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
export async function checkForUpdate(
  installedCommit,
  readPublished,
  timeoutMs = 8000,
  installedVersion,
) {
  let timer;
  try {
    if (!/^[a-f0-9]{40}$/.test(installedCommit))
      return { status: "unavailable", reason: "No pinned installation" };
    const published = await Promise.race([
      readPublished(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    if (!published || !/^[a-f0-9]{40}$/.test(published.commit))
      return { status: "unavailable", reason: "No published release" };
    const parts = (version) =>
      /^\d+\.\d+\.\d+$/.test(version ?? "")
        ? version.split(".").map(Number)
        : null;
    const installedParts = parts(installedVersion);
    const publishedParts = parts(published.version);
    let status = "different_release";
    if (published.commit === installedCommit) status = "current";
    else if (installedParts && publishedParts) {
      const order =
        publishedParts[0] - installedParts[0] ||
        publishedParts[1] - installedParts[1] ||
        publishedParts[2] - installedParts[2];
      status =
        order > 0
          ? "update_available"
          : order < 0
            ? "installed_ahead"
            : "revision_mismatch";
    }
    return {
      status,
      installedCommit,
      publishedCommit: published.commit,
      version: published.version,
      automaticUpdate: false,
    };
  } catch {
    return {
      status: "unavailable",
      reason: "Release check failed; keep the installed version and continue",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function publishedRelease(output) {
  const releases = new Map();
  for (const line of output.trim().split("\n")) {
    const match = line.match(
      /^([a-f0-9]{40})\s+refs\/tags\/issopen-skill-v(\d+)\.(\d+)\.(\d+)(\^\{\})?$/,
    );
    if (!match) continue;
    const version = match.slice(2, 5).join(".");
    const current = releases.get(version);
    if (!current || match[5])
      releases.set(version, {
        commit: match[1],
        version,
        parts: match.slice(2, 5).map(Number),
        peeled: Boolean(match[5]),
      });
  }
  const latest = [...releases.values()].sort(
    (a, b) =>
      b.parts[0] - a.parts[0] ||
      b.parts[1] - a.parts[1] ||
      b.parts[2] - a.parts[2],
  )[0];
  return latest ? { commit: latest.commit, version: latest.version } : null;
}

export async function readPublishedRelease(source) {
  const url = new URL(source);
  if (
    !["https:", "ssh:"].includes(url.protocol) ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol === "https:" && url.username)
  )
    throw new Error("Trusted HTTPS/SSH source URL required");
  const env = Object.fromEntries(
    ["PATH", "LANG", "SSH_AUTH_SOCK"].flatMap((name) =>
      process.env[name] ? [[name, process.env[name]]] : [],
    ),
  );
  const { stdout } = await exec(
    "git",
    [
      "-c",
      "protocol.ext.allow=never",
      "ls-remote",
      "--exit-code",
      "--",
      source,
      "refs/tags/issopen-skill-v*",
    ],
    {
      timeout: 5000,
      maxBuffer: 65536,
      env: {
        ...env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_SSH_COMMAND: "ssh -o BatchMode=yes",
      },
    },
  );
  return publishedRelease(stdout);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  let result = {
    status: "unavailable",
    reason:
      "Configure ISSOPEN_SKILL_SOURCE_REPO from a trusted source; continue with the installed version",
  };
  try {
    const marker = JSON.parse(
      readFileSync(
        resolve(
          dirname(fileURLToPath(import.meta.url)),
          "../.issopen-install.json",
        ),
        "utf8",
      ),
    );
    const { version } = JSON.parse(
      readFileSync(
        resolve(dirname(fileURLToPath(import.meta.url)), "../version.json"),
        "utf8",
      ),
    );
    if (process.env.ISSOPEN_SKILL_SOURCE_REPO)
      result = await checkForUpdate(
        marker.commit,
        () => readPublishedRelease(process.env.ISSOPEN_SKILL_SOURCE_REPO),
        8000,
        version,
      );
  } catch {
    /* Missing source or installation marker must never interrupt a task. */
  }
  console.log(JSON.stringify(result));
}
