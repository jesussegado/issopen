import { expect, test } from "@playwright/test";

test("Owner edits member project access with conflict protection and a clear zero-project state", async ({
  page,
  browser,
}, info) => {
  const variant = info.project.name.startsWith("mobile") ? "mobile" : "desktop";
  const name = `Managed member ${variant}`;
  await page.goto("/sign-in");
  await page
    .getByLabel("Email (required)")
    .fill(`access-owner-${variant}@example.test`);
  await page
    .getByLabel("Password (required)")
    .fill("synthetic-member-management-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/sign-in");
  await page.goto("/members");
  await page.getByRole("textbox", { name: "Search members" }).fill(name);
  const edit = page.getByRole("button", { name: `Edit access for ${name}` });
  await edit.click();
  const alpha = page.getByRole("combobox", { name: /Project Alpha/ });
  const beta = page.getByRole("combobox", { name: /Project Beta/ });
  await alpha.selectOption("read");
  await beta.selectOption("edit");
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await expect(page.getByText("Project Alpha: Edit → Read only")).toBeVisible();
  await page.getByRole("button", { name: "Back to editing" }).click();
  await expect(alpha).toHaveValue("read");
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm permission changes" })
    .click();
  await expect(
    page.getByText("Member permissions updated.", { exact: true }),
  ).toBeVisible();
  await expect(edit).toBeEnabled();
  const rows = (await (await page.request.get("/api/v1/members")).json())
    .members;
  const member = rows.find((entry: { name: string }) => entry.name === name);
  expect(member.projectGrants).toHaveLength(2);
  const alphaId = member.projectGrants.find(
    (grant: { permission: string }) => grant.permission === "read",
  ).projectId;
  const memberContext = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
  });
  try {
    expect(
      (
        await memberContext.request.post("/api/auth/sign-in/email", {
          headers: { Origin: "http://127.0.0.1:4173" },
          data: {
            email: `access-member-${variant}@example.test`,
            password: "synthetic-member-management-password",
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await (
          await memberContext.request.get(`/api/v1/projects/${alphaId}`)
        ).json()
      ).project.canEdit,
    ).toBe(false);
    await edit.click();
    await alpha.selectOption("edit");
    // A concurrent Owner tab changes access after this form's snapshot.
    expect(
      (
        await page.request.patch(`/api/v1/members/${member.userId}`, {
          headers: { Origin: "http://127.0.0.1:4173" },
          data: { expectedVersion: member.version, grants: [] },
        })
      ).status(),
    ).toBe(200);
    await page
      .getByRole("button", { name: "Review changes", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm permission changes" })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Member access changed",
    );
    await expect(alpha).toHaveValue("edit");
    await page
      .getByRole("button", {
        name: "Reload current permissions and keep my draft",
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Review changes", exact: true }),
    ).toBeEnabled();
    await alpha.selectOption("none");
    await beta.selectOption("none");
    await expect(
      page.getByText(/No projects: membership stays active/),
    ).toBeVisible();
    // Baseline now already has no projects: do not write a duplicate no-op.
    await expect(
      page.getByRole("button", { name: "Review changes", exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: info.outputPath("member-access-zero.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Cancel editing" }).click();
    await page.getByRole("button", { name: "Refresh members" }).click();
    await expect(
      page.getByText(/No projects assigned · waiting for access/),
    ).toBeVisible();
    expect(
      await (await memberContext.request.get("/api/v1/projects")).json(),
    ).toEqual({ projects: [] });
    expect(
      (await memberContext.request.get("/api/v1/account/sessions")).status(),
    ).toBe(200);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: "Remove access", exact: true })
      .click();
    await expect(edit).toBeEnabled();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Remove access", exact: true })
      .click();
    await expect(edit).toHaveCount(0);
    expect((await memberContext.request.get("/api/v1/session")).status()).toBe(
      200,
    );
    expect((await memberContext.request.get("/api/v1/projects")).status()).toBe(
      404,
    );
  } finally {
    await memberContext.close();
  }
});
