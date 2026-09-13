import { describe, expect, it } from "vitest";
import { isPanelSender } from "../../lib/protocol";

describe("internal message boundary", () => {
  it("accepts the exact own panel, not content scripts or other extensions", () => {
    const url = "chrome-extension://abc/sidepanel.html";
    expect(isPanelSender({ id: "abc", url }, "abc", url)).toBe(true);
    for (const sender of [
      { id: "abc", url, tab: { id: 1 } },
      { id: "other", url },
      { id: "abc", url: "https://example.test" },
      { id: "abc", url: `${url}?command=inspect` },
      {},
    ])
      expect(isPanelSender(sender, "abc", url)).toBe(false);
  });
});
