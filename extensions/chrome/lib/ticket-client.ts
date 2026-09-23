import { browser } from "wxt/browser";
import { type TicketRequest, ticketResponseSchema } from "./tickets";

export async function requestTicket(message: TicketRequest) {
  try {
    return ticketResponseSchema.parse(
      await browser.runtime.sendMessage(message),
    );
  } catch {
    return { ok: false, code: "network" } as const;
  }
}
