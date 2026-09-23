import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createInvitationToken,
  hashInvitationToken,
  invitationLifetimeMs,
  invitationState,
  invitationTokenSchema,
  maskInvitationEmail,
  normalizeInvitationEmail,
} from "../../src/server/invitation-primitives.js";

describe("invitation primitives", () => {
  it("normalizes and masks the same email without exposing its local part", () => {
    const email = normalizeInvitationEmail("  INVITED.Person@Example.TEST  ");

    expect(email).toBe("invited.person@example.test");
    expect(maskInvitationEmail(email)).toBe("in************@example.test");
    expect(maskInvitationEmail("a@example.test")).toBe("a**@example.test");
  });

  it("creates a valid 256-bit bearer token and hashes it deterministically", () => {
    const token = createInvitationToken();

    expect(invitationTokenSchema.parse(token)).toBe(token);
    expect(token).toHaveLength(43);
    expect(hashInvitationToken(token)).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(hashInvitationToken(token)).not.toContain(token);
    expect(invitationLifetimeMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("keeps lifecycle precedence stable for used, revoked, expired and claimed links", () => {
    const now = new Date("2026-09-23T12:00:00.000Z");
    const pending = {
      acceptedAt: null,
      revokedAt: null,
      expiresAt: new Date("2026-09-24T12:00:00.000Z"),
      claimedAt: null,
    };

    expect(invitationState(pending, now)).toBe("pending");
    expect(invitationState({ ...pending, claimedAt: new Date(now) }, now)).toBe(
      "claimed",
    );
    expect(invitationState({ ...pending, expiresAt: new Date(now) }, now)).toBe(
      "expired",
    );
    expect(
      invitationState(
        {
          ...pending,
          revokedAt: new Date(now),
          expiresAt: new Date(now),
        },
        now,
      ),
    ).toBe("revoked");
    expect(
      invitationState(
        {
          ...pending,
          acceptedAt: new Date(now),
          revokedAt: new Date(now),
        },
        now,
      ),
    ).toBe("accepted");
  });

  it("rejects malformed and non-canonical invitation tokens", () => {
    for (const token of [
      "",
      "short",
      "a".repeat(42),
      "a".repeat(44),
      `${"a".repeat(42)}+`,
    ]) {
      expect(invitationTokenSchema.safeParse(token).success).toBe(false);
    }
  });
});
