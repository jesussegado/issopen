import { serve } from "@hono/node-server";
import pino from "pino";
import { createApp } from "./app.js";
import { createAuth } from "./auth.js";
import { CaptureStorage } from "./capture-storage.js";
import { ConfigError, loadConfig } from "./config.js";
import { createDatabase } from "./db/client.js";

const logger = pino({
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "request.headers.authorization",
      "request.headers.cookie",
      "password",
      "token",
      "secret",
    ],
    censor: "[Redacted]",
  },
});

async function main() {
  const config = loadConfig();
  const connection = createDatabase(config.databaseUrl);
  const auth = createAuth(connection.db, config);
  const captureStorage = process.env.ISSOPEN_ATTACHMENTS_DIR
    ? new CaptureStorage(
        process.env.ISSOPEN_ATTACHMENTS_DIR,
        Number(process.env.ISSOPEN_ATTACHMENTS_QUOTA_BYTES ?? 1073741824),
      )
    : undefined;
  await captureStorage?.ready();
  const app = createApp({
    logger,
    db: connection.db,
    auth,
    trustedOrigins: config.trustedOrigins,
    captureStorage,
    googleAuthEnabled: Boolean(config.googleOAuth),
  });
  const server = serve({
    fetch: app.fetch,
    hostname: "0.0.0.0",
    port: config.port,
  });

  const shutdown = async () => {
    server.close();
    await connection.close();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  logger.info(
    { port: config.port, baseUrl: config.baseUrl.origin },
    "Issopen server started",
  );
}

main().catch((error) => {
  if (error instanceof ConfigError) {
    logger.fatal({ error: error.message }, "Issopen configuration is invalid");
  } else {
    logger.fatal(
      {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : "Unknown startup error",
      },
      "Issopen failed to start",
    );
  }
  process.exitCode = 1;
});
