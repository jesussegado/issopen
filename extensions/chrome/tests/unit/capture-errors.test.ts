import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  get: vi.fn(),
  executeScript: vi.fn(),
  screenshot: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));
vi.mock("wxt/browser", () => ({
  browser: {
    tabs: {
      query: mocks.query,
      get: mocks.get,
      captureVisibleTab: mocks.screenshot,
      onActivated: {
        addListener: mocks.addListener,
        removeListener: mocks.removeListener,
      },
      onUpdated: {
        addListener: mocks.addListener,
        removeListener: mocks.removeListener,
      },
    },
    scripting: { executeScript: mocks.executeScript },
  },
}));

import { capture, captureResponseSchema } from "../../lib/capture";
import {
  captureErrorCodeSchema,
  captureFailure,
  captureProblems,
} from "../../lib/capture-errors";
import {
  prepareCapturePage,
  restoreCapturePage,
  scrollCapturePage,
  selectCaptureArea,
  validCapturePage,
} from "../../lib/capture-page";

const tab = {
  id: 7,
  windowId: 3,
  active: true,
  incognito: false,
  url: "https://example.test/review",
};
const dimensions = {
  width: 1200,
  height: 800,
  scrollHeight: 1600,
  scrollWidth: 1200,
  origin: "https://example.test",
  y: 0,
  dpr: 1,
};
let status:
  | "ready"
  | "content-changed"
  | "viewport-changed"
  | "page-unavailable";
let prepared: unknown;
let afterScroll: unknown;
beforeEach(() => {
  vi.resetAllMocks();
  status = "ready";
  prepared = dimensions;
  afterScroll = dimensions;
  mocks.query.mockResolvedValue([tab]);
  mocks.get.mockResolvedValue(tab);
  mocks.executeScript.mockImplementation(async ({ func }) => {
    if (func === prepareCapturePage) return [{ result: prepared }];
    if (func === validCapturePage) return [{ result: status }];
    if (func === scrollCapturePage) return [{ result: afterScroll }];
    if (func === selectCaptureArea) return [{ result: null }];
    if (func === restoreCapturePage) return [];
    return [{ documentId: "document-fixture", result: true }];
  });
  mocks.screenshot.mockRejectedValue(
    new Error(
      "PRIVATE-BROWSER-DETAIL https://example.test/private?secret=decoy",
    ),
  );
});

describe("actionable and private capture failures", () => {
  it.each(captureErrorCodeSchema.options)(
    "returns a bounded safe contract and recovery steps for %s",
    (code) => {
      expect(captureResponseSchema.parse(captureFailure(code)).ok).toBe(false);
      expect(captureProblems[code].title.length).toBeGreaterThan(10);
      expect(captureProblems[code].steps.length).toBeGreaterThan(0);
    },
  );
  it("allows legacy errors without inventing a structured cause", () => {
    expect(
      captureResponseSchema.parse({
        ok: false,
        message: "Old generic message",
      }),
    ).not.toHaveProperty("code");
    expect(
      captureResponseSchema.safeParse({
        ok: false,
        message: "x",
        code: "PRIVATE-BROWSER-DETAIL",
      }).success,
    ).toBe(false);
  });
  it.each([
    [[], "no-tab"],
    [[{ id: 7 }], "page-access"],
    [[{ ...tab, incognito: true }], "unsupported-page"],
    [[{ ...tab, url: "chrome://settings" }], "unsupported-page"],
    [[{ ...tab, url: "https://example.test/sign-in" }], "protected-page"],
  ] as const)(
    "classifies an inaccessible target before reading it: %j",
    async (tabs, code) => {
      mocks.query.mockResolvedValue(tabs);
      expect(await capture("viewport")).toEqual(captureFailure(code));
      expect(mocks.executeScript).not.toHaveBeenCalled();
    },
  );
  it("explains access failure without exposing or parsing the browser exception", async () => {
    mocks.executeScript.mockRejectedValueOnce(
      new Error("PRIVATE-BROWSER-DETAIL"),
    );
    expect(await capture("viewport")).toEqual(captureFailure("page-access"));
    expect(mocks.screenshot).not.toHaveBeenCalled();
  });
  it.each(["content-changed", "viewport-changed", "page-unavailable"] as const)(
    "reports %s and restores the original page",
    async (reason) => {
      status = reason;
      expect(await capture("viewport")).toEqual(captureFailure(reason));
      expect(mocks.screenshot).not.toHaveBeenCalled();
      expect(mocks.executeScript).toHaveBeenLastCalledWith({
        target: { tabId: 7, documentIds: ["document-fixture"] },
        func: restoreCapturePage,
      });
      expect(mocks.removeListener).toHaveBeenCalledTimes(2);
    },
  );
  it("distinguishes a page update from a window resize during full capture", async () => {
    afterScroll = { ...dimensions, scrollHeight: 1700 };
    expect(await capture("full")).toEqual(captureFailure("content-changed"));
    afterScroll = { ...dimensions, width: 900 };
    expect(await capture("full")).toEqual(captureFailure("viewport-changed"));
  });
  it("explains navigation instead of suggesting recrop", async () => {
    mocks.get.mockResolvedValue({
      ...tab,
      url: "https://example.test/elsewhere",
    });
    expect(await capture("viewport")).toEqual(captureFailure("page-changed"));
  });
  it("keeps safe capture limits explicit", async () => {
    prepared = { error: "page-too-complex" };
    expect(await capture("viewport")).toEqual(
      captureFailure("page-too-complex"),
    );
    prepared = { ...dimensions, scrollHeight: 17000 };
    expect(await capture("full")).toEqual(captureFailure("full-page-limit"));
    expect(mocks.screenshot).not.toHaveBeenCalled();
  });
  it("does not turn cancellation into a permission or connection failure", async () => {
    expect(await capture("crop")).toEqual(
      captureFailure("selection-cancelled"),
    );
  });
  it("keeps an unknown screenshot failure honest and private", async () => {
    const result = await capture("viewport");
    expect(result).toEqual(captureFailure("capture-failed"));
    expect(JSON.stringify(result)).not.toContain("PRIVATE-");
    expect(JSON.stringify(result)).not.toContain("https:");
  });
});
