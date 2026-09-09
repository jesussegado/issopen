import { describe, expect, it } from "vitest";
import {
  inspectableOrigin,
  inspectRequestSchema,
  inspectResponseSchema,
  isPanelSender,
  pageContextSchema,
} from "../../lib/protocol";

describe("page context privacy boundary", () => {
  it("only retains origin, not path, query, fragment or title", () => {
    expect(
      inspectableOrigin("https://example.test/private?session=sample#private"),
    ).toBe("https://example.test");
    expect(inspectableOrigin("http://localhost:8080/path")).toBe(
      "http://localhost:8080",
    );
  });
  it.each([
    "chrome://settings",
    "chrome-extension://abc/page.html",
    "about:blank",
    "file:///private",
    "javascript:alert(1)",
    "data:text/html,hello",
    "https://chromewebstore.google.com/detail/abc",
    "https://chrome.google.com/webstore/detail/abc",
    "https://CHROMEWEBSTORE.GOOGLE.COM./detail/abc",
    "https://microsoftedge.microsoft.com/addons",
    "not a URL",
  ])("rejects restricted/credential-bearing URLs: %s", (url) =>
    expect(inspectableOrigin(url)).toBeNull(),
  );
  it("rejects a URL containing synthetic userinfo", () => {
    const url = new URL("https://example.test");
    url.username = "fixture-user";
    url.password = "fixture-not-a-secret";
    expect(inspectableOrigin(url.href)).toBeNull();
  });
  const valid = {
    origin: "https://example.test",
    viewport: { width: 1200, height: 800, devicePixelRatio: 2 },
  };
  it("accepts a bounded context", () =>
    expect(pageContextSchema.parse(valid)).toEqual(valid));
  it("rejects hidden context fields and non-origin URLs", () => {
    for (const input of [
      { ...valid, title: "private" },
      { ...valid, dom: "private" },
      { ...valid, origin: "https://example.test/path" },
      { ...valid, viewport: { ...valid.viewport, devicePixelRatio: Infinity } },
      { ...valid, viewport: { ...valid.viewport, width: -1 } },
    ]) {
      expect(pageContextSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe("internal message boundary", () => {
  it("accepts only the current command without arbitrary targets", () => {
    expect(
      inspectRequestSchema.safeParse({ version: 1, type: "inspect-active-tab" })
        .success,
    ).toBe(true);
    for (const input of [
      null,
      {},
      { version: 2, type: "inspect-active-tab" },
      { version: 1, type: "inspect-active-tab", tabId: 123 },
    ])
      expect(inspectRequestSchema.safeParse(input).success).toBe(false);
  });
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
  it("does not allow raw browser errors containing private URLs", () => {
    expect(
      inspectResponseSchema.safeParse({
        ok: false,
        code: "permission-required",
      }).success,
    ).toBe(true);
    expect(
      inspectResponseSchema.safeParse({
        ok: false,
        code: "https://private.test",
      }).success,
    ).toBe(false);
    expect(
      inspectResponseSchema.safeParse({
        ok: false,
        code: "unavailable",
        error: "private",
      }).success,
    ).toBe(false);
  });
});
