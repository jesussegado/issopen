import type { z } from "zod";
import type { Database } from "../db/client.js";
import type { MutationContext } from "./contracts.js";
import { DomainError } from "./errors.js";
import type {
  ActivityChanges,
  TrackerTransaction,
} from "./tracker-mutations.js";

export type TrackerDatabase = Database | TrackerTransaction;

function validationFields(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export function parseTrackerInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      "invalid",
      "Invalid tracker input",
      validationFields(parsed.error),
    );
  }
  return parsed.data;
}

export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

export function changedFields(
  previousInput: object,
  nextInput: object,
): ActivityChanges {
  const previous = previousInput as Record<string, unknown>;
  const next = nextInput as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(next)
      .filter(([field, value]) => value !== previous[field])
      .map(([field, value]) => [
        field,
        { from: previous[field] ?? null, to: value ?? null },
      ]),
  );
}

export function requireHuman(context: MutationContext) {
  if (context.actor.type !== "human") {
    throw new DomainError("forbidden", "Human review is required");
  }
}

export abstract class TrackerCapability {
  constructor(protected readonly db: TrackerDatabase) {}

  protected transaction<T>(callback: (tx: TrackerTransaction) => Promise<T>) {
    if ("transaction" in this.db) return this.db.transaction(callback);
    return callback(this.db);
  }
}
