import { expect, test } from "@playwright/test";
import { e2eBaseUrl, e2eOwner } from "./fixtures.js";

test("independent browser sessions refresh clean details and explicitly reconcile answer drafts", async ({
  page,
  browser,
}, testInfo) => {
  const headers = { Origin: e2eBaseUrl };
  const credentials = { email: e2eOwner.email, password: e2eOwner.password };
  const login = await page.request.post("/api/auth/sign-in/email", {
    headers,
    data: credentials,
  });
  expect(login.status()).toBe(200);
  await page.goto("/");
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
  const projectResponse = await page.request.post("/api/v1/projects", {
    headers,
    data: {
      name: `Detail ${testInfo.project.name}`,
      key: testInfo.project.name.startsWith("mobile") ? "DLM" : "DLD",
    },
  });
  expect(projectResponse.status()).toBe(201);
  const { project } = await projectResponse.json();
  const issueResponse = await page.request.post(
    `/api/v1/projects/${project.id}/issues`,
    { headers, data: { title: "Live detail fixture" } },
  );
  expect(issueResponse.status()).toBe(201);
  const { issue } = await issueResponse.json();
  const questionResponse = await page.request.post(
    `/api/v1/issues/${issue.id}/questions`,
    {
      headers,
      data: {
        prompt: "What should we deliver?",
        options: [{ label: "Web" }, { label: "Other platform" }],
        recommendedOptionIndex: 0,
        recommendation: "Use the web",
        blocking: false,
      },
    },
  );
  expect(questionResponse.status()).toBe(201);
  const other = await browser.newContext({ baseURL: e2eBaseUrl });
  try {
    expect(
      (
        await other.request.post("/api/auth/sign-in/email", {
          headers,
          data: credentials,
        })
      ).status(),
    ).toBe(200);
    const second = await other.newPage();
    const path = `/issues/${issue.id}`;
    await page.goto(path);
    await second.goto(path);
    await expect(
      page.getByRole("heading", { name: "1-Live detail fixture" }),
    ).toBeVisible();
    await second
      .getByLabel("Add comment (required)")
      .fill("Remote comment received live");
    await second
      .getByRole("button", { name: "Add comment", exact: true })
      .click();
    await expect(
      page.getByText("Remote comment received live", { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByLabel("Other", { exact: true }).check();
    await page.getByLabel("Your answer (required)").fill("My unsaved response");
    await page.getByLabel("Add comment (required)").fill("My unsaved comment");
    await second.getByLabel("Web", { exact: false }).check();
    await second
      .getByRole("button", { name: "Save answer", exact: true })
      .click();
    await expect(
      second.getByText("1 of 1 answered", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Remote changes" }),
    ).toBeVisible({ timeout: 10_000 });
    const conflictResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/answer") &&
        response.request().method() === "PATCH",
    );
    await page
      .getByRole("button", { name: "Save answer", exact: true })
      .click();
    expect((await conflictResponse).status()).toBe(409);
    await expect(page.getByLabel("Your answer (required)")).toHaveValue(
      "My unsaved response",
    );
    await page.getByRole("button", { name: "Compare latest changes" }).click();
    await expect(
      page.getByText("Saved answer: Web", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Load latest changes and keep my drafts" })
      .click();
    await expect(page.getByLabel("Your answer (required)")).toHaveValue(
      "My unsaved response",
    );
    await expect(page.getByLabel("Add comment (required)")).toHaveValue(
      "My unsaved comment",
    );
    await page
      .getByRole("button", { name: "Change answer", exact: true })
      .click();
    await expect(
      page.getByText("Answer changed", { exact: true }),
    ).toBeVisible();
    const finalDetail = await page.request.get(`/api/v1/issues/${issue.id}`);
    expect((await finalDetail.json()).questions[0].answerOtherText).toBe(
      "My unsaved response",
    );
    await page
      .getByRole("button", { name: "Add comment", exact: true })
      .click();
    await expect(
      second.getByText("My unsaved comment", { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
    const dimensions = await page.evaluate(() => ({
      width: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
    await page.screenshot({
      path: `/tmp/issopen-detail-live-${page.viewportSize()?.width}.png`,
      fullPage: true,
    });
  } finally {
    await other.close();
  }
});
