import { Hono } from "hono";
import { z } from "zod";
import type { OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import { DomainError } from "../domain/index.js";
import {
  createOwnerWorkspaceInvitationSchema,
  OwnerWorkspaceInvitationService,
} from "../owner-invitations.js";

type Bindings = {
  Variables: {
    ownerSession: OwnerSession;
  };
};

function identifier(value: string) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success)
    throw new DomainError("invalid", "Invalid Owner invitation identifier");
  return parsed.data;
}

export function createOwnerInvitationRouter({
  db,
  baseUrl,
}: {
  db: Database;
  baseUrl: string;
}) {
  const router = new Hono<Bindings>();
  const invitations = new OwnerWorkspaceInvitationService(db);
  const response = <T extends { invitation: unknown; token: string }>(
    result: T,
  ) => {
    const inviteUrl = new URL(
      `/owner-invite/${result.token}`,
      baseUrl,
    ).toString();
    const { token: _token, ...safe } = result;
    return { ...safe, inviteUrl };
  };

  router.get("/owner-invitations", async (context) =>
    context.json(await invitations.list(context.get("ownerSession").user.id)),
  );

  router.post("/owner-invitations", async (context) => {
    const input = createOwnerWorkspaceInvitationSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!input.success)
      throw new DomainError(
        "invalid",
        "Invalid Owner invitation",
        input.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    return context.json(
      response(
        await invitations.create(
          context.get("ownerSession").user.id,
          input.data,
        ),
      ),
      201,
    );
  });

  router.post("/owner-invitations/:invitationId/resend", async (context) =>
    context.json(
      response(
        await invitations.resend(
          context.get("ownerSession").user.id,
          identifier(context.req.param("invitationId")),
        ),
      ),
    ),
  );

  router.post("/owner-invitations/:invitationId/revoke", async (context) =>
    context.json(
      await invitations.revoke(
        context.get("ownerSession").user.id,
        identifier(context.req.param("invitationId")),
      ),
    ),
  );

  return router;
}
