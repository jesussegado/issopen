import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const extension = resolve(import.meta.dirname, "../..");

describe("composer architecture", () => {
  it("keeps Workspace as transport-free composition", () => {
    const workspace = readFileSync(
      join(extension, "entrypoints/sidepanel/Workspace.tsx"),
      "utf8",
    );
    const required = [
      "./composer/CreationResult",
      "./composer/InlineCreation",
      "./composer/TicketForm",
      "./composer/useComposer",
    ];
    const violations = required
      .filter((specifier) => !workspace.includes(`from "${specifier}"`))
      .map((specifier) => `Workspace does not compose ${specifier}`);
    if (workspace.split("\n").length > 120)
      violations.push("Workspace grew beyond page composition");
    if (workspace.includes("browser.") || workspace.includes("lib/draft"))
      violations.push("Workspace owns persistence or browser transport");

    const composerRoot = join(extension, "entrypoints/sidepanel/composer");
    for (const entry of readdirSync(composerRoot, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
      const source = readFileSync(join(composerRoot, entry.name), "utf8");
      if (source.includes("browser.") || source.includes("lib/draft"))
        violations.push(`${entry.name} owns persistence or browser transport`);
    }

    expect(violations).toEqual([]);
  });
});
