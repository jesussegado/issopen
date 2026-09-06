import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = PostgresJsDatabase<typeof schema>;

export type DatabaseConnection = {
  db: Database;
  client: ReturnType<typeof postgres>;
  close: () => Promise<void>;
};

export function createDatabase(
  databaseUrl: string,
  options: { max?: number } = {},
): DatabaseConnection {
  const client = postgres(databaseUrl, {
    max: options.max ?? 10,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => undefined,
  });
  const db = drizzle(client, { schema });

  return {
    db,
    client,
    close: () => client.end({ timeout: 5 }),
  };
}
