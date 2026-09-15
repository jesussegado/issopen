import { Hono } from "hono";
import { z } from "zod";
import type { OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import { DomainError } from "../domain/errors.js";
import { type HumanAccess, requireHumanAccess } from "../human-access.js";
import {
  OwnershipService,
  ownershipCancelSchema,
  ownershipFinishSchema,
  ownershipPeopleSchema,
  ownershipStartSchema,
} from "../ownership.js";

export function createOwnershipRouter(db: Database) {
  const router = new Hono<{
    Variables: { ownerSession: OwnerSession; humanAccess: HumanAccess | null };
  }>();
  const service = new OwnershipService(db);
  const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
    const result = schema.safeParse(value);
    if (!result.success)
      throw new DomainError(
        "invalid",
        "Invalid ownership request. Refresh and review all confirmation fields.",
      );
    return result.data;
  };
  router.get("/workspace/ownership", async (c) =>
    c.json(
      await service.snapshot(
        requireHumanAccess(c.get("humanAccess")),
        c.get("ownerSession"),
      ),
    ),
  );
  router.get("/workspace/ownership/people", async (c) =>
    c.json(
      await service.people(
        requireHumanAccess(c.get("humanAccess")),
        parse(ownershipPeopleSchema, c.req.query()),
      ),
    ),
  );
  router.post("/workspace/ownership", async (c) =>
    c.json({
      transfer: await service.propose(
        requireHumanAccess(c.get("humanAccess")),
        c.get("ownerSession"),
        parse(ownershipStartSchema, await c.req.json().catch(() => null)),
      ),
    }),
  );
  router.post("/workspace/ownership/:id/accept", async (c) =>
    c.json({
      transfer: await service.accept(
        requireHumanAccess(c.get("humanAccess")),
        c.get("ownerSession"),
        parse(z.uuid(), c.req.param("id")),
        parse(ownershipFinishSchema, await c.req.json().catch(() => null)),
      ),
    }),
  );
  router.post("/workspace/ownership/:id/cancel", async (c) =>
    c.json({
      transfer: await service.cancel(
        requireHumanAccess(c.get("humanAccess")),
        parse(z.uuid(), c.req.param("id")),
        parse(ownershipCancelSchema, await c.req.json().catch(() => null)),
      ),
    }),
  );
  return router;
}
