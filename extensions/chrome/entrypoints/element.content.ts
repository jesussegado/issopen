import { defineContentScript } from "wxt/utils/define-content-script";
import { selectElement } from "../lib/element";
export default defineContentScript({
  registration: "runtime",
  globalName: true,
  main: selectElement,
});
