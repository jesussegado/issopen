import { expect, test } from "@playwright/test";
import { onboardingPassword, onboardingToken } from "./onboarding-fixture.js";

test("invitation recovery, provisional isolation and project landing work by keyboard", async ({
  page,
}, info) => {
  const variant = info.project.name.startsWith("mobile") ? "mobile" : "desktop";
  for (const state of ["expired", "revoked"]) {
    const response = await page.goto(
      `/invite/${onboardingToken(state, variant)}`,
    );
    expect(response?.headers()["cache-control"]).toBe("no-store");
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
    await expect(
      page.getByText(`This invitation is ${state}`, { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue securely" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Invitation help" }),
    ).toBeVisible();
  }
  await page.goto(`/invite/${onboardingToken("existing", variant)}`);
  await page.getByRole("button", { name: "Continue securely" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/This email already has an Issopen account/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in first" }),
  ).toHaveAttribute(
    "href",
    `/sign-in?returnTo=${encodeURIComponent(`/invite/${onboardingToken("existing", variant)}`)}`,
  );

  await page.goto("/sign-in");
  await page
    .getByLabel("Email (required)")
    .fill(`onboarding-multiple-${variant}@example.test`);
  await page.getByLabel("Password (required)").fill(onboardingPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Choose a project" }),
  ).toBeVisible();
  await expect(page.getByText("Member · read only")).toBeVisible();
  await expect(page.getByText("Member · edit", { exact: true })).toBeVisible();
  await page.goto(`/invite/${onboardingToken("mismatch", variant)}`);
  await page.getByRole("button", { name: "Continue securely" }).click();
  await expect(
    page.getByText(/This Issopen account does not match/),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Switch Issopen account" }).click();
  expect((await page.request.get("/api/v1/session")).ok()).toBe(true);
  await page.request.post("/api/auth/sign-out", {
    headers: { Origin: "http://127.0.0.1:4173" },
    data: {},
  });

  await page.goto(`/invite/${onboardingToken("new", variant)}`);
  await page.getByRole("button", { name: "Continue securely" }).click();
  await expect(
    page.getByRole("heading", { name: "Verify your Google account" }),
  ).toBeVisible();
  expect((await page.request.get("/api/v1/projects")).status()).toBe(404);
  const linkPath = new URL(page.url()).pathname;
  await page.goto(`${linkPath}?google=error`);
  await expect(
    page.getByText(/Your invitation is still available/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verify with Google" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Google verification is not configured yet/),
  ).toBeVisible();
  await page.request.post("/api/auth/sign-out", {
    headers: { Origin: "http://127.0.0.1:4173" },
    data: {},
  });
  await page.goto("/sign-in");
  await page
    .getByLabel("Email (required)")
    .fill(`onboarding-zero-${variant}@example.test`);
  await page.getByLabel("Password (required)").fill(onboardingPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No projects assigned" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
