import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export type InvitationStateSource = {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
  claimedAt: Date | null;
};

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function maskInvitationEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

export function invitationState(
  invitation: InvitationStateSource,
  now = new Date(),
) {
  if (invitation.acceptedAt) return "accepted" as const;
  if (invitation.revokedAt) return "revoked" as const;
  if (invitation.expiresAt.getTime() <= now.getTime())
    return "expired" as const;
  if (invitation.claimedAt) return "claimed" as const;
  return "pending" as const;
}
