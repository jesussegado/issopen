import { expect, test } from "@playwright/test";

test("public agent onboarding exposes a verified package without overflow", async ({
  page,
  request,
}) => {
  await page.goto("/agent-onboarding");
  await expect(
    page.getByRole("heading", { name: "De un enlace a trabajo trazable" }),
  ).toBeVisible();
  await expect(page.locator(".onboarding-release p").first()).toContainText(
    "Skill publicada: 0.2.0",
  );
  await expect(page.getByText(/SHA-256:/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const llms = await request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(await llms.text()).toContain("get_agent_context");
  const archive = await request.get("/downloads/issopen-skill-0.2.0.zip");
  expect(archive.ok()).toBe(true);
  expect(archive.headers()["content-type"]).toMatch(
    /application\/(?:zip|octet-stream)/,
  );
});
