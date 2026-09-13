import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  auditExtensionPackage,
  deterministicZip,
  sha256,
} from "./extension-package.js";

async function main() {
  if (
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
  )
    throw new Error("Commit changes before packaging a release");
  // There is no bypass flag: local/CI artifacts are produced only after gates.
  execFileSync("pnpm", ["validate"], {
    stdio: "inherit",
    env: { ...process.env, DEBUG: "" },
  });
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const root = resolve("extensions/chrome/.output/chrome-mv3");
  const { manifest, entries, audit } = await auditExtensionPackage(root);
  // Dependency-free deterministic ZIP, STORE method, fixed DOS epoch. Only
  // audited generated files; no symlinks, timestamps, environment or profiles.
  const zip = deterministicZip(entries);
  const target = resolve("extensions/chrome/.output/releases");
  await mkdir(target, { recursive: true });
  const name = `issopen-chrome-${manifest.version}-${revision.slice(0, 12)}.zip`;
  const digest = sha256(zip);
  await writeFile(join(target, name), zip, { flag: "wx" });
  await writeFile(join(target, `${name}.sha256`), `${digest}  ${name}\n`, {
    flag: "wx",
  });
  await writeFile(
    join(target, `${name}.json`),
    JSON.stringify(
      {
        version: manifest.version,
        revision,
        apiVersion: 1,
        sha256: digest,
        files: entries.length,
        gates: "pnpm validate",
        distribution: "chrome-web-store-unlisted-candidate",
        compatibleServer:
          "Issopen API v1; multi-image when /session.maxImages is present, one-image fallback otherwise",
        audit,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({ archive: join(target, name), sha256: digest, revision }),
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Packaging failed");
  process.exitCode = 1;
});
