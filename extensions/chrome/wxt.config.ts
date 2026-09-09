import { fileURLToPath } from "node:url";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  imports: false,
  webExt: { disabled: true },
  manifest: ({ mode }) => ({
    name: "Issopen",
    description: "Base de desarrollo del panel de captura de Issopen.",
    minimum_chrome_version: "116",
    incognito: "not_allowed",
    permissions: ["activeTab", "scripting", "sidePanel"],
    action: { default_title: "Abrir Issopen" },
    commands: {
      _execute_action: {
        suggested_key: { default: "Alt+Shift+I" },
        description: "Abrir Issopen para esta pestaña",
      },
    },
    icons: { 16: "icon.png", 48: "icon.png", 128: "icon.png" },
    content_security_policy: {
      extension_pages:
        mode === "production"
          ? "default-src 'self'; script-src 'self'; object-src 'none'; connect-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-src 'none'"
          : "script-src 'self'; object-src 'none'",
    },
  }),
  vite: ({ mode }) => ({ build: { sourcemap: mode === "development" } }),
  hooks: {
    "build:publicAssets"(_wxt, files) {
      // Copy the approved asset byte-for-byte; don't duplicate/reinvent branding.
      files.push({
        absoluteSrc: fileURLToPath(
          new URL(
            "../../src/web/public/assets/branding/issopen-favicon-v2-white.png",
            import.meta.url,
          ),
        ),
        relativeDest: "icon.png",
      });
    },
  },
});
