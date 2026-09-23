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
});
