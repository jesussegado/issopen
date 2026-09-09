import { defineContentScript } from "wxt/utils/define-content-script";
import { pageContextSchema } from "../lib/protocol";

export default defineContentScript({
  registration: "runtime",
  globalName: true,
  main() {
    // Isolated world, top frame only. No DOM/title, forms, storage or URL paths.
    return pageContextSchema.parse({
      origin: location.origin,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
    });
  },
});
