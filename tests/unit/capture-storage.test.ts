import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boundedJson } from "../../src/server/capture-api.js";
import {
  CaptureStorage,
  normalizePng,
} from "../../src/server/capture-storage.js";
import { syntheticPng } from "../fixtures/png.js";

const url = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;
describe("private PNG storage", () => {
  it("validates pixels/CRC, strips metadata and rejects polyglots/trailing bytes", async () => {
    expect(await normalizePng(url(syntheticPng(true)))).toEqual(syntheticPng());
    const corrupt = syntheticPng();
    corrupt[40] = 0;
    for (const invalid of [
      corrupt,
      Buffer.concat([syntheticPng(), Buffer.from("<svg/>")]),
      Buffer.from("<svg/>"),
    ])
      await expect(normalizePng(url(invalid))).rejects.toThrow();
  });
  it("persists immutable private files, verifies restore and rejects traversal/symlinks/corruption", async () => {
    const directory = await mkdtemp(join(tmpdir(), "issopen-storage-"));
    const storage = new CaptureStorage(directory);
    const png = syntheticPng();
    const file = await storage.write(png);
    expect(await storage.read(file.fileKey, file.sha256, file.bytes)).toEqual(
      png,
    );
    const restored = new CaptureStorage(
      await mkdtemp(join(tmpdir(), "issopen-restore-")),
    );
    await writeFile(
      restored.path(file.fileKey),
      await readFile(storage.path(file.fileKey)),
      { mode: 0o600 },
    );
    expect(await restored.read(file.fileKey, file.sha256, file.bytes)).toEqual(
      png,
    );
    expect((await storage.usage()).bytes).toBe(png.length);
    expect(() => storage.path("../secrets.env")).toThrow();
    const symlinkKey = "00000000-0000-4000-8000-000000000000.png";
    await symlink(storage.path(file.fileKey), storage.path(symlinkKey));
    await expect(
      storage.read(symlinkKey, file.sha256, file.bytes),
    ).rejects.toThrow();
    await writeFile(restored.path(file.fileKey), Buffer.alloc(png.length));
    await expect(
      restored.read(file.fileKey, file.sha256, file.bytes),
    ).rejects.toThrow();
  });
  it("bounds streamed JSON even without content-length", async () => {
    await expect(
      boundedJson(
        new Request("http://test/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: "x".repeat(500) }),
        }),
        100,
      ),
    ).rejects.toThrow("size");
  });
});
