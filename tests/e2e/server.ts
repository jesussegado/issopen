import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pino from "pino";
import { bootstrapOwner } from "../../scripts/owner.js";
import { createApp } from "../../src/server/app.js";
import { createAuth } from "../../src/server/auth.js";
import { CaptureStorage } from "../../src/server/capture-storage.js";
import { loadConfig } from "../../src/server/config.js";
import { createDatabase } from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";
import { e2eBaseUrl, e2eOwner } from "./fixtures.js";
import { seedMultiworkspace } from "./multiworkspace-fixture.js";

const container = await new PostgreSqlContainer("postgres:18.6-alpine").start();
await migrateDatabase(container.getConnectionUri());
const connection = createDatabase(container.getConnectionUri());
const config = loadConfig({
  NODE_ENV: "test",
  PORT: "4173",
  DATABASE_URL: container.getConnectionUri(),
  ISSOPEN_BASE_URL: e2eBaseUrl,
  BETTER_AUTH_SECRET: "synthetic-better-auth-secret-for-e2e-tests",
});
const auth = createAuth(connection.db, config);
await bootstrapOwner(connection.db, auth, e2eOwner);
await seedMultiworkspace(connection.db, auth);
const app = createApp({
  captureStorage: new CaptureStorage(
    await mkdtemp(join(tmpdir(), "issopen-e2e-evidence-")),
  ),
  logger: pino({ level: "silent" }),
  db: connection.db,
  auth,
  trustedOrigins: config.trustedOrigins,
});
const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 4173 });

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await connection.close();
  await container.stop();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void close().finally(() => process.exit(0));
  });
}
