import { pathToFileURL } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { loadConfig } from "../config.js";
import { createDatabase } from "./client.js";

export async function migrateDatabase(
  databaseUrl: string,
  migrationsFolder = "drizzle",
): Promise<void> {
  const connection = createDatabase(databaseUrl, { max: 1 });
  try {
    await migrate(connection.db, { migrationsFolder });
  } finally {
    await connection.close();
  }
}

async function main() {
  const config = loadConfig();
  await migrateDatabase(config.databaseUrl);
  process.stdout.write("Database migrations completed.\n");
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main().catch(() => {
    process.stderr.write("Database migration failed.\n");
    process.exitCode = 1;
  });
}
