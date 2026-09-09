import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function discover(skills) {
  const root = mkdtempSync(join(tmpdir(), "issopen-discovery-test-"));
  const binary = join(root, "mock-codex.mjs");
  writeFileSync(
    binary,
    [
      "#!/usr/bin/env node",
      'import { createInterface } from "node:readline";',
      'createInterface({ input: process.stdin }).on("line", line => {',
      "const request = JSON.parse(line);",
      "if (request.id === undefined) return;",
      `const result = request.method === "skills/list" ? { data: [{ skills: ${JSON.stringify(skills)} }] } : {};`,
      "console.log(JSON.stringify({ id: request.id, result }));",
      "});",
    ].join("\n"),
    { mode: 0o700 },
  );
  return spawnSync(
    process.execPath,
    [resolve("scripts/check-codex-skill.mjs"), binary, root],
    { encoding: "utf8", timeout: 5000 },
  );
}

describe("native discovery checker protocol", () => {
  it("accepts one enabled candidate while preserving a disabled personal copy", () => {
    const result = discover([
      { name: "issopen", path: "/personal/SKILL.md", enabled: false },
      { name: "issopen", path: "/fixture/SKILL.md", enabled: true },
      { name: "unrelated", path: "/other/SKILL.md", enabled: true },
    ]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).path).toBe("/fixture/SKILL.md");
  });

  it("rejects two enabled copies rather than silently selecting one", () => {
    const result = discover([
      { name: "issopen", path: "/personal/SKILL.md", enabled: true },
      { name: "issopen", path: "/fixture/SKILL.md", enabled: true },
    ]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });

  it("does not count a disabled-only installation as discovered", () => {
    const result = discover([
      { name: "issopen", path: "/personal/SKILL.md", enabled: false },
    ]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });

  it("accepts a client response that omits the optional enabled field", () => {
    const result = discover([{ name: "issopen", path: "/fixture/SKILL.md" }]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).path).toBe("/fixture/SKILL.md");
  });
});
