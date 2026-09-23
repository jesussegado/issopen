import { z } from "zod";

export const createInvitationSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
    projectIds: z.array(z.uuid()).min(1).max(100),
    delivery: z.enum(["manual", "email"]).optional(),
  })
  .strict();

export const memberVersionSchema = z
  .object({ expectedVersion: z.uuid() })
  .strict();

export const updateMemberSchema = memberVersionSchema.extend({
  grants: z
    .array(
      z
        .object({ projectId: z.uuid(), permission: z.enum(["read", "edit"]) })
        .strict(),
    )
    .max(100),
});

export type InvitationActor = {
  workspaceId: string;
  userId: string;
};
