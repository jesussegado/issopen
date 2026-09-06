import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainError } from "../../src/server/domain/index.js";
import {
  decodeMcpCursor,
  encodeMcpCursor,
  mcpPage,
  paginationQueryFingerprint,
} from "../../src/server/mcp/pagination.js";

const keySchema = z
  .object({
    createdAt: z.iso.datetime().transform((value) => new Date(value)),
    id: z.uuid(),
  })
  .strict();

describe("MCP pagination cursors", () => {
  it("round-trips an opaque cursor only for the matching query", () => {
    const query = paginationQueryFingerprint({
      tool: "list_activity",
      issueId: "11111111-1111-4111-8111-111111111111",
    });
    const cursor = encodeMcpCursor("activity", query, {
      createdAt: new Date("2026-08-31T10:00:00.000Z"),
      id: "22222222-2222-4222-8222-222222222222",
    });

    expect(cursor).not.toContain("2026-08-31");
    expect(decodeMcpCursor(cursor, "activity", query, keySchema)).toEqual({
      createdAt: new Date("2026-08-31T10:00:00.000Z"),
      id: "22222222-2222-4222-8222-222222222222",
    });
    expect(() =>
      decodeMcpCursor(
        cursor,
        "activity",
        paginationQueryFingerprint({ tool: "different" }),
        keySchema,
      ),
    ).toThrow(DomainError);
    expect(() => decodeMcpCursor(cursor, "projects", query, keySchema)).toThrow(
      DomainError,
    );
  });

  it("rejects malformed data and reports stable page metadata", () => {
    const query = paginationQueryFingerprint({ tool: "list_activity" });
    expect(() =>
      decodeMcpCursor("not-a-json-cursor", "activity", query, keySchema),
    ).toThrow("Invalid or stale pagination cursor");
    expect(mcpPage([1, 2], 2, "next")).toEqual({
      limit: 2,
      count: 2,
      hasMore: true,
      nextCursor: "next",
    });
    expect(mcpPage([], 50, null)).toEqual({
      limit: 50,
      count: 0,
      hasMore: false,
      nextCursor: null,
    });
  });
});
