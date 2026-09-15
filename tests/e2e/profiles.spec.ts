import { expect, test } from "@playwright/test";
import { syntheticPng } from "../fixtures/png.js";
import { onboardingPassword } from "./onboarding-fixture.js";

test("edits own profile, compares conflicts and shows a private project directory", async ({
  page,
}, info) => {
  const variant = info.project.name.startsWith("mobile") ? "mobile" : "desktop";
  await page.goto("/sign-in");
  await page
    .getByLabel("Email (required)")
    .fill(`onboarding-multiple-${variant}@example.test`);
  await page.getByLabel("Password (required)").fill(onboardingPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a project" }),
  ).toBeVisible();
  const projects = (await (await page.request.get("/api/v1/projects")).json())
    .projects;
  await page.goto("/account");
  const name = page.getByRole("textbox", { name: /Display name/ });
  await expect(name).toHaveValue("Onboarding multiple");
  await name.fill(`Profile member ${variant}`);
  await page.getByLabel("Choose avatar image").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: syntheticPng(true),
  });
  await expect(page.getByAltText("Your avatar preview")).toBeVisible();
  // Before Save, the DB still has no avatar and the old display name.
  const previous = (
    await (await page.request.get("/api/v1/account/profile")).json()
  ).profile;
  expect(previous.avatarPng).toBeNull();
  expect(previous.name).toBe("Onboarding multiple");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByText(/Profile saved. Your login identity/),
  ).toBeVisible();
  await page.reload();
  await expect(name).toHaveValue(`Profile member ${variant}`);
  await expect(page.getByAltText("Your avatar preview")).toBeVisible();
  await name.fill(`Draft from browser ${variant}`);
  const current = (
    await (await page.request.get("/api/v1/account/profile")).json()
  ).profile;
  expect(
    (
      await page.request.patch("/api/v1/account/profile", {
        headers: { Origin: "http://127.0.0.1:4173" },
        data: {
          expectedVersion: current.version,
          name: `Saved elsewhere ${variant}`,
          avatarPng: current.avatarPng,
        },
      })
    ).status(),
  ).toBe(200);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByText(/Your profile changed in another session/),
  ).toBeVisible();
  await expect(name).toHaveValue(`Draft from browser ${variant}`);
  await page
    .getByRole("button", { name: "Load current profile to compare" })
    .click();
  await expect(
    page.getByText(`Saved elsewhere ${variant}`, { exact: true }),
  ).toBeVisible();
  await expect(name).toHaveValue(`Draft from browser ${variant}`);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByText(/Profile saved. Your login identity/),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/issopen-profile-${variant}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto(`/projects/${projects[0].id}`);
  await page.getByRole("link", { name: "Collaborators", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Project collaborators" }),
  ).toBeVisible();
  await expect(
    page
      .locator("#main-content")
      .getByText(`Draft from browser ${variant}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Onboarding owner", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".collaborator-avatar")).toHaveJSProperty(
    "naturalWidth",
    2,
  );
  await page
    .getByRole("textbox", { name: "Search collaborators" })
    .fill("Draft");
  await page.getByRole("button", { name: "Search collaborators" }).click();
  await expect(page.getByText("Onboarding owner", { exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: `/tmp/issopen-collaborators-${variant}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/account");
  await page.getByRole("button", { name: "Remove avatar" }).click();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(
    page.getByText(/Profile saved. Your login identity/),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/v1/account/profile")).json()).profile
      .avatarPng,
  ).toBeNull();
});
