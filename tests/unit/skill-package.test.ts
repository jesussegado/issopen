import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256 } from "../../scripts/extension-package.js";
import { packageSkill } from "../../scripts/package-skill.js";

describe("Issopen skill release package", () => {
  it("is deterministic, versioned and integrity-addressed", async () => {
    const first = await mkdtemp(join(tmpdir(), "issopen-skill-first-"));
    const second = await mkdtemp(join(tmpdir(), "issopen-skill-second-"));
    const a = await packageSkill(undefined, first);
    const b = await packageSkill(undefined, second);

    expect(a.archive.equals(b.archive)).toBe(true);
    expect(a.manifest).toMatchObject({
      schemaVersion: 1,
      name: "issopen",
      version: "0.2.1",
      archive: "/downloads/issopen-skill-0.2.1.zip",
      sha256: sha256(a.archive),
      entrypoint: "SKILL.md",
    });
    expect(
      JSON.parse(
        await readFile(join(first, "issopen-skill-manifest.json"), "utf8"),
      ),
    ).toEqual(a.manifest);
    expect(await readFile(join(first, "issopen-skill-0.2.1.zip"))).toEqual(
      a.archive,
    );
  });
});
