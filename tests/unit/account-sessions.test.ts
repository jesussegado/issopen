import { describe, expect, it } from "vitest";
import { sessionDeviceLabel } from "../../src/server/http/account.js";

describe("safe session device labels", () => {
  it.each([
    [null, "Browser · unknown device"],
    ["<script>alert(secret)</script>", "Browser · unknown device"],
    ["Mozilla Windows Chrome/152 Safari/537", "Chrome · Windows"],
    ["Mozilla Macintosh Safari/600", "Safari · macOS"],
    ["Mozilla Android Chrome/152", "Chrome · Android"],
    ["Mozilla Linux Firefox/140", "Firefox · Linux"],
    ["Mozilla Windows Chrome/152 Edg/152", "Edge · Windows"],
    ["Mozilla iPhone Safari/600", "Safari · iOS"],
  ])("minimizes %s", (input, expected) => {
    expect(sessionDeviceLabel(input)).toBe(expected);
  });
});
