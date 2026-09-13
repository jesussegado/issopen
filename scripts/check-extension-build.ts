import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditExtensionPackage,
  deterministicZip,
  sha256,
} from "./extension-package.js";

const repo = fileURLToPath(new URL("..", import.meta.url));
const output = fileURLToPath(
  new URL("../extensions/chrome/.output/chrome-mv3/", import.meta.url),
);

async function buildSnapshot() {
  execFileSync("pnpm", ["extension:build"], {
    cwd: repo,
    env: { ...process.env, DEBUG: "" },
    stdio: "pipe",
    timeout: 120_000,
  });
  const { entries, audit } = await auditExtensionPackage(resolve(output));
  const hashes: Record<string, string> = {};
  for (const entry of entries)
    hashes[entry.path] = createHash("sha256").update(entry.bytes).digest("hex");
  return {
    hashes,
    zipSha256: sha256(deterministicZip(entries)),
    audit,
  };
}

const first = await buildSnapshot();
const second = await buildSnapshot();
assert.deepEqual(
  second.hashes,
  first.hashes,
  "Extension production builds are not byte-identical",
);
assert.equal(
  second.zipSha256,
  first.zipSha256,
  "Extension ZIPs from the same source are not byte-identical",
);
assert(Object.keys(second.hashes).length > 3, "Missing extension artifacts");
const digest = createHash("sha256")
  .update(JSON.stringify(second.hashes))
  .digest("hex");
process.stdout.write(
  `${JSON.stringify({ reproducible: true, files: Object.keys(second.hashes).length, treeSha256: digest, zipSha256: second.zipSha256, audit: second.audit }, null, 2)}\n`,
);
