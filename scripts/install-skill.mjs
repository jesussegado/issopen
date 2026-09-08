import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const marker = ".issopen-install.json";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function snapshot(root, prefix = "") {
  const result = {};
  for (const entry of readdirSync(join(root, prefix), {
    withFileTypes: true,
  })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (path === marker) continue;
    if (entry.isSymbolicLink())
      throw new Error(
        "Local symlinks are not managed; preserve and move them manually",
      );
    if (entry.isDirectory()) Object.assign(result, snapshot(root, path));
    else if (entry.isFile())
      result[path] = hash(readFileSync(join(root, path)));
    else throw new Error("Unsupported local file type");
  }
  return result;
}
const same = (a, b) =>
  JSON.stringify(Object.entries(a).sort()) ===
  JSON.stringify(Object.entries(b).sort());

export function readPackage(repo, revision) {
  const git = (...args) =>
    execFileSync("git", ["-C", repo, ...args], { maxBuffer: 8 * 1024 * 1024 });
  const commit = git(
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${revision}^{commit}`,
  )
    .toString()
    .trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Expected a Git commit");
  const files = {};
  for (const row of git("ls-tree", "-rz", commit, "--", "skills/issopen/")
    .toString()
    .split("\0")
    .filter(Boolean)) {
    const [metadata, fullPath] = row.split("\t");
    const path = fullPath.slice("skills/issopen/".length);
    if (
      !metadata.startsWith("100644 blob ") ||
      !path ||
      path.split("/").some((part) => part === "..") ||
      path === marker
    )
      throw new Error("Unsupported package entry");
    files[path] = git("show", `${commit}:${fullPath}`);
  }
  if (!files["SKILL.md"] || !files["agents/openai.yaml"])
    throw new Error("Incomplete skill package");
  return { commit, files };
}

export function installPackage({
  skillsDir,
  legacyDir,
  commit,
  files,
  remove = false,
}) {
  const root = resolve(skillsDir);
  const target = join(root, "issopen");
  if (legacyDir) {
    const legacy = join(resolve(legacyDir), "issopen");
    if (
      existsSync(legacy) &&
      (!existsSync(target) || realpathSync(legacy) !== realpathSync(target))
    )
      throw new Error(
        "Duplicate legacy skill: resolve it manually before installing",
      );
  }
  let previous;
  if (existsSync(target)) {
    if (lstatSync(target).isSymbolicLink())
      throw new Error("Refusing to replace a symlink");
    if (!existsSync(join(target, marker)))
      throw new Error("Unmanaged installation: preserve it manually first");
    previous = JSON.parse(readFileSync(join(target, marker), "utf8"));
    if (
      previous.schemaVersion !== 1 ||
      !same(snapshot(target), previous.hashes)
    )
      throw new Error("Local modifications detected; nothing changed");
  }
  if (remove && !previous) return { status: "absent" };
  const hashes = Object.fromEntries(
    Object.entries(files ?? {}).map(([path, bytes]) => [path, hash(bytes)]),
  );
  if (!remove && previous?.commit === commit && same(previous.hashes, hashes))
    return { status: "unchanged", commit };
  mkdirSync(root, { recursive: true });
  // Backups deliberately live outside the discovery root, so Codex sees one skill.
  const backupRoot = join(dirname(root), "issopen-skill-backups");
  let backup;
  const staging = join(dirname(root), `.issopen-stage-${randomUUID()}`);
  if (!remove) {
    for (const [path, bytes] of Object.entries(files)) {
      if (
        path.startsWith("/") ||
        path.split("/").some((part) => !part || part === "..") ||
        path === marker
      )
        throw new Error("Unsafe package path");
      mkdirSync(dirname(join(staging, path)), { recursive: true });
      writeFileSync(join(staging, path), bytes, { mode: 0o644 });
    }
    writeFileSync(
      join(staging, marker),
      `${JSON.stringify({ schemaVersion: 1, commit, hashes }, null, 2)}\n`,
      { mode: 0o644 },
    );
  }
  if (previous) {
    mkdirSync(backupRoot, { recursive: true });
    backup = join(backupRoot, `${previous.commit}-${randomUUID()}`);
    renameSync(target, backup);
  }
  try {
    if (!remove) renameSync(staging, target);
  } catch (error) {
    if (backup) renameSync(backup, target);
    throw error;
  }
  return { status: remove ? "removed" : "installed", commit, backup };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const [revision, skillsDir = join(homedir(), ".agents/skills")] =
      process.argv.slice(2);
    if (!revision)
      throw new Error(
        "Usage: node scripts/install-skill.mjs <commit|--uninstall> [skills-directory]",
      );
    const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const source =
      revision === "--uninstall"
        ? { remove: true }
        : readPackage(repo, revision);
    const legacyDir =
      resolve(skillsDir) === join(homedir(), ".agents/skills")
        ? join(homedir(), ".codex/skills")
        : undefined;
    console.log(
      JSON.stringify(installPackage({ skillsDir, legacyDir, ...source })),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
