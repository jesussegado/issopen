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
      "Pega o sube imágenes y crea tickets en tus proyectos y Epics de Issopen.",
    minimum_chrome_version: "116",
    incognito: "not_allowed",
    permissions: ["sidePanel", "identity", "storage"],
    optional_permissions: ["clipboardRead"],
    host_permissions: [`${instance.origin}/*`],
    action: {
      default_title: "Abrir Issopen",
      default_icon: {
        16: "icons/icon-16.png",
        48: "icons/icon-48.png",
        128: "icons/icon-128.png",
      },
    },
    commands: {
      _execute_action: {
        suggested_key: { default: "Alt+Shift+I" },
        description: "Abrir Issopen para esta pestaña",
      },
    },
    icons: {
      16: "icons/icon-16.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
    content_security_policy: {
      extension_pages:
        mode === "production"
          ? `default-src 'self'; script-src 'self'; object-src 'none'; connect-src ${instance.origin} data:; img-src 'self' data: blob:; style-src 'self'; base-uri 'none'; form-action 'none'; frame-src 'none'`
          : "script-src 'self'; object-src 'none'",
    },
  }),
  vite: ({ mode }) => ({ build: { sourcemap: mode === "development" } }),
  hooks: {
    "build:publicAssets"(_wxt, files) {
      for (const size of [16, 48, 128])
        files.push({
          absoluteSrc: fileURLToPath(
            new URL(`./assets/icon-${size}.png`, import.meta.url),
          ),
          relativeDest: `icons/icon-${size}.png`,
        });
    },
  },
});
