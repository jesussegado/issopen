import { describe, expect, it, vi } from "vitest";
import {
  prepareOperation,
  runOperation,
} from "../skills/issopen/scripts/operations.mjs";

describe("bounded logical-operation retries", () => {
  it("reuses exactly the same key and payload after a lost response", async () => {
    const op = prepareOperation("create_issue", { title: "One" }, 100);
    const effects = new Map();
    const seen = [];
    const call = async (tool, args) => {
      seen.push({ tool, args });
      if (effects.has(args.idempotencyKey))
        return effects.get(args.idempotencyKey);
      effects.set(args.idempotencyKey, { id: "created-once" });
      throw Object.assign(new Error("Response lost"), { code: "ECONNRESET" });
    };
    expect(
      await runOperation(call, op, { now: () => 101, sleep: async () => {} }),
    ).toEqual({ id: "created-once" });
    expect(effects.size).toBe(1);
    expect(seen[0]).toEqual(seen[1]);
  });
  it.each([401, 403, 409, 400])(
    "does not retry status %s or switch identity",
    async (status) => {
      const call = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("Denied"), { status }));
      await expect(
        runOperation(call, prepareOperation("update_issue", {})),
      ).rejects.toThrow("Denied");
      expect(call).toHaveBeenCalledTimes(1);
    },
  );
  it("stops after three attempts and refuses modified or expired operations", async () => {
    const call = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("Unavailable"), { status: 503 }),
      );
    const op = prepareOperation("create_issue", { title: "Original" }, 0);
    await expect(
      runOperation(call, op, { now: () => 1, sleep: async () => {} }),
    ).rejects.toThrow("Unavailable");
    expect(call).toHaveBeenCalledTimes(3);
    call.mockClear();
    await expect(
      runOperation(call, op, { now: () => 86400000 }),
    ).rejects.toThrow("retention");
    op.arguments.title = "Changed";
    await expect(runOperation(call, op)).rejects.toThrow("Operation changed");
    expect(call).not.toHaveBeenCalled();
  });
});
