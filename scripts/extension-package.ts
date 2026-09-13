import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { crc32 } from "node:zlib";
import { imageDimensions } from "../src/shared/image-validation.js";

export type PackageEntry = { path: string; bytes: Buffer };

export async function readPackageEntries(root: string) {
  const found = await readdir(root, { withFileTypes: true, recursive: true });
  assert(
    found.every((entry) => !entry.isSymbolicLink()),
    "Extension package must not contain symlinks",
  );
  const paths = found
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1))
    .sort();
  return Promise.all(
    paths.map(async (path) => ({
      path,
      bytes: await readFile(join(root, path)),
    })),
  );
}

export function deterministicZip(entries: PackageEntry[]) {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { path, bytes } of entries) {
    const name = Buffer.from(path);
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
  const directory = Buffer.concat(central);
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50);
  footer.writeUInt16LE(entries.length, 8);
  footer.writeUInt16LE(entries.length, 10);
  footer.writeUInt32LE(directory.length, 12);
  footer.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, footer]);
}

const expectedIcons = {
  16: "icons/icon-16.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

export async function auditExtensionPackage(root: string) {
  const entries = await readPackageEntries(root);
  const manifest = JSON.parse(
    (
      entries.find((entry) => entry.path === "manifest.json")?.bytes ?? ""
    ).toString(),
  );
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.minimum_chrome_version, "116");
  assert.equal(manifest.incognito, "not_allowed");
  assert.deepEqual(manifest.permissions, ["sidePanel", "identity", "storage"]);
  assert.deepEqual(manifest.optional_permissions, ["clipboardRead"]);
  assert.deepEqual(manifest.host_permissions, [
    "https://issopen.serviciosegado.com/*",
  ]);
  assert.deepEqual(manifest.icons, expectedIcons);
  assert.deepEqual(manifest.action?.default_icon, expectedIcons);
  assert.equal(manifest.background?.service_worker, "background.js");
  assert.equal(manifest.side_panel?.default_path, "sidepanel.html");
  for (const field of [
    "activeTab",
    "scripting",
    "tabs",
    "cookies",
    "content_scripts",
    "optional_host_permissions",
    "externally_connectable",
    "web_accessible_resources",
    "update_url",
    "key",
  ])
    assert.equal(
      manifest[field],
      undefined,
      `Unexpected manifest field ${field}`,
    );
  assert.equal(
    manifest.content_security_policy?.extension_pages,
    "default-src 'self'; script-src 'self'; object-src 'none'; connect-src https://issopen.serviciosegado.com data:; img-src 'self' data: blob:; style-src 'self'; base-uri 'none'; form-action 'none'; frame-src 'none'",
  );
  for (const [size, path] of Object.entries(expectedIcons)) {
    const entry = entries.find((candidate) => candidate.path === path);
    assert(entry, `Missing icon ${path}`);
    const dimensions = imageDimensions(entry.bytes);
    assert.equal(dimensions.type, "image/png");
    assert.equal(dimensions.width, Number(size));
    assert.equal(dimensions.height, Number(size));
  }
  const allowed = [
    /^assets\/sidepanel-[A-Za-z0-9_-]+\.css$/,
    /^background\.js$/,
    /^chunks\/sidepanel-[A-Za-z0-9_-]+\.js$/,
    /^icons\/icon-(?:16|48|128)\.png$/,
    /^manifest\.json$/,
    /^sidepanel\.html$/,
  ];
  for (const entry of entries) {
    assert(
      allowed.some((pattern) => pattern.test(entry.path)),
      `Unexpected package file ${entry.path}`,
    );
    assert(!entry.path.endsWith(".map"), `Sourcemap packaged: ${entry.path}`);
    if (/\.(?:js|html|css)$/.test(entry.path)) {
      const text = entry.bytes.toString("utf8");
      assert(!/importScripts\s*\(\s*["'`]https?:/i.test(text));
      assert(!/<script[^>]+src\s*=\s*["']https?:/i.test(text));
      assert(!/\beval\s*\(/.test(text));
      assert(!/\bnew\s+Function\s*\(/.test(text));
    }
  }
  return {
    manifest,
    entries,
    audit: {
      manifestVersion: 3,
      permissions: manifest.permissions,
      optionalPermissions: manifest.optional_permissions,
      hosts: manifest.host_permissions,
      icons: expectedIcons,
      remoteCode: false,
      sourcemaps: false,
      unexpectedFiles: false,
    },
  };
}

export function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}
