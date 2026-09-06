import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createAuth, type IssopenAuth } from "../src/server/auth.js";
import { loadConfig } from "../src/server/config.js";
import {
  createDatabase,
  type Database,
  type DatabaseConnection,
} from "../src/server/db/client.js";
import {
  account,
  instanceOwner,
  session,
  user,
} from "../src/server/db/schema.js";

const OWNER_LOCK_ID = 4_974_957_679_781;
const CREDENTIAL_ISSUER = "local:credential";

const ownerInputSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(1).max(100).default("Owner"),
});

export class OwnerCommandError extends Error {
  override readonly name = "OwnerCommandError";
}

export type OwnerInput = z.input<typeof ownerInputSchema>;

export async function bootstrapOwner(
  db: Database,
  auth: IssopenAuth,
  input: OwnerInput,
): Promise<{ created: boolean }> {
  const owner = ownerInputSchema.parse(input);
  const context = await auth.$context;
  const passwordHash = await context.password.hash(owner.password);

  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(${OWNER_LOCK_ID}::bigint)`,
    );

    const [existingOwner] = await transaction
      .select({ email: user.email })
      .from(instanceOwner)
      .innerJoin(user, eq(instanceOwner.userId, user.id))
      .limit(1);

    if (existingOwner) {
      if (existingOwner.email === owner.email) {
        return { created: false };
      }
      throw new OwnerCommandError(
        "This Issopen instance already has an owner.",
      );
    }

    const [unmanagedAccount] = await transaction
      .select({ id: user.id })
      .from(user)
      .limit(1);
    if (unmanagedAccount) {
      throw new OwnerCommandError(
        "Owner bootstrap refused because an unmanaged account already exists.",
      );
    }

    const userId = randomUUID();
    const now = new Date();

    await transaction.insert(user).values({
      id: userId,
      name: owner.name,
      email: owner.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await transaction.insert(account).values({
      id: randomUUID(),
      issuer: CREDENTIAL_ISSUER,
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    await transaction.insert(instanceOwner).values({ userId, createdAt: now });

    return { created: true };
  });
}

export async function recoverOwner(
  db: Database,
  auth: IssopenAuth,
  input: OwnerInput,
): Promise<void> {
  const owner = ownerInputSchema.parse(input);
  const context = await auth.$context;
  const passwordHash = await context.password.hash(owner.password);

  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(${OWNER_LOCK_ID}::bigint)`,
    );

    const [existingOwner] = await transaction
      .select({ userId: instanceOwner.userId, email: user.email })
      .from(instanceOwner)
      .innerJoin(user, eq(instanceOwner.userId, user.id))
      .limit(1);

    if (!existingOwner || existingOwner.email !== owner.email) {
      throw new OwnerCommandError(
        "Owner recovery could not verify the account.",
      );
    }

    const [credential] = await transaction
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(
        and(
          eq(account.userId, existingOwner.userId),
          eq(account.providerId, "credential"),
          eq(account.issuer, CREDENTIAL_ISSUER),
        ),
      )
      .returning({ id: account.id });

    if (!credential) {
      throw new OwnerCommandError(
        "Owner recovery found no credential to rotate.",
      );
    }

    await transaction
      .delete(session)
      .where(eq(session.userId, existingOwner.userId));
  });
}

function commandInput(): OwnerInput {
  const email = process.env.ISSOPEN_OWNER_EMAIL;
  const password = process.env.ISSOPEN_OWNER_PASSWORD;
  const name = process.env.ISSOPEN_OWNER_NAME ?? "Owner";

  if (!email || !password) {
    throw new OwnerCommandError(
      "Set ISSOPEN_OWNER_EMAIL and ISSOPEN_OWNER_PASSWORD for this command only.",
    );
  }

  return { email, password, name };
}

async function runCommand(connection: DatabaseConnection) {
  const operation = process.argv[2];
  const config = loadConfig();
  const auth = createAuth(connection.db, config);
  const input = commandInput();

  if (operation === "bootstrap") {
    const result = await bootstrapOwner(connection.db, auth, input);
    process.stdout.write(
      result.created
        ? "Owner bootstrapped.\n"
        : "Owner was already bootstrapped; no changes made.\n",
    );
    return;
  }

  if (operation === "recover") {
    await recoverOwner(connection.db, auth, input);
    process.stdout.write(
      "Owner credential rotated and active sessions revoked.\n",
    );
    return;
  }

  throw new OwnerCommandError("Use owner bootstrap or owner recover.");
}

async function main() {
  const config = loadConfig();
  const connection = createDatabase(config.databaseUrl);
  try {
    await runCommand(connection);
  } finally {
    await connection.close();
  }
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  main().catch((error) => {
    const message =
      error instanceof OwnerCommandError || error instanceof z.ZodError
        ? error.message
        : "Owner command failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
