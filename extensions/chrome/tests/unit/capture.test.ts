import { describe, expect, it } from "vitest";
import { captureRequestSchema, pixelRect } from "../../lib/capture";

describe("capture geometry", () => {
  it.each([0.8, 1, 1.25, 1.5, 2, 3])(
    "maps CSS area to pixel bounds at scale %s",
    (scale) => {
      const result = pixelRect(
        { x: 10.2, y: 20.4, width: 80.6, height: 60.3 },
        scale,
        1200,
        800,
      );
      expect(result.x).toBe(Math.floor(10.2 * scale));
      expect(result.y).toBe(Math.floor(20.4 * scale));
      expect(result.x + result.width).toBe(Math.ceil(90.8 * scale));
      expect(result.y + result.height).toBe(Math.ceil((20.4 + 60.3) * scale));
    },
  );
  it("clips out-of-bounds rectangles without a zero-size canvas", () => {
    expect(
      pixelRect({ x: 90, y: 70, width: 50, height: 50 }, 1, 100, 80),
    ).toEqual({ x: 90, y: 70, width: 10, height: 10 });
    expect(
      pixelRect({ x: -10, y: -10, width: 30, height: 30 }, 1, 100, 80),
    ).toEqual({ x: 0, y: 0, width: 20, height: 20 });
  });
  it("rejects arbitrary targets and automatic or unimplemented modes", () => {
    expect(
      captureRequestSchema.safeParse({
        version: 1,
        type: "capture",
        mode: "crop",
      }).success,
    ).toBe(true);
    for (const extra of [
      { tabId: 12 },
      { url: "https://other.test" },
      { mode: "automatic" },
    ])
      expect(
        captureRequestSchema.safeParse({
          version: 1,
          type: "capture",
          mode: "crop",
          ...extra,
        }).success,
      ).toBe(false);
  });
});
