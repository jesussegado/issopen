import { fileURLToPath } from "node:url";
import { defineConfig } from "wxt";

const instance = new URL(
  process.env.WXT_ISSOPEN_BASE_URL ?? "https://issopen.serviciosegado.com",
);
if (
  instance.href !== `${instance.origin}/` ||
  (instance.protocol !== "https:" &&
    !(
      instance.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(instance.hostname)
    ))
)
  throw new Error(
    "Extension instance must be an HTTPS origin or explicit loopback development origin",
  );

export default defineConfig({
  ...(process.env.ISSOPEN_EXTENSION_TEST_BUILD === "1"
    ? { outDir: ".output/oauth-test" }
    : {}),
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  imports: false,
  webExt: { disabled: true },
  manifest: ({ mode }) => ({
    name: "Issopen",
    description:
      "Conecta tu cuenta de Issopen y prepara capturas desde Chrome.",
    minimum_chrome_version: "116",
    incognito: "not_allowed",
    permissions: ["activeTab", "scripting", "sidePanel", "identity", "storage"],
    host_permissions: [`${instance.origin}/*`],
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
          ? `default-src 'self'; script-src 'self'; object-src 'none'; connect-src ${instance.origin}; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-src 'none'`
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
