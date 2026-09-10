import { resolve } from "node:path";
import { chromium, expect, type Page, test } from "@playwright/test";

const alpha = "10000000-0000-4000-8000-000000000001";
const beta = "10000000-0000-4000-8000-000000000002";
const firstEpic = "20000000-0000-4000-8000-000000000001";
const secondEpic = "20000000-0000-4000-8000-000000000002";
const longTitle = `Detalle ${"extenso ".repeat(24)}`.trim();

async function fixture() {
  const output = resolve(".output/chrome-mv3");
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
  if (!cdp) throw Error("Missing CDP");
  const { extensions } = await cdp.send("Extensions.getExtensions");
  const extension = extensions.find((e) => e.name === "Issopen");
  if (!extension) throw Error("Missing extension");
  const page = await context.newPage();
  // Explicit standalone UI fixture. The native action + OAuth suite uses
  // real account/API responses and clicks these same in-panel options.
  await page.addInitScript(
    ({ alpha, beta, firstEpic, secondEpic, longTitle }) => {
      const state = globalThis as unknown as {
        chrome: { runtime: { sendMessage: (m: unknown) => Promise<unknown> } };
        mutations: number;
        failEpics: boolean;
        holdEpics: boolean;
      };
      state.mutations = 0;
      state.failEpics = false;
      state.holdEpics = false;
      state.chrome.runtime.sendMessage = async (raw) => {
        const message = raw as {
          type: string;
          action?: string;
          projectId?: string;
        };
        if (message.type === "account-status")
          return {
            ok: true,
            connected: true,
            name: "Synthetic owner",
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            canWrite: true,
            apiVersion: 1,
            maxImages: 5,
            ownerId: "synthetic-owner",
            workspaceId: "30000000-0000-4000-8000-000000000001",
            projects: [
              { id: alpha, name: "Alpha" },
              { id: beta, name: "Beta" },
            ],
          };
        if (message.type === "tickets" && message.action === "epics") {
          while (state.holdEpics)
            await new Promise((resolve) => setTimeout(resolve, 20));
          if (state.failEpics) return { ok: false, code: "network" };
          return {
            ok: true,
            epics:
              message.projectId === alpha
                ? [
                    { id: firstEpic, number: 1, title: "Primero" },
                    { id: secondEpic, number: 2, title: longTitle },
                  ]
                : [],
          };
        }
        state.mutations++;
        return { ok: false, code: "network" };
      };
    },
    { alpha, beta, firstEpic, secondEpic, longTitle },
  );
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().startsWith("http")) requests.push(r.url());
  });
  await page.goto(`chrome-extension://${extension.id}/sidepanel.html`);
  await expect(page.locator("#account-status")).toHaveText("Conectada");
  return { context, page, requests };
}

async function choose(page: Page, label: string, option: string) {
  const field = page.getByRole("combobox", { name: label, exact: true });
  await field.click();
  await expect(
    page.getByRole("listbox", { name: label, exact: true }),
  ).toBeVisible();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(field).toHaveAttribute("aria-expanded", "false");
  if ((await field.getAttribute("aria-autocomplete")) === "list")
    await expect(field).toHaveValue(option);
  else await expect(field).toContainText(option);
  await expect(field).toBeFocused();
}

// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature.
test("mouse selection, search and long options fit the panel and preserve the draft", async ({}, info) => {
  const { context, page, requests } = await fixture();
  try {
    await choose(page, "Proyecto", "Alpha");
    await choose(page, "Epic", "1-Primero");
    await choose(page, "Proyecto", "Alpha");
    await expect(
      page.getByRole("combobox", { name: "Epic", exact: true }),
    ).toHaveValue("1-Primero");
    for (const width of [320, 400]) {
      await page.setViewportSize({ width, height: 800 });
      for (const name of ["Proyecto", "Epic", "Prioridad", "Estado"]) {
        const trigger = page.getByRole("combobox", { name, exact: true });
        await trigger.click();
        const list = page.getByRole("listbox", { name, exact: true });
        await expect(list).toBeVisible();
        expect(await list.getByRole("option").count()).toBeGreaterThan(1);
        const box = await list.boundingBox();
        expect(box?.x).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        if (name === "Epic")
          await list.screenshot({
            path: info.outputPath(`epics-${width}.png`),
          });
        await page.keyboard.press("Escape");
      }
    }
    await expect(
      page.getByLabel("Buscar proyecto", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Buscar Epic", { exact: true })).toHaveCount(
      0,
    );
    await page
      .getByRole("combobox", { name: "Proyecto", exact: true })
      .fill("bet");
    await expect(page.getByRole("option")).toHaveCount(1);
    await choose(page, "Proyecto", "Beta");
    await expect(
      page.getByRole("combobox", { name: "Epic", exact: true }),
    ).toHaveValue("Sin Epic");
    await page.getByRole("combobox", { name: "Epic", exact: true }).click();
    await expect(page.getByRole("option")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await choose(page, "Proyecto", "Alpha");
    await page
      .getByRole("combobox", { name: "Epic", exact: true })
      .fill("extenso");
    await expect(page.getByRole("option")).toHaveCount(1);
    await choose(page, "Epic", `2-${longTitle}`);
    await choose(page, "Prioridad", "urgent");
    await choose(page, "Estado", "ready");
    await page.getByLabel("Título", { exact: true }).fill("Synthetic draft");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise((resolve) => {
              const request = indexedDB.open("issopen-reviewed-draft-v1", 1);
              request.onsuccess = () => {
                const db = request.result;
                const read = db
                  .transaction("draft")
                  .objectStore("draft")
                  .get("current");
                read.onsuccess = () => {
                  resolve(read.result?.form.title);
                  db.close();
                };
              };
            }),
        ),
      )
      .toBe("Synthetic draft");
    await page.reload();
    for (const [name, value] of [
      ["Proyecto", alpha],
      ["Epic", secondEpic],
      ["Prioridad", "urgent"],
      ["Estado", "ready"],
    ] as const)
      await expect(
        page.getByRole("combobox", { name, exact: true }),
      ).toHaveAttribute("data-selected-value", value);
    await expect(
      page.getByRole("combobox", { name: "Epic", exact: true }),
    ).toHaveValue(`2-${longTitle}`);
    await expect(page.getByLabel("Título", { exact: true })).toHaveValue(
      "Synthetic draft",
    );
    expect(await page.evaluate("globalThis.mutations")).toBe(0);
    expect(requests).toEqual([]);
  } finally {
    await context.close();
  }
});

test("keyboard navigation only commits with Enter/Space and supports outside dismissal", async () => {
  const { context, page } = await fixture();
  try {
    const priority = page.getByRole("combobox", {
      name: "Prioridad",
      exact: true,
    });
    await priority.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    await expect(priority).toHaveAttribute("value", "medium");
    await page.keyboard.press("Escape");
    await expect(priority).toHaveAttribute("value", "medium");
    await expect(priority).toBeFocused();
    await page.keyboard.press("Space");
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(priority).toHaveAttribute("value", "high");
    await page.keyboard.press("u");
    await page.keyboard.press("r");
    await page.keyboard.press("Space");
    await expect(priority).toHaveAttribute("value", "urgent");
    await priority.click();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Tab");
    await expect(priority).toHaveAttribute("aria-expanded", "false");
    await expect(priority).toHaveAttribute("value", "urgent");
    await expect(
      page.getByRole("combobox", { name: "Estado", exact: true }),
    ).toBeFocused();
    await priority.click();
    await page
      .getByRole("heading", { name: "Crear ticket", exact: true })
      .click();
    await expect(priority).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate("globalThis.mutations")).toBe(0);
  } finally {
    await context.close();
  }
});

// biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature.
test("editable destinations filter in one input, cancel free text and support keyboard", async ({}, info) => {
  const { context, page, requests } = await fixture();
  try {
    const project = page.getByRole("combobox", {
      name: "Proyecto",
      exact: true,
    });
    const epic = page.getByRole("combobox", { name: "Epic", exact: true });
    await expect(project).toHaveAttribute("aria-autocomplete", "list");
    await project.fill("ALP");
    await expect(page.getByRole("option")).toHaveText(["Alpha"]);
    await page.keyboard.press("Enter");
    await expect(project).toHaveValue("Alpha");
    await choose(page, "Epic", "1-Primero");
    for (const key of ["Escape", "Tab"]) {
      await epic.fill("texto que no existe");
      await expect(
        page.getByRole("status").filter({ hasText: "Sin resultados" }),
      ).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(epic).toHaveAttribute("data-selected-value", firstEpic);
      await page.keyboard.press(key);
      await expect(epic).toHaveValue("1-Primero");
      await expect(epic).toHaveAttribute("aria-expanded", "false");
    }
    await epic.fill("no existe");
    await page.getByLabel("Título", { exact: true }).click();
    await expect(epic).toHaveValue("1-Primero");
    await epic.click();
    await page.keyboard.type("prim"); // Selected label is replaced, not appended.
    await expect(epic).toHaveValue("prim");
    await page.keyboard.press("Enter");
    await expect(epic).toHaveValue("1-Primero");
    await epic.fill("exténso"); // Accent-insensitive substring, unlike select-only typeahead.
    await expect(page.getByRole("option")).toHaveText([`2-${longTitle}`]);
    await page.keyboard.press("Home");
    await expect(epic).toHaveValue("exténso");
    await page.keyboard.press("Escape");
    await epic.fill("");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(epic).toHaveAttribute("data-selected-value", secondEpic);
    await page
      .getByRole("button", { name: "Mostrar opciones de Epic" })
      .click();
    await expect(
      page.getByRole("listbox", { name: "Epic", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Ocultar opciones de Epic" })
      .click();
    await expect(epic).toHaveValue(`2-${longTitle}`);
    await expect(epic).toBeFocused();
    await epic.fill("Sin Epic");
    await page.keyboard.press("Enter");
    await expect(epic).toHaveAttribute("data-selected-value", "");
    for (const width of [320, 400]) {
      await page.setViewportSize({ width, height: 800 });
      await epic.fill("prim");
      await page
        .locator('section[aria-labelledby="composer-heading"]')
        .screenshot({ path: info.outputPath(`search-select-${width}.png`) });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
    }
    await project.fill("bet");
    await page.keyboard.press("Enter");
    await expect(project).toHaveValue("Beta");
    await expect(epic).toHaveValue("Sin Epic");
    expect(await page.evaluate("globalThis.mutations")).toBe(0);
    expect(requests).toEqual([]);
  } finally {
    await context.close();
  }
});

test("late Epic reads cannot overwrite the new project and refresh errors preserve selection", async () => {
  const { context, page } = await fixture();
  try {
    await page.evaluate("globalThis.holdEpics = true");
    await choose(page, "Proyecto", "Alpha");
    await expect(
      page.getByRole("status").filter({ hasText: "Cargando Epics" }),
    ).toBeVisible();
    await choose(page, "Proyecto", "Beta");
    await page.evaluate("globalThis.holdEpics = false");
    await expect(
      page.getByRole("status").filter({ hasText: "Cargando Epics" }),
    ).toHaveCount(0);
    await page.getByRole("combobox", { name: "Epic", exact: true }).click();
    await expect(page.getByRole("option")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await choose(page, "Proyecto", "Alpha");
    await choose(page, "Epic", "1-Primero");
    await page.evaluate("globalThis.failEpics = true");
    await page.getByRole("button", { name: "Actualizar Epics" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Se perdió la conexión",
    );
    await expect(
      page.getByRole("combobox", { name: "Epic", exact: true }),
    ).toHaveAttribute("data-selected-value", firstEpic);
    await page.evaluate("globalThis.failEpics = false");
    await page.getByRole("button", { name: "Actualizar Epics" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(
      page.getByRole("combobox", { name: "Epic", exact: true }),
    ).toHaveAttribute("data-selected-value", firstEpic);
    expect(await page.evaluate("globalThis.mutations")).toBe(0);
  } finally {
    await context.close();
  }
});
