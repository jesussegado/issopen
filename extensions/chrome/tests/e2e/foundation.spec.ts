import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";

const output = resolve(".output/chrome-mv3");
const fixture = createServer((_request, response) => {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end(
    '<!doctype html><html lang="es"><title>PRIVATE-TITLE</title><body><h1>Fixture local</h1><input value="PRIVATE-FORM"><p>PRIVATE-DOM</p></body></html>',
  );
});
let fixtureUrl: string;

test.beforeAll(async () => {
  await new Promise<void>((done) => fixture.listen(0, "127.0.0.1", done));
  fixtureUrl = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
});
test.afterAll(async () => {
  await new Promise<void>((done, reject) =>
    fixture.close((error) => (error ? reject(error) : done())),
  );
});

test("production manifest limits network access to Issopen and explicit page gestures", async () => {
  const manifest = JSON.parse(
    await readFile(resolve(output, "manifest.json"), "utf8"),
  );
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  expect(manifest.version).toBe(pkg.version);
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions.toSorted()).toEqual(
    ["sidePanel", "identity", "storage"].toSorted(),
  );
  expect(manifest.optional_permissions).toEqual(["clipboardRead"]);
  for (const key of [
    "optional_host_permissions",
    "content_scripts",
    "externally_connectable",
    "web_accessible_resources",
  ])
    expect(manifest[key]).toBeUndefined();
  expect(manifest.incognito).toBe("not_allowed");
  expect(manifest.content_security_policy.extension_pages).toContain(
    "connect-src https://issopen.serviciosegado.com",
  );
  expect(manifest.content_security_policy.extension_pages).toContain(
    "script-src 'self'",
  );
  expect(manifest.content_security_policy.extension_pages).not.toMatch(
    /unsafe|\*/,
  );
  expect(manifest.host_permissions).toEqual([
    "https://issopen.serviciosegado.com/*",
  ]);
  expect(manifest.side_panel.default_path).toBe("sidepanel.html");
  const files = await readdir(output, { recursive: true });
  expect(files.some((file) => file.endsWith(".map"))).toBe(false);
  const hash = (data: Buffer) =>
    createHash("sha256").update(data).digest("hex");
  expect(hash(await readFile(resolve(output, "icon.png")))).toBe(
    hash(
      await readFile(
        "../../src/web/public/assets/branding/issopen-favicon-v2-white.png",
      ),
    ),
  );
});

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixture parameter.
test("real toolbar action opens images without granting access to the page", async ({}, testInfo) => {
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
    const errors: string[] = [];
    context.on("weberror", (error) => errors.push(error.error().message));
    const page = context.pages()[0];
    if (!page) throw new Error("Missing fixture tab");
    await page.goto(`${fixtureUrl}/private?key=PRIVATE-QUERY#PRIVATE-HASH`);
    const browser = context.browser();
    if (!browser) throw new Error("Missing browser connection");
    const cdp = await browser.newBrowserCDPSession();
    const { extensions } = await cdp.send("Extensions.getExtensions");
    const extension = extensions.find((item) => item.name === "Issopen");
    expect(extension?.enabled).toBe(true);
    if (!extension) throw new Error("Extension not loaded");
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));
    await expect
      .poll(() =>
        worker.evaluate(
          "chrome.sidePanel.getPanelBehavior().then(b => b.openPanelOnActionClick)",
        ),
      )
      .toBe(false);

    // Opening an extension document alone must NOT grant activeTab.
    const preview = await context.newPage();
    await preview.goto(`chrome-extension://${extension.id}/sidepanel.html`);
    await expect(
      preview.getByRole("heading", { name: /Imágenes del ticket/ }),
    ).toBeVisible();
    await preview.setViewportSize({ width: 320, height: 800 });
    expect(
      await preview.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.bringToFront();
    expect(
      await worker.evaluate(
        "chrome.tabs.query({active:true,lastFocusedWindow:true}).then(t => t[0].url ?? null)",
      ),
    ).toBeNull();
    await preview.close();

    const { targetInfos } = await cdp.send("Target.getTargets", {
      filter: [{ type: "tab" }],
    });
    const targetInfo = targetInfos.find((target) => target.url === page.url());
    if (!targetInfo) throw new Error("Fixture tab target not found");
    await cdp.send("Extensions.triggerAction", {
      id: extension.id,
      targetId: targetInfo.targetId,
    });
    await expect
      .poll(() =>
        context
          .pages()
          .some(
            (candidate) =>
              candidate.url() ===
              `chrome-extension://${extension.id}/sidepanel.html`,
          ),
      )
      .toBe(true);
    const panel = context
      .pages()
      .find(
        (candidate) =>
          candidate.url() ===
          `chrome-extension://${extension.id}/sidepanel.html`,
      );
    if (!panel) throw new Error("Real side panel did not open");
    await expect(panel.getByRole("dialog", { name: "Tu cuenta" })).toBeHidden();
    await panel.getByRole("button", { name: "Tu cuenta", exact: true }).click();
    await expect(
      panel.getByRole("button", { name: "Conectar con Issopen" }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Cerrar cuenta" }).click();
    const requests: string[] = [];
    panel.on("request", (request) => {
      if (/^https?:/.test(request.url())) requests.push(request.url());
    });
    await expect(
      panel.getByRole("button", { name: "Subir imágenes" }),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Capturar página" }),
    ).toHaveCount(0);
    await expect(
      panel.getByRole("button", { name: "Comprobar página" }),
    ).toHaveCount(0);
    expect(await panel.locator("body").innerText()).not.toMatch(/PRIVATE-/);
    expect(
      await worker.evaluate(
        "chrome.tabs.query({active:true,lastFocusedWindow:true}).then(t => t[0].url ?? null)",
      ),
    ).toBeNull();
    for (const message of [
      { version: 1, type: "inspect-active-tab" },
      { version: 1, type: "capture", mode: "viewport" },
    ]) {
      expect(
        await panel.evaluate(
          (request) =>
            (
              globalThis as unknown as {
                chrome: {
                  runtime: { sendMessage: (v: unknown) => Promise<unknown> };
                };
              }
            ).chrome.runtime.sendMessage(request),
          message,
        ),
      ).toEqual({ ok: false, code: "invalid-message" });
    }
    expect(requests).toEqual([]);
    await panel.screenshot({
      path: testInfo.outputPath("sidepanel.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    await testInfo.attach("browser-version", {
      body: Buffer.from(JSON.stringify(await cdp.send("Browser.getVersion"))),
      contentType: "application/json",
    });
  } finally {
    await context.close();
  }
});
