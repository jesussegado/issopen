import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { pipeline } from "node:stream/promises";

async function main() {
  const [kubeconfig, parent, mode] = process.argv.slice(2);
  if (
    !kubeconfig ||
    !parent ||
    !isAbsolute(kubeconfig) ||
    !isAbsolute(parent) ||
    parent === "/" ||
    (mode && mode !== "--database-only")
  )
    throw new Error(
      "Use absolute kubeconfig and private backup directory; optional --database-only before first attachment deployment",
    );
  process.umask(0o077);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await chmod(parent, 0o700);
  const directory = await mkdtemp(join(parent, "issopen-"));
  const checksums: Record<string, string> = {};
  async function backup(name: string, args: string[]) {
    const child = spawn(
      "kubectl",
      ["--kubeconfig", kubeconfig as string, "-n", "issopen", "exec", ...args],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    child.stderr.resume();
    const closed = new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) =>
        code === 0 ? resolve() : reject(new Error("Backup command failed")),
      );
    });
    await Promise.all([
      pipeline(
        child.stdout,
        createWriteStream(join(directory, name), { flags: "wx", mode: 0o600 }),
      ),
      closed,
    ]);
    const bytes = await readFile(join(directory, name));
    if (!bytes.length) throw new Error("Empty backup");
    checksums[name] = createHash("sha256").update(bytes).digest("hex");
  }
  // Dump first, then immutable files: later captures may add extra files but
  // cannot cause a referenced file to be missing. GC never touches referenced files.
  await backup("database.dump", [
    "issopen-postgres-0",
    "--",
    "pg_dump",
    "-U",
    "issopen",
    "-d",
    "issopen",
    "-Fc",
  ]);
  if (mode !== "--database-only")
    await backup("attachments.tar", [
      "deployment/issopen",
      "--",
      "tar",
      "-C",
      "/data/attachments",
      "-cf",
      "-",
      ".",
    ]);
  await writeFile(
    join(directory, "manifest.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        namespace: "issopen",
        complete: true,
        databaseOnly: Boolean(mode),
        checksums,
      },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    JSON.stringify({
      directory,
      complete: true,
      files: Object.keys(checksums),
    }),
  );
}
main().catch(() => {
  console.error(
    "Issopen backup failed; incomplete directory retained for diagnosis, no credentials logged.",
  );
  process.exitCode = 1;
});
