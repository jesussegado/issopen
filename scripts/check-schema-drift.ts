import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

type Snapshot = Map<string, string>;

function filesBelow(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? filesBelow(root, path)
      : [relative(root, path)];
  });
}

function snapshot(root: string): Snapshot {
  return new Map(
    filesBelow(root)
      .sort()
      .map((path) => [
        path,
        createHash("sha256")
          .update(readFileSync(join(root, path)))
          .digest("hex"),
      ]),
  );
}

function differences(before: Snapshot, after: Snapshot) {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].sort().flatMap((path) => {
    if (!before.has(path)) return [`added: ${path}`];
    if (!after.has(path)) return [`removed: ${path}`];
    if (before.get(path) !== after.get(path)) return [`modified: ${path}`];
    return [];
  });
}

const repository = resolve(import.meta.dirname, "..");
const migrations = join(repository, "drizzle");
const schema = join(repository, "src/server/db/schema.ts");

if (!statSync(migrations).isDirectory()) {
  throw new Error(`Migration directory is unavailable: ${migrations}`);
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "issopen-schema-check-"));
const temporaryMigrations = join(temporaryRoot, "drizzle");
const temporaryConfig = join(temporaryRoot, "drizzle.config.ts");

try {
  cpSync(migrations, temporaryMigrations, { recursive: true });
  writeFileSync(
    temporaryConfig,
    `export default ${JSON.stringify({
      dialect: "postgresql",
      schema,
      out: relative(repository, temporaryMigrations),
      strict: true,
      verbose: false,
    })};\n`,
  );
  const before = snapshot(temporaryMigrations);
  const generated = spawnSync(
    "pnpm",
    ["exec", "drizzle-kit", "generate", "--config", temporaryConfig],
    {
      cwd: repository,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (generated.stdout.trim()) process.stdout.write(generated.stdout);
  if (generated.stderr.trim()) process.stderr.write(generated.stderr);
  if (generated.error) throw generated.error;
  if (
    generated.status !== 0 ||
    generated.stdout.includes("Error:") ||
    generated.stderr.includes("Error:")
  ) {
    throw new Error(`drizzle-kit generate exited with ${generated.status}`);
  }

  const drift = differences(before, snapshot(temporaryMigrations));
  if (drift.length > 0) {
    console.error(
      "Schema drift detected against the committed Drizzle history:",
    );
    for (const item of drift) console.error(`- ${item}`);
    process.exitCode = 1;
  } else {
    console.log(
      "Schema check passed: no migration artifacts would be generated.",
    );
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
