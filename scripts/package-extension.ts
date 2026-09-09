import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { crc32 } from "node:zlib";

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
  const manifest = JSON.parse(
    await readFile(join(root, "manifest.json"), "utf8"),
  );
  if (
    manifest.host_permissions?.[0] !== "https://issopen.serviciosegado.com/*" ||
    manifest.manifest_version !== 3
  )
    throw new Error("Refusing non-production artifact");
  // Dependency-free deterministic ZIP, STORE method, fixed DOS epoch. Only
  // generated regular files; no symlinks, timestamps, environment or profiles.
  const entries = (
    await readdir(root, { withFileTypes: true, recursive: true })
  )
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name).slice(root.length + 1))
    .sort();
  const local: Buffer[] = [],
    central: Buffer[] = [];
  let offset = 0;
  for (const path of entries) {
    const name = Buffer.from(path),
      bytes = await readFile(join(root, path));
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc32(bytes), 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt16LE(20, 4);
    header.copy(directory, 6, 4, 30);
    directory.writeUInt32LE(offset, 42);
    local.push(header, name, bytes);
    central.push(directory, name);
    offset += header.length + name.length + bytes.length;
  }
  const directory = Buffer.concat(central),
    footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50);
  footer.writeUInt16LE(entries.length, 8);
  footer.writeUInt16LE(entries.length, 10);
  footer.writeUInt32LE(directory.length, 12);
  footer.writeUInt32LE(offset, 16);
  const zip = Buffer.concat([...local, directory, footer]);
  const target = resolve("extensions/chrome/.output/releases");
  await mkdir(target, { recursive: true });
  const name = `issopen-chrome-${manifest.version}-${revision.slice(0, 12)}.zip`;
  const sha256 = createHash("sha256").update(zip).digest("hex");
  await writeFile(join(target, name), zip, { flag: "wx" });
  await writeFile(join(target, `${name}.sha256`), `${sha256}  ${name}\n`, {
    flag: "wx",
  });
  await writeFile(
    join(target, `${name}.json`),
    JSON.stringify(
      {
        version: manifest.version,
        revision,
        apiVersion: 1,
        sha256,
        files: entries.length,
        gates: "pnpm validate",
        distribution: "unpacked",
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({ archive: join(target, name), sha256, revision }),
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Packaging failed");
  process.exitCode = 1;
});
