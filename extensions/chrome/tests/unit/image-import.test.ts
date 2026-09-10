import { describe, expect, it } from "vitest";
import {
  captureSubmissionSchema,
  imagesSchema,
  maximumPngBytes,
  pngBytes,
} from "../../../../src/shared/capture-contract";
import { pngChunk, syntheticPng } from "../../../../tests/fixtures/png";
import { draftLifetime, validDraft } from "../../lib/draft";
import { imageDimensions, importImage } from "../../lib/image-import";

const png = `data:image/png;base64,${syntheticPng().toString("base64")}`;
describe("external image boundaries", () => {
  it("sniffs dimensions without decoding or trusting a filename/MIME", () => {
    expect(imageDimensions(syntheticPng(true))).toEqual({
      width: 2,
      height: 1,
      type: "image/png",
    });
    for (const value of [
      Buffer.from("<svg/>"),
      Buffer.from("GIF89a"),
      Buffer.from([255, 216, 255, 192, 255, 255]),
      Buffer.alloc(0),
    ])
      expect(() => imageDimensions(value)).toThrow();
    const huge = syntheticPng();
    huge.writeUInt32BE(100000, 16);
    huge.writeUInt32BE(100000, 20);
    expect(() => imageDimensions(huge)).toThrow(/32 megapíxeles/);
    const animated = Buffer.concat([
      syntheticPng().subarray(0, 33),
      pngChunk("acTL", Buffer.alloc(8)),
      syntheticPng().subarray(33),
    ]);
    expect(() => imageDimensions(animated)).toThrow(/animaciones/);
  });
  it("rejects oversized files and aggregate payloads before decoding", async () => {
    await expect(
      importImage(new Blob([new Uint8Array(maximumPngBytes + 1)])),
    ).rejects.toThrow(/8 MiB/);
    const large = `data:image/png;base64,${"A".repeat(6 * 1024 * 1024)}`;
    expect(imagesSchema.safeParse([large, large]).success).toBe(false);
    expect(
      imagesSchema.safeParse(Array.from({ length: 6 }, () => png)).success,
    ).toBe(false);
    expect(pngBytes(png)).toBe(syntheticPng().length);
  });
  it("keeps legacy pending requests intact and restores multiple-image drafts", () => {
    const pending = {
      version: 1,
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      projectId: "22222222-2222-4222-8222-222222222222",
      epicId: null,
      title: "Legacy",
      description: "",
      priority: "medium",
      status: "backlog",
      metadata: null,
      image: png,
    };
    expect(captureSubmissionSchema.parse(pending)).toEqual(pending);
    expect(
      captureSubmissionSchema.safeParse({ ...pending, images: [png] }).success,
    ).toBe(false);
    const now = 10000;
    const draft = {
      version: 1,
      expiresAt: now + draftLifetime,
      owner: null,
      form: {
        projectId: pending.projectId,
        epicId: "",
        title: "Images",
        description: "",
        priority: "medium",
        status: "backlog",
      },
      evidence: { image: null, metadata: null, images: [png, png] },
      pending: { ...pending, image: null, images: [png, png] },
      inline: null,
    };
    expect(validDraft(draft, now)).toEqual(draft);
    expect(validDraft(draft, now + draftLifetime)).toBeNull();
  });
});
