import { Hono } from "hono";
import { AccessAuditService } from "../access-audit.js";
import type { Database } from "../db/client.js";
import { type HumanAccess, requireHumanAccess } from "../human-access.js";
export function createAccessAuditRouter(db: Database) {
  const router = new Hono<{ Variables: { humanAccess: HumanAccess | null } }>();
  const audit = new AccessAuditService(db);
  router.get("/workspace/audit", async (c) =>
    c.json(
      await audit.list(requireHumanAccess(c.get("humanAccess")), c.req.query()),
    ),
  );
  return router;
}
