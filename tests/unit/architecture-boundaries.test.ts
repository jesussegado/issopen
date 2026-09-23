import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repository = resolve(import.meta.dirname, "../..");

function sourceFiles(directory: string): string[] {
  const root = join(repository, directory);
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative(repository, path));
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function imports(source: string): string[] {
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  return patterns.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => match[1] ?? ""),
  );
}

function importViolations(
  directories: string[],
  forbidden: (specifier: string) => boolean,
) {
  return directories.flatMap((directory) =>
    sourceFiles(directory).flatMap((file) =>
      imports(readFileSync(file, "utf8"))
        .filter(forbidden)
        .map(
          (specifier) =>
            `${relative(repository, file)} imports forbidden ${specifier}`,
        ),
    ),
  );
}

describe("modular monolith boundaries", () => {
  it("keeps browser code independent from server internals", () => {
    const violations = importViolations(
      ["src/web", "extensions/chrome"],
      (specifier) =>
        specifier.includes("/server/") || specifier.startsWith("../server"),
    );
    expect(violations).toEqual([]);
  });

  it("keeps shared contracts independent from every adapter", () => {
    const violations = importViolations(
      ["src/shared"],
      (specifier) =>
        specifier.includes("/server/") ||
        specifier.includes("/web/") ||
        specifier.includes("extensions/chrome"),
    );
    expect(violations).toEqual([]);
  });

  it("keeps the domain independent from HTTP, MCP, web and Chrome adapters", () => {
    const violations = importViolations(
      ["src/server/domain"],
      (specifier) =>
        specifier.includes("/http/") ||
        specifier.includes("/mcp/") ||
        specifier.includes("/web/") ||
        specifier.includes("extensions/chrome"),
    );
    expect(violations).toEqual([]);
  });

  it("keeps tracker capabilities cohesive behind the compatible facade", () => {
    const capabilityFiles = [
      "tracker-activity.ts",
      "tracker-discussion.ts",
      "tracker-issues.ts",
      "tracker-projects.ts",
      "tracker-workflow.ts",
    ];
    const capabilitySpecifier =
      /^\.\/tracker-(?:activity|discussion|issues|projects|workflow)\.js$/;
    const violations = capabilityFiles.flatMap((file) => {
      const source = readFileSync(
        join(repository, "src/server/domain", file),
        "utf8",
      );
      return [
        ...imports(source)
          .filter((specifier) => capabilitySpecifier.test(specifier))
          .map(
            (specifier) => `${file} imports sibling capability ${specifier}`,
          ),
        ...(source.split("\n").length > 650
          ? [`${file} grew beyond its cohesive capability boundary`]
          : []),
      ];
    });
    const facade = readFileSync(
      join(repository, "src/server/domain/tracker.ts"),
      "utf8",
    );
    for (const file of capabilityFiles) {
      const specifier = `./${file.replace(/\.ts$/, ".js")}`;
      if (!imports(facade).includes(specifier)) {
        violations.push(`tracker.ts does not compose ${specifier}`);
      }
    }
    for (const directory of ["src/server/http", "src/server/mcp"]) {
      for (const file of sourceFiles(directory)) {
        for (const specifier of imports(readFileSync(file, "utf8"))) {
          if (capabilitySpecifier.test(specifier)) {
            violations.push(
              `${relative(repository, file)} bypasses TrackerService via ${specifier}`,
            );
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps MCP tool families independent behind one registry", () => {
    const familyFiles = [
      "tools-discussion.ts",
      "tools-issues.ts",
      "tools-projects.ts",
      "tools-workflow.ts",
    ];
    const familySpecifier =
      /^\.\/tools-(?:discussion|issues|projects|workflow)\.js$/;
    const violations = familyFiles.flatMap((file) => {
      const source = readFileSync(
        join(repository, "src/server/mcp", file),
        "utf8",
      );
      return [
        ...imports(source)
          .filter((specifier) => familySpecifier.test(specifier))
          .map((specifier) => `${file} imports sibling family ${specifier}`),
        ...(source.split("\n").length > 400
          ? [`${file} grew beyond its tool family boundary`]
          : []),
        ...(!source.includes("requireScope(")
          ? [`${file} does not keep scope checks beside its tools`]
          : []),
      ];
    });
    const registry = readFileSync(
      join(repository, "src/server/mcp/tools.ts"),
      "utf8",
    );
    for (const file of familyFiles) {
      const specifier = `./${file.replace(/\.ts$/, ".js")}`;
      if (!imports(registry).includes(specifier)) {
        violations.push(`tools.ts does not compose ${specifier}`);
      }
    }
    if (registry.includes("registerTool(")) {
      violations.push("tools.ts owns a tool instead of composing families");
    }

    expect(violations).toEqual([]);
  });

  it("keeps the board route as a composition boundary", () => {
    const route = readFileSync(
      join(repository, "src/web/routes/BoardRoute.tsx"),
      "utf8",
    );
    const required = [
      "../components/board/BoardColumn.js",
      "../components/board/BoardEpicOverview.js",
      "../components/board/BoardToolbar.js",
      "../lib/board-drag.js",
      "../lib/board-model.js",
    ];
    const violations = required
      .filter((specifier) => !imports(route).includes(specifier))
      .map((specifier) => `BoardRoute does not compose ${specifier}`);
    if (route.split("\n").length > 400)
      violations.push("BoardRoute grew beyond high-level composition");
    for (const file of sourceFiles("src/web/components/board")) {
      for (const specifier of imports(readFileSync(file, "utf8"))) {
        if (specifier.includes("/routes/"))
          violations.push(
            `${relative(repository, file)} imports route ${specifier}`,
          );
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps issue detail state and panels behind composition boundaries", () => {
    const route = readFileSync(
      join(repository, "src/web/routes/IssueDetailRoute.tsx"),
      "utf8",
    );
    const required = [
      "../components/issue-detail/ActivityPanel.js",
      "../components/issue-detail/CommentsPanel.js",
      "../components/issue-detail/QuestionsPanel.js",
      "../components/issue-detail/RemoteChangesPanel.js",
      "../lib/issue-detail-machine.js",
      "../lib/issue-detail-snapshot.js",
    ];
    const violations = required
      .filter((specifier) => !imports(route).includes(specifier))
      .map((specifier) => `IssueDetailRoute does not compose ${specifier}`);
    if (route.split("\n").length > 1_000)
      violations.push("IssueDetailRoute grew beyond orchestration concerns");
    for (const file of sourceFiles("src/web/components/issue-detail")) {
      const source = readFileSync(file, "utf8");
      for (const specifier of imports(source)) {
        if (specifier.includes("/routes/"))
          violations.push(
            `${relative(repository, file)} imports route ${specifier}`,
          );
        if (specifier.includes("/lib/api"))
          violations.push(
            `${relative(repository, file)} owns transport through ${specifier}`,
          );
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps the web cascade split into ordered responsibility layers", () => {
    const manifest = readFileSync(
      join(repository, "src/web/styles.css"),
      "utf8",
    );
    const layers = [
      "foundation.css",
      "evidence.css",
      "base.css",
      "shell-public.css",
      "components.css",
      "board.css",
      "issue-detail.css",
      "administration.css",
      "responsive.css",
      "account-collaboration.css",
    ];
    const importedLayers = [
      ...manifest.matchAll(/@import\s+["']\.\/styles\/([^"']+)["'];/g),
    ].map((match) => match[1]);
    const violations: string[] = [];
    if (manifest.includes("{"))
      violations.push("styles.css owns rules instead of cascade order");
    if (JSON.stringify(importedLayers) !== JSON.stringify(layers))
      violations.push("styles.css changed its documented cascade order");
    for (const layer of layers) {
      const source = readFileSync(
        join(repository, "src/web/styles", layer),
        "utf8",
      );
      if (source.split("\n").length > 500)
        violations.push(`${layer} mixes too many style responsibilities`);
      if (source.includes("@import") && layer !== "foundation.css")
        violations.push(`${layer} introduces a hidden cascade dependency`);
    }

    expect(violations).toEqual([]);
  });

  it("keeps database writes out of HTTP and MCP adapters", () => {
    const writePattern =
      /\b(?:db|tx|database|connection\.db)\s*\.\s*(?:insert|update|delete)\s*\(/;
    const violations = ["src/server/http", "src/server/mcp"].flatMap(
      (directory) =>
        sourceFiles(directory).flatMap((file) =>
          writePattern.test(readFileSync(file, "utf8"))
            ? [`${relative(repository, file)} performs a direct database write`]
            : [],
        ),
    );
    expect(violations).toEqual([]);
  });

  it("keeps transport validation and domain error serialization centralized", () => {
    const allowed = new Set([
      "src/server/http/errors.ts",
      "src/server/http/validation.ts",
    ]);
    const duplicatePattern =
      /\.safeParse\(|\.req\.json\(\)\.catch\(|function\s+domainErrorResponse\b/;
    const violations = sourceFiles("src/server/http")
      .map((file) => ({
        file: relative(repository, file),
        source: readFileSync(file, "utf8"),
      }))
      .filter(({ file, source }) =>
        allowed.has(file) ? false : duplicatePattern.test(source),
      )
      .map(({ file }) => `${file} duplicates HTTP transport validation`);

    expect(violations).toEqual([]);
  });

  it("keeps the large integration suites on explicit boundary fixtures", () => {
    const suites = [
      "tests/integration/http.test.ts",
      "tests/integration/mcp.test.ts",
      "tests/integration/extensions.test.ts",
      "tests/integration/tracker.test.ts",
    ];
    const violations = suites.flatMap((file) => {
      const source = readFileSync(join(repository, file), "utf8");
      return [
        source.includes("IntegrationDatabase")
          ? null
          : `${file} does not use the shared database fixture`,
        /TRUNCATE\s+(?:TABLE\s+)?["']/.test(source)
          ? `${file} duplicates database reset SQL`
          : null,
      ].filter((entry): entry is string => entry !== null);
    });
    const adapterFixtures = {
      "tests/integration/http.test.ts": "createTestRuntime",
      "tests/integration/mcp.test.ts": "createMcpTestClient",
      "tests/integration/extensions.test.ts": "ExtensionTestDriver",
    };
    for (const [file, fixture] of Object.entries(adapterFixtures)) {
      if (!readFileSync(join(repository, file), "utf8").includes(fixture)) {
        violations.push(`${file} does not use ${fixture}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps schema consumers on the stable facade", () => {
    const violations = sourceFiles("src")
      .filter((file) => !file.includes("/server/db/schema/"))
      .flatMap((file) =>
        imports(readFileSync(file, "utf8"))
          .filter((specifier) => specifier.includes("/db/schema/"))
          .map(
            (specifier) =>
              `${relative(repository, file)} imports internal schema module ${specifier}`,
          ),
      );

    expect(violations).toEqual([]);
  });

  it("keeps the schema module dependency graph acyclic", () => {
    const allowedDependencies: Record<string, string[]> = {
      "identity.ts": [],
      "access.ts": ["identity"],
      "agents.ts": ["access"],
      "tracker.ts": ["access", "agents", "identity"],
      "notifications.ts": ["access", "identity", "tracker"],
      "captures.ts": ["access", "identity", "tracker"],
      "relations.ts": ["access", "agents", "identity", "tracker"],
    };

    const violations = Object.entries(allowedDependencies).flatMap(
      ([file, allowed]) =>
        imports(
          readFileSync(join(repository, "src/server/db/schema", file), "utf8"),
        )
          .filter((specifier) => specifier.startsWith("./"))
          .map((specifier) =>
            specifier.replace(/^\.\//, "").replace(/\.js$/, ""),
          )
          .filter((dependency) => !allowed.includes(dependency))
          .map((dependency) => `${file} imports forbidden ${dependency}`),
    );

    expect(violations).toEqual([]);
  });
});
