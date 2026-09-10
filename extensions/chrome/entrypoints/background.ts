import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import {
  accountRequestSchema,
  handleAccount,
  handleTickets,
} from "../lib/account";
import { loadDraft } from "../lib/draft";
import { isPanelSender } from "../lib/protocol";
import { ticketRequestSchema } from "../lib/tickets";
export default defineBackground(() => {
  void loadDraft().catch(() => undefined);
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
      const account = accountRequestSchema.safeParse(message);
      const ticket = ticketRequestSchema.safeParse(message);
      if (ticket.success) {
        void handleTickets(ticket.data).then(sendResponse);
        return true;
      }
      if (account.success) {
        void handleAccount(account.data.type).then(sendResponse);
        return true;
      }
      // Retired capture/inspection requests cannot read pages in the new worker.
      sendResponse({ ok: false, code: "invalid-message" });
      return false;
    },
  );
});
