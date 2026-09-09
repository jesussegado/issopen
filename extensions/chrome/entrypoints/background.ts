import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import {
  type InspectResponse,
  inspectableOrigin,
  inspectRequestSchema,
  isPanelSender,
  pageContextSchema,
} from "../lib/protocol";

async function inspectActiveTab(): Promise<InspectResponse> {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (tab?.incognito) return { ok: false, code: "unsupported-page" };
    if (tab?.id === undefined || !tab.url)
      return { ok: false, code: "permission-required" };
    const origin = inspectableOrigin(tab.url);
    if (!origin) return { ok: false, code: "unsupported-page" };
    const [result] = await browser.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      files: ["/content-scripts/page.js"],
    });
    const context = pageContextSchema.safeParse(result?.result);
    if (!context.success) return { ok: false, code: "unavailable" };
    const current = await browser.tabs.get(tab.id);
    if (
      !current.active ||
      current.url !== tab.url ||
      context.data?.origin !== origin
    ) {
      return { ok: false, code: "page-changed" };
    }
    return { ok: true, context: context.data };
  } catch {
    // Chrome's raw errors may contain the page URL. Never forward/log them.
    return { ok: false, code: "permission-required" };
  }
}

export default defineBackground(() => {
  // Native automatic side-panel opening bypasses the action's activeTab grant.
  // Handle the toolbar action explicitly, then open within that same gesture.
  const reportPanelFailure = () =>
    console.warn("Issopen: no se pudo abrir o configurar el panel lateral.");
  void browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(reportPanelFailure);
  browser.action.onClicked.addListener((tab) => {
    void browser.sidePanel
      .open({ windowId: tab.windowId })
      .catch(reportPanelFailure);
  });
  browser.runtime.onMessage.addListener(
    (message: unknown, sender, sendResponse) => {
      if (
        !isPanelSender(
          sender,
          browser.runtime.id,
          browser.runtime.getURL("/sidepanel.html"),
        )
      )
        return false;
      if (!inspectRequestSchema.safeParse(message).success) {
        sendResponse({
          ok: false,
          code: "invalid-message",
        } satisfies InspectResponse);
        return false;
      }
      void inspectActiveTab().then(sendResponse);
      return true;
    },
  );
});
