import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const roots = ["src", "scripts", "tests", ".planning", "deploy"];
const topLevelFiles = ["README.md", "AGENTS.md", "app.yaml", "compose.yml"];
const extensions = new Set([".ts", ".tsx", ".md", ".yaml", ".yml", ".json"]);
const skippedDirectories = new Set([
  "node_modules",
  "dist",
  "drizzle",
  "test-results",
]);
const secretPatterns = [
  { name: "Issopen PAT", value: /issopen_pat_[A-Za-z0-9_-]{40,}/g },
  { name: "credential-bearing URL", value: /https?:\/\/[^\s/:]+:[^\s@${}]+@/g },
  {
    name: "private key",
    value: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    name: "literal Better Auth secret",
    value: /BETTER_AUTH_SECRET\s*=\s*[A-Za-z0-9_-]{32,}/g,
  },
];

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".planning") continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name))
        files.push(...(await filesUnder(child)));
    } else if (extensions.has(extname(entry.name))) {
      files.push(child);
    }
  }
  return files;
}

const files = [
  ...topLevelFiles,
  ...(await Promise.all(roots.map((root) => filesUnder(root)))).flat(),
];
const findings: string[] = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const pattern of secretPatterns) {
    pattern.value.lastIndex = 0;
    if (pattern.value.test(content)) {
      findings.push(`${relative(".", file)}: ${pattern.name}`);
    }
  }
}
if (findings.length > 0) {
  process.stderr.write(`Secret scan failed:\n${findings.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Secret scan passed (${files.length} files).\n`);
}
