import { Hono } from "hono";
import { z } from "zod";
import type { OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import {
  type HumanAccess,
  requireHumanAccess,
  requireWorkspaceOwner,
} from "../human-access.js";
import {
  createInvitationSchema,
  InvitationService,
  memberVersionSchema,
  updateMemberSchema,
} from "../invitations.js";
import type { MailConfig } from "../mail-config.js";
import {
  parseHttpInput,
  parseIdentifier,
  parseJsonBody,
  readJsonInput,
} from "./validation.js";

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

const invitationDeliverySchema = z
  .object({ delivery: z.enum(["manual", "email"]).optional() })
  .strict();

export function createInvitationRouter({
  db,
  baseUrl,
  mail = null,
}: {
  db: Database;
  baseUrl: string;
  mail?: MailConfig | null;
}) {
  const router = new Hono<InvitationBindings>();
  const invitations = new InvitationService(db, mail);
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
    const input = parseHttpInput(
      createInvitationSchema,
      await readJsonInput(context),
      { message: "Invalid invitation", fallbackField: "" },
    );
    return context.json(
      response(
        await invitations.create(owner(context.get("humanAccess")), input),
      ),
      201,
    );
  });

  router.post("/invitations/:invitationId/resend", async (context) => {
    const input = await parseJsonBody(context, invitationDeliverySchema, {
      emptyValue: {},
      message: "Invalid invitation delivery request",
      malformedMessage: "Invalid invitation delivery request",
      fields: false,
    });
    const invitationId = parseIdentifier(
      context.req.param("invitationId"),
      "invitationId",
    );
    return context.json(
      response(
        await invitations.resend(
          owner(context.get("humanAccess")),
          invitationId,
          input.delivery,
        ),
      ),
    );
  });

  router.post("/invitations/:invitationId/revoke", async (context) => {
    const invitationId = parseIdentifier(
      context.req.param("invitationId"),
      "invitationId",
    );
    return context.json(
      await invitations.revoke(owner(context.get("humanAccess")), invitationId),
    );
  });

  router.delete("/members/:userId", async (context) => {
    const actor = owner(context.get("humanAccess"));
    const userId = parseIdentifier(context.req.param("userId"), "userId");
    const input = parseHttpInput(
      memberVersionSchema,
      await readJsonInput(context),
      {
        message:
          "Reload members before removing access: a current version is required.",
        fields: false,
      },
    );
    return context.json(
      await invitations.removeMember(actor, userId, input.expectedVersion),
    );
  });

  router.patch("/members/:userId", async (context) => {
    const actor = owner(context.get("humanAccess"));
    const userId = parseIdentifier(context.req.param("userId"), "userId");
    const input = parseHttpInput(
      updateMemberSchema,
      await readJsonInput(context),
      {
        message: "Invalid member permissions or version",
        fields: false,
      },
    );
    return context.json(await invitations.updateMember(actor, userId, input));
  });

  return router;
}
