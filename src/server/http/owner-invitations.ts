import { Hono } from "hono";
import type { OwnerSession } from "../auth.js";
import type { Database } from "../db/client.js";
import {
  createOwnerWorkspaceInvitationSchema,
  OwnerWorkspaceInvitationService,
} from "../owner-invitations.js";
import {
  parseHttpInput,
  parseIdentifier,
  readJsonInput,
} from "./validation.js";

type Bindings = {
  Variables: {
    ownerSession: OwnerSession;
  };
};

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
    const input = parseHttpInput(
      createOwnerWorkspaceInvitationSchema,
      await readJsonInput(context),
      { message: "Invalid Owner invitation", fallbackField: "" },
    );
    return context.json(
      response(
        await invitations.create(context.get("ownerSession").user.id, input),
      ),
      201,
    );
  });

  router.post("/owner-invitations/:invitationId/resend", async (context) =>
    context.json(
      response(
        await invitations.resend(
          context.get("ownerSession").user.id,
          parseIdentifier(context.req.param("invitationId"), "invitationId", {
            message: "Invalid Owner invitation identifier",
            fields: false,
          }),
        ),
      ),
    ),
  );

  router.post("/owner-invitations/:invitationId/revoke", async (context) =>
    context.json(
      await invitations.revoke(
        context.get("ownerSession").user.id,
        parseIdentifier(context.req.param("invitationId"), "invitationId", {
          message: "Invalid Owner invitation identifier",
          fields: false,
        }),
      ),
    ),
  );

  return router;
}
