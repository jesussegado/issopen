import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  get: vi.fn(),
  executeScript: vi.fn(),
  addListener: vi.fn(),
  setPanelBehavior: vi.fn(),
  actionListener: vi.fn(),
  openPanel: vi.fn(),
}));
vi.mock("wxt/browser", () => ({
  browser: {
    tabs: { query: mocks.query, get: mocks.get },
    scripting: { executeScript: mocks.executeScript },
    sidePanel: {
      setPanelBehavior: mocks.setPanelBehavior,
      open: mocks.openPanel,
    },
    action: { onClicked: { addListener: mocks.actionListener } },
    runtime: {
      id: "abc",
      getURL: (path: string) => `chrome-extension://abc${path}`,
      onMessage: { addListener: mocks.addListener },
    },
  },
}));

import background from "../../entrypoints/background";
import type { InspectResponse } from "../../lib/protocol";

type Listener = (
  message: unknown,
  sender: unknown,
  respond: (result: InspectResponse) => void,
) => boolean;
const sender = { id: "abc", url: "chrome-extension://abc/sidepanel.html" };
const request = { version: 1, type: "inspect-active-tab" };
const tab = {
  id: 7,
  url: "https://example.test/private",
  active: true,
  incognito: false,
};
const context = {
  origin: "https://example.test",
  viewport: { width: 1200, height: 800, devicePixelRatio: 2 },
};
let listener: Listener;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.setPanelBehavior.mockResolvedValue(undefined);
  mocks.openPanel.mockResolvedValue(undefined);
  mocks.query.mockResolvedValue([tab]);
  mocks.get.mockResolvedValue(tab);
  mocks.executeScript.mockResolvedValue([{ result: context }]);
  background.main();
  listener = mocks.addListener.mock.calls[0]?.[0] as Listener;
});

describe("service worker inspection", () => {
  it("opens the panel synchronously within the toolbar gesture, without reading the page", () => {
    const onAction = mocks.actionListener.mock.calls[0]?.[0] as (tab: {
      windowId: number;
    }) => void;
    onAction({ windowId: 12 });
    expect(mocks.openPanel).toHaveBeenCalledWith({ windowId: 12 });
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("configures the action without automatically reading tabs", () => {
    expect(mocks.setPanelBehavior).toHaveBeenCalledWith({
      openPanelOnActionClick: false,
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("ignores page/content-script senders, unknown extension pages and agents", () => {
    const respond = vi.fn();
    for (const untrusted of [
      { ...sender, tab: { id: 7 } },
      { ...sender, url: tab.url },
      { ...sender, id: "other" },
      { ...sender, url: "chrome-extension://abc/background.js" },
    ]) {
      expect(listener(request, untrusted, respond)).toBe(false);
    }
    expect(mocks.query).not.toHaveBeenCalled();
    expect(respond).not.toHaveBeenCalled();
  });
  it("rejects invalid or arbitrary-target messages before querying tabs", () => {
    const respond = vi.fn();
    expect(listener({ ...request, tabId: 99 }, sender, respond)).toBe(false);
    expect(respond).toHaveBeenCalledWith({
      ok: false,
      code: "invalid-message",
    });
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("rejects all retired capture and inspection requests without reading pages", () => {
    for (const request of [
      { version: 1, type: "inspect-active-tab" },
      { version: 1, type: "capture", mode: "viewport" },
    ]) {
      const respond = vi.fn();
      expect(listener(request, sender, respond)).toBe(false);
      expect(respond).toHaveBeenCalledWith({
        ok: false,
        code: "invalid-message",
      });
    }
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.executeScript).not.toHaveBeenCalled();
  });
});
