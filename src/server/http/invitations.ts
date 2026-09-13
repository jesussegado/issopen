import { Hono } from "hono";
import { z } from "zod";
import type { OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import { DomainError } from "../domain/index.js";
import {
  type HumanAccess,
  requireHumanAccess,
  requireWorkspaceOwner,
} from "../human-access.js";
import { createInvitationSchema, InvitationService } from "../invitations.js";

type InvitationBindings = {
  Variables: {
    ownerSession: OwnerSession;
    humanAccess: HumanAccess | null;
  };
};

function owner(context: HumanAccess | null) {
  const access = requireHumanAccess(context);
  requireWorkspaceOwner(access);
  return { workspaceId: access.workspaceId, userId: access.user.id };
}

function identifier(value: string, field: string) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) {
    throw new DomainError("invalid", "Invalid request", [
      { field, message: "Must be a valid identifier" },
    ]);
  }
  return parsed.data;
}

export function createInvitationRouter({
  db,
  baseUrl,
}: {
  db: Database;
  baseUrl: string;
}) {
  const router = new Hono<InvitationBindings>();
  const invitations = new InvitationService(db);
  const response = <T extends { invitation: unknown; token: string }>(
    result: T,
  ) => {
    const url = new URL(`/invite/${result.token}`, baseUrl).toString();
    const { token: _token, ...safe } = result;
    return { ...safe, inviteUrl: url };
  };

  router.get("/members", async (context) =>
    context.json(await invitations.list(owner(context.get("humanAccess")))),
  );

  router.post("/invitations", async (context) => {
    const input = createInvitationSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!input.success) {
      throw new DomainError(
        "invalid",
        "Invalid invitation",
        input.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    }
    return context.json(
      response(
        await invitations.create(owner(context.get("humanAccess")), input.data),
      ),
      201,
    );
  });

  router.post("/invitations/:invitationId/resend", async (context) => {
    const invitationId = identifier(
      context.req.param("invitationId"),
      "invitationId",
    );
    return context.json(
      response(
        await invitations.resend(
          owner(context.get("humanAccess")),
          invitationId,
        ),
      ),
    );
  });

  router.post("/invitations/:invitationId/revoke", async (context) => {
    const invitationId = identifier(
      context.req.param("invitationId"),
      "invitationId",
    );
    return context.json(
      await invitations.revoke(owner(context.get("humanAccess")), invitationId),
    );
  });

  router.delete("/members/:userId", async (context) => {
    const userId = identifier(context.req.param("userId"), "userId");
    return context.json(
      await invitations.removeMember(owner(context.get("humanAccess")), userId),
    );
  });

  return router;
}
