import { expect, type Page, test } from "@playwright/test";
import { e2eBaseUrl } from "./fixtures.js";

test("two people explicitly confirm ownership, can cancel, and retain the right post-transfer UI", async ({
  page,
  browser,
}, info) => {
  const variant = info.project.name.startsWith("mobile") ? "mobile" : "desktop";
  const memberContext = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 1440, height: 950 },
  });
  const member = await memberContext.newPage();
  async function signIn(target: Page, role: string) {
    await target.goto(`${e2eBaseUrl}/sign-in`);
    await target
      .getByLabel("Email (required)")
      .fill(`ownership-${role}-${variant}@example.test`);
    await target
      .getByLabel("Password (required)")
      .fill("synthetic-member-management-password");
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await target.waitForURL((url) => url.pathname !== "/sign-in");
    await target.goto(`${e2eBaseUrl}/ownership`);
    await expect(target.getByText(/Recent login confirmed/)).toBeVisible();
  }
  try {
    await signIn(page, "owner");
    await signIn(member, "member");
    const name = `Member access ${variant}`;
    async function propose() {
      await page
        .getByRole("button", { name: "Find members", exact: true })
        .click();
      await page
        .getByRole("button", { name: `Managed member ${variant}`, exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Confirm proposal", exact: true }),
      ).toBeDisabled();
      await page.getByLabel("Type workspace name to propose").fill(name);
      await page
        .getByRole("button", { name: "Confirm proposal", exact: true })
        .click();
      await expect(page.getByText(/Proposal sent/)).toBeVisible();
      await member.getByRole("button", { name: "Refresh status" }).click();
      await expect(
        member.getByRole("button", { name: "Accept ownership" }),
      ).toBeVisible();
    }
    await propose();
    await member.getByRole("button", { name: "Cancel proposal" }).click();
    await expect(member.getByText(/Ownership has not changed/)).toBeVisible();
    await page.getByRole("button", { name: "Refresh status" }).click();
    await propose();
    await member
      .getByLabel("Type workspace name to accept")
      .fill("not the name");
    await expect(
      member.getByRole("button", { name: "Accept ownership" }),
    ).toBeDisabled();
    await member.getByLabel("Type workspace name to accept").fill(name);
    await expect(
      member.getByRole("button", { name: "Accept ownership" }),
    ).toBeEnabled();
    await member.screenshot({
      path: `/tmp/issopen-ownership-${variant}.png`,
      fullPage: true,
    });
    expect(
      await member.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await member.getByRole("button", { name: "Accept ownership" }).click();
    await expect(
      member.getByRole("heading", { name: "Propose a new Owner" }),
    ).toBeVisible();
    await expect(member.getByText(/Status: accepted/)).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Propose a new Owner" }),
    ).toHaveCount(0);
    const result = await page.request.get("/api/v1/session");
    expect((await result.json()).workspace.role).toBe("member");
    expect(
      (await (await page.request.get("/api/v1/projects")).json()).projects,
    ).toHaveLength(2);
  } finally {
    await memberContext.close();
  }
});
