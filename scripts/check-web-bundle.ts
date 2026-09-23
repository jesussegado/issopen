import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

type ManifestEntry = {
  file: string;
  imports?: string[];
  dynamicImports?: string[];
  isDynamicEntry?: boolean;
  isEntry?: boolean;
  src?: string;
};

const repository = resolve(dirname(new URL(import.meta.url).pathname), "..");
const output = join(repository, "dist/web");
const manifest = JSON.parse(
  readFileSync(join(output, ".vite/manifest.json"), "utf8"),
) as Record<string, ManifestEntry>;
const entryRecord = Object.entries(manifest).find(([, value]) => value.isEntry);
if (!entryRecord) throw new Error("Web bundle manifest has no entry");

const [entryKey] = entryRecord;
const initialKeys = new Set<string>();
function collectStatic(key: string) {
  if (initialKeys.has(key)) return;
  initialKeys.add(key);
  for (const dependency of manifest[key]?.imports ?? []) {
    collectStatic(dependency);
  }
}
collectStatic(entryKey);

const initialFiles = [...initialKeys]
  .map((key) => manifest[key]?.file)
  .filter((file): file is string => Boolean(file?.endsWith(".js")));
const initialBytes = initialFiles.reduce(
  (total, file) => total + statSync(join(output, file)).size,
  0,
);
const initialGzipBytes = initialFiles.reduce(
  (total, file) =>
    total + gzipSync(readFileSync(join(output, file)), { level: 9 }).byteLength,
  0,
);
const dynamicRoutes = Object.values(manifest)
  .filter((item) => item.isDynamicEntry && item.src?.startsWith("routes/"))
  .map((item) => ({
    source: item.src,
    file: item.file,
    bytes: statSync(join(output, item.file)).size,
  }))
  .sort((left, right) => right.bytes - left.bytes);

const budget = { initialBytes: 240_000, initialGzipBytes: 80_000 };
console.log(
  JSON.stringify(
    {
      initial: {
        files: initialFiles,
        bytes: initialBytes,
        gzipBytes: initialGzipBytes,
      },
      budget,
      dynamicRoutes,
    },
    null,
    2,
  ),
);

if (dynamicRoutes.length < 10) {
  throw new Error("Expected route-level chunks in the production manifest");
}
if (initialBytes > budget.initialBytes) {
  throw new Error(
    `Initial JavaScript is ${initialBytes} bytes; budget is ${budget.initialBytes}`,
  );
}
if (initialGzipBytes > budget.initialGzipBytes) {
  throw new Error(
    `Initial gzip JavaScript is ${initialGzipBytes} bytes; budget is ${budget.initialGzipBytes}`,
  );
}
