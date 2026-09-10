import { createHash, randomUUID } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client.js";
import { mcpIdempotencyRecord } from "../db/schema.js";
import type { AgentPrincipal } from "./agents/contracts.js";
import { DomainError } from "./errors.js";
import { TrackerService } from "./tracker.js";

const retentionMilliseconds = 24 * 60 * 60 * 1_000;

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
    "Use letters, numbers, dot, underscore, colon or hyphen",
  );

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function requestHash(payload: unknown) {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

function jsonResult<T extends Record<string, unknown>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class McpIdempotencyService {
  constructor(private readonly db: Database) {}

  async execute<T extends Record<string, unknown>>(
    principal: AgentPrincipal,
    toolName: string,
    idempotencyKey: string,
    payload: unknown,
    operation: (tracker: TrackerService) => Promise<T>,
  ): Promise<T> {
    const key = idempotencyKeySchema.parse(idempotencyKey);
    const hash = requestHash(payload);
    const lockScope = [
      principal.workspaceId,
      principal.agent.id,
      toolName,
      key,
    ].join(":");

    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${lockScope}, 0))`,
      );
      const now = new Date();
      await tx
        .delete(mcpIdempotencyRecord)
        .where(
          and(
            eq(mcpIdempotencyRecord.workspaceId, principal.workspaceId),
            lte(mcpIdempotencyRecord.expiresAt, now),
          ),
        );
      const [existing] = await tx
        .select()
        .from(mcpIdempotencyRecord)
        .where(
          and(
            eq(mcpIdempotencyRecord.workspaceId, principal.workspaceId),
            eq(mcpIdempotencyRecord.agentId, principal.agent.id),
            eq(mcpIdempotencyRecord.toolName, toolName),
            eq(mcpIdempotencyRecord.idempotencyKey, key),
          ),
        )
        .limit(1);
      if (existing) {
        if (existing.requestHash !== hash) {
          throw new DomainError(
            "conflict",
            "Idempotency key was already used with a different payload",
          );
        }
        const previous = z
          .object({ issue: z.object({ id: z.uuid() }) })
          .safeParse(existing.response);
        if (previous.success)
          await new TrackerService(tx).getIssue(
            principal.workspaceId,
            previous.data.issue.id,
          );
        return existing.response as T;
      }

      const response = jsonResult(await operation(new TrackerService(tx)));
      await tx.insert(mcpIdempotencyRecord).values({
        id: randomUUID(),
        workspaceId: principal.workspaceId,
        agentId: principal.agent.id,
        toolName,
        idempotencyKey: key,
        requestHash: hash,
        response,
        expiresAt: new Date(now.getTime() + retentionMilliseconds),
      });
      return response;
    });
  }
}
