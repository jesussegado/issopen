import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = readFileSync("src/web/styles.css", "utf8");
const css = [
  manifest,
  ...[...manifest.matchAll(/@import\s+["']\.\/styles\/([^"']+)["'];/g)].map(
    (match) => readFileSync(`src/web/styles/${match[1]}`, "utf8"),
  ),
].join("\n");
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map((match) => [
    match[1],
    match[2]?.trim(),
  ]),
);

function color(name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`Undefined color token: ${name}`);
  const alias = value.match(/^var\(--color-([\w-]+)\)$/)?.[1];
  return alias ? color(alias) : value;
}

function luminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/../g)
    ?.map((channel) => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  if (channels?.length !== 3) throw new Error(`Invalid RGB: ${hex}`);
  return channels.reduce(
    (sum, value, index) => sum + value * ([0.2126, 0.7152, 0.0722][index] ?? 0),
    0,
  );
}

function contrast(foreground: string, background: string) {
  const a = luminance(color(foreground));
  const b = luminance(color(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("brand palette accessibility", () => {
  it("resolves every color used by the interface without a browser fallback", () => {
    for (const match of css.matchAll(/var\(--color-([\w-]+)\)/g)) {
      expect(color(match[1] ?? "")).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("keeps normal text readable across brand and semantic states", () => {
    const pairs: ReadonlyArray<readonly [string, string]> = [
      ...["app", "surface", "subtle", "accent-soft", "disabled"].flatMap(
        (background) => [
          ["text", background] as const,
          ["muted", background] as const,
        ],
      ),
      ["on-accent", "accent"],
      ["on-accent", "accent-hover"],
      ["on-accent", "accent-active"],
      ["accent", "surface"],
      ["accent", "accent-soft"],
      ["accent-active", "brand-mint"],
      ["text", "brand-mint"],
      ["destructive", "destructive-soft"],
      ["warning", "warning-soft"],
    ];
    for (const [foreground, background] of pairs) {
      expect(
        contrast(foreground, background),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps control boundaries and focus visible on supported surfaces", () => {
    for (const background of ["surface", "app", "subtle", "accent-soft"]) {
      expect(contrast("control-border", background)).toBeGreaterThanOrEqual(3);
      expect(contrast("focus", background)).toBeGreaterThanOrEqual(3);
    }
    expect(contrast("focus", "brand-mint")).toBeGreaterThanOrEqual(3);
  });
});
