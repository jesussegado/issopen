import { expect, test } from "@playwright/test";
import { e2eBaseUrl, e2eOwner } from "./fixtures.js";

test("two web editors preserve stale drafts and merge explicitly for tickets and Epics", async ({
  page,
  context,
}, testInfo) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email (required)").fill(e2eOwner.email);
  await page.getByLabel("Password (required)").fill(e2eOwner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Issopen" }),
  ).toBeHidden();
  if (
    await page
      .getByRole("heading", { name: "Name your workspace" })
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByRole("button", { name: "Create workspace" }).click();
    await expect(
      page.getByRole("heading", { name: "Name your workspace" }),
    ).toBeHidden();
  }
  const headers = { Origin: e2eBaseUrl };
  const created = await page.request.post("/api/v1/projects", {
    headers,
    data: {
      name: `Conflicts ${testInfo.project.name}`,
      key: testInfo.project.name.startsWith("mobile") ? "CMOBILE" : "CDESKTOP",
    },
  });
  expect(created.ok()).toBe(true);
  const { project } = await created.json();
  for (const kind of ["issues", "epics"]) {
    const response = await page.request.post(
      `/api/v1/projects/${project.id}/${kind}`,
      {
        headers,
        data: { title: `Concurrent ${kind}`, description: "Original" },
      },
    );
    expect(response.ok()).toBe(true);
    const entity = (await response.json())[
      kind === "issues" ? "issue" : "epic"
    ];
    const path = `/${kind}/${entity.id}/edit`;
    await page.goto(path);
    const draft = page.getByRole("textbox", { name: /^Description/ });
    await draft.fill("My unsaved draft");
    const second = await context.newPage();
    await second.goto(path);
    await second
      .getByRole("textbox", { name: /^Description/ })
      .fill("Other editor's saved change");
    const saveLabel = kind === "issues" ? "Save issue" : "Save Epic";
    await second.getByRole("button", { name: saveLabel }).click();
    await expect(second).not.toHaveURL(/\/edit$/);
    await page.getByRole("button", { name: saveLabel }).click();
    await expect(
      page.getByRole("region", { name: "Resolve editing conflict" }),
    ).toBeVisible();
    await expect(draft).toHaveValue("My unsaved draft");
    await page.getByRole("button", { name: "Compare latest version" }).click();
    await expect(
      page.getByText("Other editor's saved change", { exact: true }),
    ).toBeVisible();
    await draft.fill("Other editor's saved change + my merged work");
    await page.screenshot({
      path: testInfo.outputPath(`${kind}-conflict.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "I have merged the changes; keep my draft" })
      .click();
    await page.getByRole("button", { name: saveLabel }).click();
    await expect(page).not.toHaveURL(/\/edit$/);
    const saved = await page.request.get(`/api/v1/${kind}/${entity.id}`);
    expect(
      (await saved.json())[kind === "issues" ? "issue" : "epic"].description,
    ).toBe("Other editor's saved change + my merged work");
    await second.close();
  }
});
