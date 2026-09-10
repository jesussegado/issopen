import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { z } from "zod";
import { captureSubmissionSchema } from "../../src/shared/capture-contract.js";
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
    const accountButton = panel.getByRole("button", {
      name: "Tu cuenta",
      exact: true,
    });
    const accountDialog = panel.getByRole("dialog", { name: "Tu cuenta" });
    await expect(accountDialog).toBeHidden();
    await accountButton.click();
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
    await panel.getByRole("button", { name: "Cerrar cuenta" }).click();
    await expect(accountButton).toBeFocused();
    await expect(accountButton).toContainText("Conectada");
    // Create the two containers from the real panel, then exercise a lost reply
    // after the server commit: reloading must preserve the reviewed PNG and key.
    const projectToggle = panel.getByRole("button", {
      name: "Crear proyecto aquí",
      exact: true,
    });
    const epicToggle = panel.getByRole("button", {
      name: "Crear Epic aquí",
      exact: true,
    });
    const shortcuts = panel.getByRole("group", {
      name: "Crear proyecto o Epic",
    });
    await expect(shortcuts).toBeVisible();
    expect(
      await shortcuts.evaluate((el) =>
        Boolean(
          el.compareDocumentPosition(
            document.querySelector('[aria-label="Proyecto"]') as Element,
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      ),
    ).toBe(true);
    await projectToggle.focus();
    await panel.keyboard.press("Enter");
    await expect(projectToggle).toHaveAttribute("aria-expanded", "true");
    await panel
      .getByLabel("Nombre del nuevo proyecto")
      .fill("Chrome capture E2E");
    await epicToggle.click();
    await expect(projectToggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel.getByLabel("Nombre del nuevo proyecto")).toBeHidden();
    await expect(epicToggle).toHaveAttribute("aria-expanded", "true");
    await epicToggle.focus();
    await panel.keyboard.press("Space");
    await expect(epicToggle).toHaveAttribute("aria-expanded", "false");
    await projectToggle.click();
    await expect(panel.getByLabel("Nombre del nuevo proyecto")).toHaveValue(
      "Chrome capture E2E",
    );
    await panel
      .getByRole("button", { name: "Crear proyecto", exact: true })
      .click();
    await expect(
      panel.getByRole("combobox", { name: "Proyecto", exact: true }),
    ).toHaveValue("Chrome capture E2E");
    await epicToggle.click();
    await panel.getByLabel("Título del nuevo Epic").fill("Chrome E2E audit");
    await panel
      .getByRole("button", { name: "Crear Epic", exact: true })
      .click();
    await expect(
      panel.getByRole("combobox", { name: "Epic", exact: true }),
    ).toHaveValue("1-Chrome E2E audit");
    // Real clicks on in-panel options, not selectOption (which skips the popup).
    for (const [name, option] of [
      ["Proyecto", "Chrome capture E2E"],
      ["Epic", "1-Chrome E2E audit"],
    ] as const) {
      const selector = panel.getByRole("combobox", { name, exact: true });
      await selector.fill(option.slice(2));
      await expect(
        panel.getByRole("listbox", { name, exact: true }),
      ).toBeVisible();
      await panel.getByRole("option", { name: option, exact: true }).click();
      await expect(selector).toHaveAttribute("aria-expanded", "false");
    }
    const projectId = await panel
      .getByRole("combobox", { name: "Proyecto", exact: true })
      .getAttribute("data-selected-value");
    const epicId = await panel
      .getByRole("combobox", { name: "Epic", exact: true })
      .getAttribute("data-selected-value");
    const files = await panel.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 80;
      canvas.height = 60;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error();
      return ["black", "red"].map((color) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 80, 60);
        return canvas.toDataURL("image/png");
      });
    });
    await panel.getByLabel("Seleccionar imágenes").setInputFiles(
      files.map((data, index) => ({
        name: `fixture-${index}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(data.split(",")[1] ?? "", "base64"),
      })),
    );
    await expect(panel.getByAltText("Imagen adjunta 2")).toBeVisible();
    await expect(
      panel.getByRole("status").filter({ hasText: "2 imágenes añadidas" }),
    ).toBeVisible();
    await panel
      .getByLabel("Título", { exact: true })
      .fill("Reviewed Chrome E2E capture");
    await panel
      .getByLabel("Descripción", { exact: true })
      .fill("Synthetic evidence only");
    const reviewed = await panel
      .getByAltText("Imagen adjunta 1")
      .getAttribute("src");
    const destination = await panel
      .getByRole("combobox", { name: "Proyecto", exact: true })
      .getAttribute("data-selected-value");
    const epicDestination = await panel
      .getByRole("combobox", { name: "Epic", exact: true })
      .getAttribute("data-selected-value");
    await accountButton.click();
    await expect(
      panel.getByText("Conectado como", { exact: false }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Cerrar cuenta" }).click();
    await expect(panel.getByLabel("Título", { exact: true })).toHaveValue(
      "Reviewed Chrome E2E capture",
    );
    await expect(
      panel.getByRole("textbox", { name: "Descripción", exact: true }),
    ).toHaveValue("Synthetic evidence only");
    await expect(
      panel.getByRole("combobox", { name: "Proyecto", exact: true }),
    ).toHaveAttribute("data-selected-value", destination ?? "");
    await expect(
      panel.getByRole("combobox", { name: "Epic", exact: true }),
    ).toHaveAttribute("data-selected-value", epicDestination ?? "");
    await expect(panel.getByAltText("Imagen adjunta 1")).toHaveAttribute(
      "src",
      reviewed ?? "",
    );
    const worker = context.serviceWorkers()[0];
    if (!worker) throw new Error("Missing extension worker");
    await worker.evaluate(
      `(() => { const original = globalThis.fetch; let lost = false; globalThis.__capturePayloads = []; globalThis.fetch = async (...args) => { if (String(args[0]).endsWith('/captures')) { globalThis.__capturePayloads.push(JSON.parse(args[1].body)); const result = await original(...args); if (!lost && result.ok) { lost = true; throw new TypeError('Synthetic lost reply'); } return result; } return original(...args); }; })()`,
    );
    await panel
      .getByRole("button", { name: "Enviar ticket", exact: true })
      .click();
    await expect(
      panel.getByRole("button", { name: "Reintentar envío", exact: true }),
    ).toBeEnabled();
    for (const name of ["Proyecto", "Epic", "Prioridad", "Estado"])
      await expect(
        panel.getByRole("combobox", { name, exact: true }),
      ).toBeDisabled();
    await panel.reload();
    await expect(accountDialog).toBeHidden();
    await expect(
      panel.getByRole("button", { name: "Reintentar envío", exact: true }),
    ).toBeEnabled();
    for (const name of ["Proyecto", "Epic", "Prioridad", "Estado"])
      await expect(
        panel.getByRole("combobox", { name, exact: true }),
      ).toBeDisabled();
    await expect(panel.getByAltText("Imagen adjunta 1")).toHaveAttribute(
      "src",
      reviewed ?? "",
    );
    await panel
      .getByRole("button", { name: "Reintentar envío", exact: true })
      .click();
    await expect(
      panel.getByText("Ticket creado:", { exact: false }),
    ).toBeVisible();
    const payloads = z
      .array(captureSubmissionSchema)
      .parse(await worker.evaluate("globalThis.__capturePayloads"));
    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toEqual(payloads[1]);
    expect(JSON.stringify(payloads)).not.toContain("PRIVATE-");
    expect(payloads[0]?.projectId).toBe(projectId);
    expect(payloads[0]?.epicId).toBe(epicId);
    expect(payloads[0]?.image).toBeNull();
    expect(payloads[0]?.images).toHaveLength(2);
    expect(payloads[0]?.images?.[0]).toBe(reviewed);
    expect(payloads[0]?.metadata).toBeNull();
    const issueUrl = await panel
      .getByRole("link", { name: "Abrir ticket en Issopen" })
      .getAttribute("href");
    await page.goto(issueUrl ?? "");
    await expect(
      page.getByRole("heading", { name: "Images and evidence (2)" }),
    ).toBeVisible();
    const image = page.getByAltText("Attachment 1 for this issue");
    await expect
      .poll(() =>
        image.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
      )
      .toBe(true);
    const black = await image.evaluate((img: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error();
      ctx.drawImage(img, 0, 0);
      return Array.from(ctx.getImageData(10, 10, 1, 1).data);
    });
    expect(black).toEqual([0, 0, 0, 255]);
    await expect(
      page.getByAltText("Attachment 2 for this issue"),
    ).toBeVisible();
    const secondUrl = await page
      .getByAltText("Attachment 2 for this issue")
      .getAttribute("src");
    const anonymous = await chromium.launch();
    try {
      const guest = await anonymous.newContext();
      expect(
        (await guest.request.get(`${e2eBaseUrl}${secondUrl}`)).status(),
      ).toBe(401);
    } finally {
      await anonymous.close();
    }
    const issues = await context.request.get(
      `${e2eBaseUrl}/api/v1/projects/${projectId}/issues`,
    );
    expect(
      (await issues.json()).issues.filter(
        (i: { title: string }) => i.title === "Reviewed Chrome E2E capture",
      ),
    ).toHaveLength(1);
    await page.goto(`${e2eBaseUrl}/extensions`);
    await expect(
      page.getByRole("button", { name: /Revocar Issopen Chrome/ }),
    ).toBeVisible();
    await accountButton.click();
    await panel
      .getByRole("button", { name: "Desconectar esta instalación" })
      .click();
    await expect(
      panel.getByRole("button", { name: "Conectar con Issopen" }),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Cerrar cuenta" }).click();
    await expect(accountButton).toContainText("Sin conectar");
    await page.reload();
    await expect(
      page.getByText("Revocada o caducada", { exact: false }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
