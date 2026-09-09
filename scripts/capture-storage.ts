import { auditCaptures } from "../src/server/capture-maintenance.js";
import { CaptureStorage } from "../src/server/capture-storage.js";
import { createDatabase } from "../src/server/db/client.js";

// Read-only by default. Quarantine is explicit, recoverable, lock-protected and
// limited to unreferenced UUID PNGs older than 24 h. Never delete directories.
async function main() {
  if (process.argv.slice(2).some((arg) => arg !== "--quarantine"))
    throw new Error("Usage: capture-storage [--quarantine]");
  const directory = process.env.ISSOPEN_ATTACHMENTS_DIR;
  const url = process.env.DATABASE_URL;
  if (!directory || !url)
    throw new Error("Storage and database configuration required");
  const connection = createDatabase(url);
  try {
    const report = await auditCaptures(
      connection.db,
      new CaptureStorage(
        directory,
        Number(process.env.ISSOPEN_ATTACHMENTS_QUOTA_BYTES ?? 1073741824),
      ),
      process.argv.includes("--quarantine"),
    );
    console.log(JSON.stringify(report));
    if (report.invalid) process.exitCode = 1;
  } finally {
    await connection.close();
  }
}
main().catch(() => {
  console.error(
    "Capture storage audit failed; no payload or credentials logged.",
  );
  process.exitCode = 1;
});
