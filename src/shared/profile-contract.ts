import { z } from "zod";

export const avatarSide = 128;
export const avatarMaximumBytes = 96 * 1024;
export const avatarMaximumEncoded = Math.ceil(avatarMaximumBytes / 3) * 4 + 22;
export const displayNameSchema = z
  .string()
  .transform((value) => value.normalize("NFC").trim())
  .pipe(
    z
      .string()
      .min(1)
      .max(120)
      .refine(
        (value) => !/[\p{Cc}\p{Cf}<>]/u.test(value),
        "Use a plain display name without markup or control characters",
      ),
  );
export const updateProfileSchema = z
  .object({
    expectedVersion: z.uuid().nullable(),
    name: displayNameSchema,
    avatarPng: z.string().max(avatarMaximumEncoded).nullable(),
  })
  .strict();
export type PersonalProfile = {
  name: string;
  version: string | null;
  avatarPng: string | null;
};
export type Collaborator = {
  id: string;
  name: string;
  role: "owner" | "member";
  permission: "read" | "edit";
  avatarUrl: string | null;
};
export type CollaboratorsPage = {
  collaborators: Collaborator[];
  nextCursor: string | null;
};
