import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { chromium, expect, type Page, test } from "@playwright/test";
import {
  prepareCapturePage,
  restoreCapturePage,
  validCapturePage,
} from "../../lib/capture-page";

const output = resolve(".output/chrome-mv3");
const server = createServer((_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(`<!doctype html><html><head><style>
    body{margin:0;background:white}
    #page{height:1800px;background:linear-gradient(#fff,#eef)}
    input{position:absolute;top:100px;left:10px;width:200px;height:30px;background:red;border:0;padding:0}
    #fixed{position:fixed;top:0;right:0;background:lime;width:80px;height:40px}
    private-control{position:absolute;top:150px;left:10px;width:200px;height:30px;display:block;background:red}
    </style></head><body><div id="page">Capture fixture</div>
    <input value="PRIVATE-INPUT"><private-control>PRIVATE-SHADOW</private-control><section id="pick" style="position:absolute;left:20px;top:200px" data-secret="PRIVATE-DOM-DECOY"><button id="target" title="PRIVATE-DOM-DECOY" style="width:200px;height:50px">Select this button</button></section><div id="fixed">Fixed</div></body></html>`);
});
let url: string;
test.beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
});

async function openCapture(scale = 1) {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    viewport: null,
    args: [
      "--enable-unsafe-extension-debugging",
      "--window-size=1600,1200",
      `--force-device-scale-factor=${scale}`,
      `--disable-extensions-except=${output}`,
      `--load-extension=${output}`,
    ],
  });
  try {
    const page = context.pages()[0];
    if (!page) throw new Error("Missing page");
    await page.goto(url);
    await stableViewport(page);
    const beforePanelWidth = await page.evaluate(() => innerWidth);
    const cdp = await context.browser()?.newBrowserCDPSession();
    if (!cdp) throw new Error("Missing CDP");
    const { extensions } = await cdp.send("Extensions.getExtensions");
    const extension = extensions.find((e) => e.name === "Issopen");
    if (!extension) throw new Error("Missing extension");
    const { targetInfos } = await cdp.send("Target.getTargets", {
      filter: [{ type: "tab" }],
    });
    const tab = targetInfos.find((t) => t.url === page.url());
    if (!tab) throw new Error("Missing tab");
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));
    await expect
      .poll(() =>
        worker.evaluate(
          "chrome.sidePanel.getPanelBehavior().then(b=>b.openPanelOnActionClick)",
        ),
      )
      .toBe(false);
    await cdp.send("Extensions.triggerAction", {
      id: extension.id,
      targetId: tab.targetId,
    });
    await expect
      .poll(() =>
        context.pages().some((p) => p.url().endsWith("/sidepanel.html")),
      )
      .toBe(true);
    const panel = context
      .pages()
      .find((p) => p.url().endsWith("/sidepanel.html"));
    if (!panel) throw new Error("Missing panel");
    // Chrome animates its native side panel asynchronously after the document
    // appears. Wait for the actual page resize, not just the panel target.
    await expect
      .poll(() => page.evaluate(() => innerWidth))
      .toBeLessThan(beforePanelWidth - 100);
    await stableViewport(page);
    panel.on("dialog", (d) => void d.accept());
    const requests: string[] = [];
    context.on("request", (r) => {
      if (
        r.url().startsWith("http") &&
        (r.method() !== "GET" || !r.url().startsWith(`${url}/`))
      )
        requests.push(r.url());
    });
    return { context, page, panel, worker, requests };
  } catch (error) {
    await context.close();
    throw error;
  }
}
async function selectionReady(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.activeElement?.shadowRoot === null &&
          document.activeElement?.tagName === "DIV",
      ),
    )
    .toBe(true);
}
async function stableViewport(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        let quiet: ReturnType<typeof setTimeout>;
        const finish = () => {
          clearTimeout(quiet);
          clearTimeout(limit);
          window.removeEventListener("resize", resize);
          resolve();
        };
        const resize = () => {
          clearTimeout(quiet);
          quiet = setTimeout(finish, 250);
        };
        const limit = setTimeout(() => {
          clearTimeout(quiet);
          window.removeEventListener("resize", resize);
          reject(new Error("Fixture viewport did not stabilize"));
        }, 5000);
        window.addEventListener("resize", resize);
        resize();
      }),
  );
}
async function take(panel: Page, mode: string) {
  await panel.getByLabel("Modo", { exact: true }).selectOption(mode);
  await panel
    .getByRole("button", { name: "Capturar página", exact: true })
    .click();
}

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixtures.
test("selects an element, navigates ancestors and previews only removable sanitized structure", async ({}) => {
  const { context, page, panel, requests } = await openCapture();
  try {
    await take(panel, "element");
    await selectionReady(page);
    await page.locator("#target").hover();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(panel.locator("canvas")).toHaveAttribute("aria-busy", "false");
    await expect(
      panel.getByRole("heading", { name: "Elemento seleccionado" }),
    ).toBeVisible();
    await panel.getByText("Revisar DOM", { exact: false }).click();
    await expect(panel.locator("pre")).toContainText("<button>");
    expect(await panel.locator(".element-context").innerText()).not.toContain(
      "PRIVATE",
    );
    await panel.getByLabel("Incluir estructura DOM saneada").uncheck();
    await expect(panel.locator("pre")).toHaveCount(0);
    expect(requests).toEqual([]);
    await take(panel, "element");
    await selectionReady(page);
    await page.keyboard.press("Escape");
    await expect(panel.getByRole("alert")).toContainText("Selección cancelada");
  } finally {
    await context.close();
  }
});

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixtures.
test("captures viewport/crop/full page and edits only flattened local pixels", async ({}, info) => {
  test.setTimeout(60000);
  const { context, page, panel, requests } = await openCapture();
  try {
    const canvas = panel.locator("canvas");
    await take(panel, "viewport");
    await expect(
      panel.getByRole("heading", { name: "Previsualización local" }),
    ).toBeVisible();
    await expect(canvas).toHaveAttribute("aria-busy", "false");
    const pixel = (x = 50, y = 50) =>
      canvas.evaluate(
        (c, [px, py]) => {
          const ctx = (c as HTMLCanvasElement).getContext("2d");
          if (!ctx) throw new Error("Missing canvas");
          return Array.from(ctx.getImageData(px, py, 1, 1).data);
        },
        [x, y] as const,
      );
    expect((await pixel(20, 110))[1]).toBeGreaterThan(200);
    expect((await pixel(20, 160))[1]).toBeGreaterThan(200);
    expect(
      await page.locator("input").evaluate((e) => getComputedStyle(e).opacity),
    ).toBe("1");
    const before = await pixel();
    expect(before).not.toEqual([0, 0, 0, 255]);
    await panel.getByRole("button", { name: "Aplicar ocultación" }).click();
    await expect.poll(() => pixel()).toEqual([0, 0, 0, 255]);
    await panel.getByRole("button", { name: "Deshacer", exact: true }).click();
    await expect.poll(() => pixel()).toEqual(before);
    await panel.getByRole("button", { name: "Rehacer", exact: true }).click();
    await expect.poll(() => pixel()).toEqual([0, 0, 0, 255]);
    expect(
      await panel
        .getByRole("link", { name: "Descargar PNG revisado" })
        .getAttribute("href"),
    ).toMatch(/^data:image\/png;base64,/);
    await panel.getByLabel("Herramienta", { exact: true }).selectOption("crop");
    await panel.getByLabel("Ancho", { exact: true }).fill("60");
    await panel.getByLabel("Alto", { exact: true }).fill("40");
    await panel
      .getByRole("button", { name: "Aplicar recorte", exact: true })
      .click();
    await expect
      .poll(() =>
        canvas.evaluate((c) => [
          (c as HTMLCanvasElement).width,
          (c as HTMLCanvasElement).height,
        ]),
      )
      .toEqual([60, 40]);
    await panel
      .getByLabel("Zoom de previsualización", { exact: true })
      .selectOption("200");
    expect(await canvas.evaluate((c) => c.getBoundingClientRect().width)).toBe(
      120,
    );
    await panel
      .getByLabel("Zoom de previsualización", { exact: true })
      .selectOption("fit");
    await page.evaluate(() => scrollTo(0, 250));
    await take(panel, "full");
    await expect
      .poll(() => canvas.evaluate((c) => (c as HTMLCanvasElement).height))
      .toBe(1800);
    expect(await page.evaluate(() => scrollY)).toBe(250);
    expect(await page.locator("input").inputValue()).toBe("PRIVATE-INPUT");
    expect(
      await page.locator("#fixed").evaluate((e) => getComputedStyle(e).opacity),
    ).toBe("1");
    await take(panel, "crop");
    await selectionReady(page);
    await page.mouse.move(30, 60);
    await page.mouse.down();
    await page.mouse.move(150, 160);
    await page.mouse.up();
    await expect
      .poll(() =>
        canvas.evaluate((c) => [
          (c as HTMLCanvasElement).width,
          (c as HTMLCanvasElement).height,
        ]),
      )
      .toEqual([120, 100]);
    expect(requests).toEqual([]);
    await panel.screenshot({
      path: info.outputPath("capture-panel.png"),
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixtures.
test("explains missing access and recovers through the real toolbar action", async ({}, info) => {
  const { context, page, panel } = await openCapture();
  try {
    // Same synthetic fixture on another origin revokes the initial activeTab grant.
    await page.goto(url.replace("127.0.0.1", "localhost"));
    await stableViewport(page);
    await take(panel, "viewport");
    const alert = panel.getByRole("alert");
    await expect(alert).toHaveAttribute("data-capture-error", "page-access");
    await expect(alert).toContainText("No podemos acceder a esta pestaña");
    await expect(alert).toContainText(
      "Estar conectado a Issopen no concede acceso",
    );
    await expect(alert).toContainText("icono de Issopen en la barra de Chrome");
    await expect(alert).toContainText("Esta captura no se ha enviado");
    await alert.screenshot({
      path: info.outputPath("capture-access-error.png"),
    });
    await expect(panel.locator("canvas")).toHaveCount(0);
    const cdp = await context.browser()?.newBrowserCDPSession();
    if (!cdp) throw new Error("Missing CDP");
    const { extensions } = await cdp.send("Extensions.getExtensions");
    const extension = extensions.find((e) => e.name === "Issopen");
    const { targetInfos } = await cdp.send("Target.getTargets", {
      filter: [{ type: "tab" }],
    });
    const tab = targetInfos.find((t) => t.url === page.url());
    if (!extension || !tab) throw new Error("Missing extension/fixture");
    await page.bringToFront();
    await cdp.send("Extensions.triggerAction", {
      id: extension.id,
      targetId: tab.targetId,
    });
    await stableViewport(page);
    await take(panel, "viewport");
    await expect(panel.locator("canvas")).toHaveAttribute("aria-busy", "false");
    await expect(alert).toHaveCount(0);
  } finally {
    await context.close();
  }
});

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixture parameter.
test("detects browser viewport changes separately from document mutations", async ({}) => {
  const { context, page } = await openCapture();
  try {
    await page.evaluate(prepareCapturePage, false);
    await expect.poll(() => page.evaluate(validCapturePage)).toBe("ready");
    await page.setViewportSize({ width: 900, height: 650 });
    await expect
      .poll(() => page.evaluate(validCapturePage))
      .toBe("viewport-changed");
    await page.evaluate(restoreCapturePage);
    await expect
      .poll(() => page.evaluate(validCapturePage))
      .toBe("page-unavailable");
    expect(
      await page.locator("input").evaluate((e) => getComputedStyle(e).opacity),
    ).toBe("1");
  } finally {
    await context.close();
  }
});

// biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructured fixture parameter.
test("scales a crop at DPR 2 / zoom 125%, cancels and safely rejects oversized or changing pages", async ({}) => {
  test.setTimeout(60000);
  const { context, page, panel, worker, requests } = await openCapture(2);
  try {
    await worker.evaluate(
      "chrome.tabs.query({active:true,lastFocusedWindow:true}).then(([t])=>chrome.tabs.setZoom(t.id,1.25))",
    );
    await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(2.5);
    await stableViewport(page);
    await expect
      .poll(() => page.evaluate(() => innerWidth))
      .toBeGreaterThan(150);
    await expect
      .poll(() => page.evaluate(() => innerHeight))
      .toBeGreaterThan(130);
    await take(panel, "crop");
    await selectionReady(page);
    await page.keyboard.press("Escape");
    await expect(panel.getByRole("alert")).toContainText("Selección cancelada");
    await expect(panel.locator("canvas")).toHaveCount(0);
    await take(panel, "crop");
    await selectionReady(page);
    await page.mouse.move(30, 30);
    await page.mouse.down();
    await page.mouse.move(130, 110);
    await page.mouse.up();
    await expect(panel.locator("canvas")).toHaveAttribute("aria-busy", "false");
    const dimensions = await panel.locator("canvas").evaluate((c) => ({
      width: (c as HTMLCanvasElement).width,
      height: (c as HTMLCanvasElement).height,
    }));
    // Native viewport dimensions can round one physical pixel at fractional zoom.
    expect(Math.abs(dimensions.width - 250)).toBeLessThanOrEqual(1);
    expect(Math.abs(dimensions.height - 200)).toBeLessThanOrEqual(1);
    const reviewed = await panel
      .getByRole("link", { name: "Descargar PNG revisado" })
      .getAttribute("href");
    await page.locator("#page").evaluate((e) => {
      (e as HTMLElement).style.height = "17000px";
    });
    await page.evaluate(() => scrollTo(0, 250));
    await take(panel, "full");
    await expect(panel.getByRole("alert")).toContainText("supera el límite");
    expect(await page.evaluate(() => scrollY)).toBe(250);
    expect(
      await page.locator("input").evaluate((e) => getComputedStyle(e).opacity),
    ).toBe("1");
    expect(
      await panel
        .getByRole("link", { name: "Descargar PNG revisado" })
        .getAttribute("href"),
    ).toBe(reviewed);
    await page.locator("#page").evaluate((e) => {
      (e as HTMLElement).style.height = "1800px";
    });
    await page.evaluate(() => {
      const input = document.querySelector("input");
      if (!input) throw new Error("Missing fixture");
      const observer = new MutationObserver(() => {
        if (input.style.opacity !== "0") return;
        observer.disconnect();
        requestAnimationFrame(() => {
          document.body.append(document.createElement("input"));
        });
      });
      observer.observe(input, { attributes: true });
    });
    await take(panel, "viewport");
    await expect(panel.getByRole("alert")).toHaveAttribute(
      "data-capture-error",
      "content-changed",
    );
    await expect(panel.getByRole("alert")).toContainText(
      "La página cambió mientras capturábamos",
    );
    await expect(panel.getByRole("alert")).toContainText(
      "Cambiar a recorte no evita esta protección",
    );
    await expect(panel.getByRole("alert")).toContainText(
      "La previsualización anterior sigue disponible",
    );
    expect(
      await page
        .locator("input")
        .first()
        .evaluate((e) => getComputedStyle(e).opacity),
    ).toBe("1");
    expect(
      await panel
        .getByRole("link", { name: "Descargar PNG revisado" })
        .getAttribute("href"),
    ).toBe(reviewed);
    expect(requests).toEqual([]);
  } finally {
    await context.close();
  }
});
