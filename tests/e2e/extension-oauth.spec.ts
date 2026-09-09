import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { e2eBaseUrl, e2eOwner } from "./fixtures.js";

process.env.PW_CHROMIUM_ATTACH_TO_OTHER = "1";
// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixture parameter.
test("Chrome completes real identity consent and disconnects without exposing tokens to the panel", async ({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Chrome MV3 has no mobile target",
  );
  test.setTimeout(120000);
  execFileSync("pnpm", ["extension:build"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DEBUG: "",
      WXT_ISSOPEN_BASE_URL: e2eBaseUrl,
      ISSOPEN_EXTENSION_TEST_BUILD: "1",
    },
    stdio: "pipe",
  });
  const output = resolve("extensions/chrome/.output/oauth-test/chrome-mv3");
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    viewport: null,
    args: [
      "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${output}`,
      `--load-extension=${output}`,
    ],
  });
  try {
    const page = context.pages()[0];
    if (!page) throw new Error("Missing Chrome tab");
    await page.goto(`${e2eBaseUrl}/sign-in`);
    await page.locator('input[type="email"]').fill(e2eOwner.email);
    await page.locator('input[type="password"]').fill(e2eOwner.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => url.pathname !== "/sign-in");
    if (new URL(page.url()).pathname === "/workspace/new") {
      await page.getByLabel("Workspace name").fill("Extension E2E workspace");
      await page
        .getByRole("button", { name: "Create workspace", exact: true })
        .click();
      await page.waitForURL((url) => url.pathname !== "/workspace/new");
    }
    const browser = context.browser();
    if (!browser) throw new Error("Missing browser");
    const cdp = await browser.newBrowserCDPSession();
    const { extensions } = await cdp.send("Extensions.getExtensions");
    const extension = extensions.find((x) => x.name === "Issopen");
    if (!extension) throw new Error("Missing extension");
    const { targetInfos } = await cdp.send("Target.getTargets", {
      filter: [{ type: "tab" }],
    });
    const tab = targetInfos.find((t) => t.url === page.url());
    if (!tab) throw new Error("Missing tab");
    await cdp.send("Extensions.triggerAction", {
      id: extension.id,
      targetId: tab.targetId,
    });
    await expect
      .poll(() =>
        context
          .pages()
          .some(
            (p) =>
              p.url() === `chrome-extension://${extension.id}/sidepanel.html`,
          ),
      )
      .toBe(true);
    const panel = context
      .pages()
      .find(
        (p) => p.url() === `chrome-extension://${extension.id}/sidepanel.html`,
      );
    if (!panel) throw new Error("Missing panel");
    await expect(panel.getByText(e2eBaseUrl, { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: "Conectar con Issopen" }).click();
    await expect
      .poll(() =>
        context.pages().some((p) => p.url().includes("/extensions/link?")),
      )
      .toBe(true);
    const flow = context
      .pages()
      .find((p) => p.url().includes("/extensions/link?"));
    if (!flow) throw new Error("Missing OAuth window");
    await flow
      .getByRole("button", { name: "Continuar al consentimiento" })
      .click();
    await expect(
      flow.getByText(
        "Leer tus proyectos desde esta instalación de Chrome (sin permisos de agente)",
      ),
    ).toBeVisible();
    await flow.getByRole("button", { name: "Allow access" }).click();
    await expect(
      panel.getByText("Conectado como", { exact: false }),
    ).toBeVisible();
    expect(await panel.evaluate(() => localStorage.length)).toBe(0);
    await expect(
      panel.getByRole("heading", { name: /Proyectos disponibles/ }),
    ).toBeVisible();
    await page.goto(`${e2eBaseUrl}/extensions`);
    await expect(
      page.getByRole("button", { name: /Revocar Issopen Chrome/ }),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "Desconectar esta instalación" })
      .click();
    await expect(
      panel.getByRole("button", { name: "Conectar con Issopen" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Revocada o caducada", { exact: false }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
