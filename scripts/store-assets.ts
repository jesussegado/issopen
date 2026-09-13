import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve("extensions/chrome");
const output = join(root, ".output/chrome-mv3");
const target = join(root, "store/assets");
const sourceIcon = resolve(
  "src/web/public/assets/branding/issopen-icon-v1.png",
);

async function extensionPage() {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      "--enable-unsafe-extension-debugging",
      `--disable-extensions-except=${output}`,
      `--load-extension=${output}`,
    ],
  });
  const cdp = await context.browser()?.newBrowserCDPSession();
  if (!cdp) throw new Error("Chrome CDP is not available");
  const extension = (
    await cdp.send("Extensions.getExtensions")
  ).extensions.find((candidate) => candidate.name === "Issopen");
  if (!extension) throw new Error("The generated Issopen extension is missing");
  const page = await context.newPage();
  await page.addInitScript(() => {
    const state = globalThis as unknown as {
      chrome: {
        runtime: { sendMessage: (message: unknown) => Promise<unknown> };
      };
    };
    state.chrome.runtime.sendMessage = async (raw) => {
      const message = raw as { type: string; action?: string };
      if (message.type === "account-status")
        return {
          ok: true,
          connected: true,
          name: "Miembro de demostración",
          expiresAt: "2026-10-13T12:00:00.000Z",
          userId: "store-member",
          workspaceId: "10000000-0000-4000-8000-000000000001",
          workspaceRole: "member",
          canWrite: true,
          apiVersion: 1,
          projects: [
            {
              id: "20000000-0000-4000-8000-000000000001",
              name: "Producto web",
            },
          ],
        };
      if (message.type === "tickets" && message.action === "epics")
        return {
          ok: true,
          epics: [
            {
              id: "30000000-0000-4000-8000-000000000001",
              number: 12,
              title: "Revisión de usabilidad",
            },
          ],
        };
      return { ok: false, code: "network" };
    };
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`chrome-extension://${extension.id}/sidepanel.html`);
  await page.getByRole("button", { name: "Cerrar aviso informativo" }).click();
  await page
    .getByRole("combobox", { name: "Proyecto", exact: true })
    .fill("Producto web");
  await page.getByRole("option", { name: "Producto web", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Epic", exact: true })
    .fill("Revisión");
  await page.getByRole("option", { name: /Revisión de usabilidad/ }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("El formulario pierde el foco al guardar");
  await page
    .getByRole("textbox", { name: "Descripción", exact: true })
    .fill(
      "El campo vuelve al inicio después de guardar. Revisar el flujo con teclado.",
    );
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const paint = canvas.getContext("2d");
    if (!paint) throw new Error("Canvas is unavailable");
    const gradient = paint.createLinearGradient(0, 0, 640, 360);
    gradient.addColorStop(0, "#e4f5ec");
    gradient.addColorStop(1, "#c5d9d1");
    paint.fillStyle = gradient;
    paint.fillRect(0, 0, 640, 360);
    paint.fillStyle = "#027067";
    paint.fillRect(96, 86, 448, 56);
    paint.fillStyle = "#ffffff";
    paint.fillRect(96, 166, 310, 32);
    paint.fillRect(96, 218, 380, 32);
    return canvas.toDataURL("image/png");
  });
  await page.getByLabel("Seleccionar imágenes").setInputFiles({
    name: "captura-formulario.png",
    mimeType: "image/png",
    buffer: Buffer.from(image.split(",")[1] ?? "", "base64"),
  });
  await page.locator(".image-grid img").waitFor({ state: "visible" });
  return { context, page };
}

async function renderBrandAssets(icon: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const iconPage = await browser.newPage({
      viewport: { width: 128, height: 128 },
    });
    await iconPage.setContent(
      `<style>html,body{margin:0;width:128px;height:128px;background:transparent}body{display:grid;place-items:center}img{width:96px;height:96px;object-fit:contain}</style><img alt="" src="${icon}">`,
    );
    await iconPage.screenshot({
      path: join(target, "store-icon-128.png"),
      omitBackground: true,
    });
    const promo = await browser.newPage({
      viewport: { width: 440, height: 280 },
    });
    await promo.setContent(`
      <style>
        *{box-sizing:border-box}html,body{margin:0;width:440px;height:280px;overflow:hidden}
        body{position:relative;background:linear-gradient(145deg,#d9f3e8 0%,#f3faf7 52%,#c5d9d1 100%);font-family:system-ui,sans-serif}
        .mark{position:absolute;left:42px;top:66px;width:148px;height:148px;object-fit:contain;filter:drop-shadow(0 10px 16px rgb(1 83 76 / 16%))}
        .ticket{position:absolute;width:166px;height:104px;border:2px solid #a4c8bb;border-radius:14px;background:#fff;box-shadow:0 10px 24px rgb(20 47 41 / 12%)}
        .ticket::before,.ticket::after{content:"";position:absolute;left:20px;border-radius:6px;background:#d9f3e8}
        .ticket::before{top:24px;width:86px;height:14px}.ticket::after{top:54px;width:120px;height:10px}
        .back{right:34px;top:42px;transform:rotate(5deg);opacity:.75}.front{right:50px;bottom:44px;transform:rotate(-3deg)}
        .front span{position:absolute;right:16px;bottom:14px;width:34px;height:10px;border-radius:8px;background:#027067}
      </style>
      <img class="mark" alt="" src="${icon}"><div class="ticket back"></div><div class="ticket front"><span></span></div>
    `);
    await promo.screenshot({ path: join(target, "promo-small-440x280.png") });
  } finally {
    await browser.close();
  }
}

async function main() {
  await mkdir(target, { recursive: true });
  const icon = `data:image/png;base64,${(await readFile(sourceIcon)).toString("base64")}`;
  await renderBrandAssets(icon);
  const { context, page } = await extensionPage();
  try {
    await page.screenshot({
      path: join(target, "screenshot-composer-1280x800.png"),
    });
    await page.getByRole("button", { name: "Tu cuenta" }).click();
    await page.screenshot({
      path: join(target, "screenshot-account-1280x800.png"),
    });
  } finally {
    await context.close();
  }
  const manifest = JSON.parse(
    await readFile(join(output, "manifest.json"), "utf8"),
  ) as { version: string };
  const files = [
    ["store-icon-128.png", 128, 128],
    ["promo-small-440x280.png", 440, 280],
    ["screenshot-composer-1280x800.png", 1280, 800],
    ["screenshot-account-1280x800.png", 1280, 800],
  ] as const;
  const assets = [];
  for (const [name, width, height] of files) {
    const bytes = await readFile(join(target, name));
    assets.push({
      name,
      width,
      height,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  await writeFile(
    join(target, "assets.json"),
    `${JSON.stringify({ extensionVersion: manifest.version, assets }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ extensionVersion: manifest.version, assets }));
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Asset generation failed",
  );
  process.exitCode = 1;
});
