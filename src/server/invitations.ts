import type { z } from "zod";
import type { Database } from "./db/client.js";
import type { MailConfig } from "./mail-config.js";
import { invitationAuthPlugin } from "./member-invitations/auth-plugin.js";
import {
  createInvitationSchema,
  type InvitationActor,
  memberVersionSchema,
  updateMemberSchema,
} from "./member-invitations/contracts.js";
import { InvitationLifecycleService } from "./member-invitations/lifecycle.js";
import { MemberAccessService } from "./member-invitations/members.js";

export {
  createInvitationSchema,
  type InvitationActor,
  invitationAuthPlugin,
  memberVersionSchema,
  updateMemberSchema,
};

export class InvitationService {
  private readonly invitations: InvitationLifecycleService;
  private readonly members: MemberAccessService;

  constructor(db: Database, mail: MailConfig | null = null) {
    this.invitations = new InvitationLifecycleService(db, mail);
    this.members = new MemberAccessService(db);
  }

  inspect(rawToken: string) {
    return this.invitations.inspect(rawToken);
  }

  list(actor: InvitationActor) {
    return this.invitations.list(actor);
  }

  create(
    actor: InvitationActor,
    input: z.infer<typeof createInvitationSchema>,
  ) {
    return this.invitations.create(actor, input);
  }

  resend(
    actor: InvitationActor,
    invitationId: string,
    mode: "manual" | "email" = "manual",
  ) {
    return this.invitations.resend(actor, invitationId, mode);
  }

  revoke(actor: InvitationActor, invitationId: string) {
    return this.invitations.revoke(actor, invitationId);
  }

  updateMember(
    actor: InvitationActor,
    userId: string,
    input: z.infer<typeof updateMemberSchema>,
  ) {
    return this.members.update(actor, userId, input);
  }

  removeMember(
    actor: InvitationActor,
    userId: string,
    expectedVersion?: string,
  ) {
    return this.members.remove(actor, userId, expectedVersion);
  }
}
