import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { CaptureStorage } from "./capture-storage.js";
import type { Database } from "./db/client.js";
import { captureEvidence } from "./db/schema.js";

export async function auditCaptures(
  db: Database,
  storage: CaptureStorage,
  quarantine = false,
  now = Date.now(),
) {
  return db.transaction(async (tx) => {
    // Same lock as writers: cannot quarantine a file before its commit.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('chrome-attachment-storage', 0))`,
    );
    const rows = await tx.select().from(captureEvidence);
    const referenced = new Set(
      rows.flatMap((r) => (r.fileKey ? [r.fileKey] : [])),
    );
    let verified = 0,
      invalid = 0,
      youngOrphans = 0,
      agedOrphans = 0,
      quarantined = 0;
    for (const row of rows) {
      if (!row.fileKey || !row.sha256) continue;
      try {
        await storage.read(row.fileKey, row.sha256, row.bytes);
        verified++;
      } catch {
        invalid++;
      }
    }
    await storage.ready();
    const destination = join(
      storage.directory,
      `quarantine-${now}-${randomUUID()}`,
    );
    for (const key of await readdir(storage.directory)) {
      if (!key.endsWith(".png") || referenced.has(key)) continue;
      const path = storage.path(key);
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink()) {
        invalid++;
        continue;
      }
      if (now - info.mtimeMs < 24 * 60 * 60 * 1000) {
        youngOrphans++;
        continue;
      }
      agedOrphans++;
      if (quarantine) {
        await mkdir(destination, { mode: 0o700, recursive: true });
        await rename(path, join(destination, key));
        quarantined++;
      }
    }
    return {
      ...(await storage.usage()),
      verified,
      invalid,
      youngOrphans,
      agedOrphans,
      quarantined,
    };
  });
}
