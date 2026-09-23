import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {
  createDatabase,
  type DatabaseConnection,
} from "../../src/server/db/client.js";
import { migrateDatabase } from "../../src/server/db/migrate.js";

const postgresImage = "postgres:18.6-alpine";

function quoteTable(table: string) {
  if (!/^[a-z][a-z0-9_]*$/.test(table)) {
    throw new Error(`Unsafe test table name: ${table}`);
  }
  return `"${table}"`;
}

export class IntegrationDatabase {
  private constructor(
    readonly connection: DatabaseConnection,
    readonly url: string,
    private readonly container: StartedPostgreSqlContainer,
  ) {}

  static async start() {
    const container = await new PostgreSqlContainer(postgresImage).start();
    const url = container.getConnectionUri();
    await migrateDatabase(url);
    return new IntegrationDatabase(createDatabase(url), url, container);
  }

  get username() {
    return this.container.getUsername();
  }

  get databaseName() {
    return this.container.getDatabase();
  }

  exec(command: string[]) {
    return this.container.exec(command);
  }

  async reset(tables: readonly string[]) {
    if (tables.length === 0) return;
    await this.connection.client.unsafe(
      `TRUNCATE TABLE ${tables.map(quoteTable).join(", ")} CASCADE`,
    );
  }

  async stop() {
    await this.connection.close();
    await this.container.stop();
  }
}
