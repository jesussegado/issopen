import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const output = fileURLToPath(
  new URL("../extensions/chrome/.output/chrome-mv3/", import.meta.url),
);

async function buildSnapshot(): Promise<Record<string, string>> {
  execFileSync("pnpm", ["extension:build"], {
    cwd: repo,
    env: { ...process.env, DEBUG: "" },
    stdio: "pipe",
    timeout: 120_000,
  });
  const entries = await readdir(output, {
    recursive: true,
    withFileTypes: true,
  });
  const paths = entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      return relative(output, join(entry.parentPath, entry.name));
    })
    .sort();
  const hashes: Record<string, string> = {};
  for (const path of paths)
    hashes[path] = createHash("sha256")
      .update(await readFile(join(output, path)))
      .digest("hex");
  return hashes;
}

const first = await buildSnapshot();
const second = await buildSnapshot();
assert.deepEqual(
  second,
  first,
  "Extension production builds are not byte-identical",
);
assert(Object.keys(second).length > 3, "Missing extension artifacts");
const digest = createHash("sha256")
  .update(JSON.stringify(second))
  .digest("hex");
process.stdout.write(
  `${JSON.stringify({ reproducible: true, files: Object.keys(second).length, treeSha256: digest }, null, 2)}\n`,
);
