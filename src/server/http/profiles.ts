import { Hono } from "hono";
import { updateProfileSchema } from "../../shared/profile-contract.js";
import type { OwnerSession } from "../auth.js";
import { boundedJson } from "../capture-api.js";
import { CaptureError } from "../capture-storage.js";
import type { Database } from "../db/client.js";
import { DomainError } from "../domain/index.js";
import { type HumanAccess, requireHumanAccess } from "../human-access.js";
import { CollaboratorService, ProfileService } from "../profiles.js";

export function createProfileRouter(db: Database) {
  const router = new Hono<{
    Variables: { ownerSession: OwnerSession; humanAccess: HumanAccess | null };
  }>();
  const profiles = new ProfileService(db),
    people = new CollaboratorService(db);
  router.get("/account/profile", async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({
      profile: await profiles.get(c.get("ownerSession").user.id),
    });
  });
  router.patch("/account/profile", async (c) => {
    c.header("Cache-Control", "no-store");
    let input: unknown;
    try {
      input = await boundedJson(c.req.raw, 135_000);
    } catch (error) {
      if (error instanceof CaptureError)
        return c.json(
          {
            error:
              error.code === "size"
                ? "Profile request is too large. Prepare a smaller avatar."
                : "Invalid profile JSON.",
          },
          error.status,
        );
      throw error;
    }
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success)
      throw new DomainError(
        "invalid",
        "Use a display name of 1–120 characters and a valid prepared avatar. Reload to obtain a current profile version.",
      );
    return c.json({
      profile: await profiles.update(
        c.get("ownerSession").user.id,
        parsed.data,
      ),
    });
  });
  router.get("/projects/:projectId/collaborators", async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(
      await people.list(
        requireHumanAccess(c.get("humanAccess")),
        c.req.param("projectId"),
        c.req.query(),
      ),
    );
  });
  router.get("/projects/:projectId/collaborators/:userId/avatar", async (c) => {
    const bytes = await people.avatar(
      requireHumanAccess(c.get("humanAccess")),
      c.req.param("projectId"),
      c.req.param("userId"),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": 'inline; filename="avatar.png"',
      },
    });
  });
  return router;
}
