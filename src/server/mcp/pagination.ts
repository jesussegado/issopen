import { createHash } from "node:crypto";
import { z } from "zod";
import { DomainError } from "../domain/index.js";

export const mcpPageLimitSchema = z.number().int().min(1).max(100).default(50);
export const mcpCursorSchema = z.string().trim().min(1).max(2_048).optional();

type CursorKind = "projects" | "issues" | "activity";

const cursorEnvelopeSchema = z
  .object({
    version: z.literal(1),
    kind: z.enum(["projects", "issues", "activity"]),
    query: z.string().length(43),
    key: z.unknown(),
  })
  .strict();

function invalidCursor(): never {
  throw new DomainError("invalid", "Invalid or stale pagination cursor", [
    {
      field: "cursor",
      message: "Use only the nextCursor returned by the same tool and filters",
    },
  ]);
}

export function paginationQueryFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("base64url");
}

export function encodeMcpCursor(kind: CursorKind, query: string, key: unknown) {
  return Buffer.from(
    JSON.stringify({ version: 1, kind, query, key }),
    "utf8",
  ).toString("base64url");
}

export function decodeMcpCursor<T>(
  cursor: string | undefined,
  kind: CursorKind,
  query: string,
  keySchema: z.ZodType<T>,
): T | undefined {
  if (!cursor) return undefined;
  try {
    const envelope = cursorEnvelopeSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    if (envelope.kind !== kind || envelope.query !== query) invalidCursor();
    const key = keySchema.safeParse(envelope.key);
    if (!key.success) invalidCursor();
    return key.data;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    return invalidCursor();
  }
}

export function mcpPage<T>(
  items: T[],
  limit: number,
  nextCursor: string | null,
) {
  return {
    limit,
    count: items.length,
    hasMore: nextCursor !== null,
    nextCursor,
  };
}
