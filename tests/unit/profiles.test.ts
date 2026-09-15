import { expect, it } from "vitest";
import { normalizeAvatar } from "../../src/server/profiles.js";
import {
  displayNameSchema,
  updateProfileSchema,
} from "../../src/shared/profile-contract.js";
import { pngChunk, syntheticPng } from "../fixtures/png.js";

it("bounds names without changing login fields or accepting markup/control characters", () => {
  expect(displayNameSchema.parse("  Ana García  ")).toBe("Ana García");
  for (const name of [
    "",
    " ",
    "x".repeat(121),
    "<img src=x>",
    "Ana\nOwner",
    "Ana\u202eOwner",
  ])
    expect(displayNameSchema.safeParse(name).success).toBe(false);
  expect(
    updateProfileSchema.safeParse({
      expectedVersion: null,
      name: "Ada",
      avatarPng: null,
      email: "evil@example.test",
    }).success,
  ).toBe(false);
});
it("validates and strips local avatar metadata without fetching URLs", async () => {
  const data = (buffer: Buffer) =>
    `data:image/png;base64,${buffer.toString("base64")}`;
  expect(await normalizeAvatar(null)).toBeNull();
  expect(await normalizeAvatar(data(syntheticPng(true)))).toBe(
    data(syntheticPng()),
  );
  const header = Buffer.from(syntheticPng().subarray(16, 29));
  header.writeUInt32BE(99999);
  const oversized = Buffer.concat([
    syntheticPng().subarray(0, 8),
    pngChunk("IHDR", header),
    syntheticPng().subarray(33),
  ]);
  for (const image of [
    "https://internal.example/avatar",
    "data:image/svg+xml,<svg/>",
    data(oversized),
    data(Buffer.concat([syntheticPng(), Buffer.from("tail")])),
    data(Buffer.alloc(98305)),
  ])
    await expect(normalizeAvatar(image)).rejects.toThrow(
      "valid local PNG avatar",
    );
});
