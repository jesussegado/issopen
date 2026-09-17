import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  deterministicZip,
  readPackageEntries,
  sha256,
} from "./extension-package.js";

export async function packageSkill(
  source = resolve("skills/issopen"),
  target = resolve("dist/web/downloads"),
) {
  const versionDocument = JSON.parse(
    await readFile(join(source, "version.json"), "utf8"),
  ) as { version?: unknown };
  assert.match(String(versionDocument.version), /^\d+\.\d+\.\d+$/);
  const version = String(versionDocument.version);
  const sourceEntries = await readPackageEntries(source);
  assert(sourceEntries.some((entry) => entry.path === "SKILL.md"));
  assert(sourceEntries.some((entry) => entry.path === "agents/openai.yaml"));
  assert(
    sourceEntries.every(
      (entry) =>
        !entry.path.startsWith(".") &&
        !entry.path.split("/").some((part) => !part || part === ".."),
    ),
    "Unsafe skill package entry",
  );

  const archive = deterministicZip(
    sourceEntries.map((entry) => ({
      path: `issopen/${entry.path}`,
      bytes: entry.bytes,
    })),
  );
  const digest = sha256(archive);
  const archiveName = `issopen-skill-${version}.zip`;
  const manifest = {
    schemaVersion: 1,
    name: "issopen",
    version,
    archive: `/downloads/${archiveName}`,
    sha256: digest,
    files: sourceEntries.length,
    installDirectory: "~/.agents/skills/issopen",
    entrypoint: "SKILL.md",
  };

  await mkdir(target, { recursive: true });
  await Promise.all([
    writeFile(join(target, archiveName), archive),
    writeFile(join(target, "issopen-skill.zip"), archive),
    writeFile(
      join(target, "issopen-skill-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    ),
    writeFile(
      join(target, `${archiveName}.sha256`),
      `${digest}  ${archiveName}\n`,
    ),
  ]);
  return { manifest, archive };
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  packageSkill()
    .then(({ manifest }) => console.log(JSON.stringify(manifest)))
    .catch((error) => {
      console.error(
        error instanceof Error ? error.message : "Packaging failed",
      );
      process.exitCode = 1;
    });
}
