import { Hono } from "hono";
import type { OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import { type HumanAccess, requireHumanAccess } from "../human-access.js";
import {
  OwnershipService,
  ownershipCancelSchema,
  ownershipFinishSchema,
  ownershipPeopleSchema,
  ownershipStartSchema,
} from "../ownership.js";
import {
  parseHttpInput,
  parseIdentifier,
  readJsonInput,
} from "./validation.js";

const ownershipValidation = {
  message:
    "Invalid ownership request. Refresh and review all confirmation fields.",
  fields: false as const,
};

export function createOwnershipRouter(db: Database) {
  const router = new Hono<{
    Variables: { ownerSession: OwnerSession; humanAccess: HumanAccess | null };
  }>();
  const service = new OwnershipService(db);
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
        parseHttpInput(
          ownershipPeopleSchema,
          c.req.query(),
          ownershipValidation,
        ),
      ),
    ),
  );
  router.post("/workspace/ownership", async (c) =>
    c.json({
      transfer: await service.propose(
        requireHumanAccess(c.get("humanAccess")),
        c.get("ownerSession"),
        parseHttpInput(
          ownershipStartSchema,
          await readJsonInput(c),
          ownershipValidation,
        ),
      ),
    }),
  );
  router.post("/workspace/ownership/:id/accept", async (c) =>
    c.json({
      transfer: await service.accept(
        requireHumanAccess(c.get("humanAccess")),
        c.get("ownerSession"),
        parseIdentifier(c.req.param("id"), "id", ownershipValidation),
        parseHttpInput(
          ownershipFinishSchema,
          await readJsonInput(c),
          ownershipValidation,
        ),
      ),
    }),
  );
  router.post("/workspace/ownership/:id/cancel", async (c) =>
    c.json({
      transfer: await service.cancel(
        requireHumanAccess(c.get("humanAccess")),
        parseIdentifier(c.req.param("id"), "id", ownershipValidation),
        parseHttpInput(
          ownershipCancelSchema,
          await readJsonInput(c),
          ownershipValidation,
        ),
      ),
    }),
  );
  return router;
}
