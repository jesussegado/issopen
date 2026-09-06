import { expect, test } from "@playwright/test";
import { runDogfood } from "../../scripts/dogfood.js";
import { e2eBaseUrl, e2eOwner } from "./fixtures.js";

const codeUrl =
  "https://git.example.test/issopen/commit/phase-1-dogfood-result";

test("dogfoods one real Issopen improvement through owner and Codex boundaries", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "The deterministic dogfood dataset is exercised once.",
  );

  const first = await runDogfood({
    baseUrl: e2eBaseUrl,
    ownerEmail: e2eOwner.email,
    ownerPassword: e2eOwner.password,
    codeUrl,
  });
  expect(first.alreadyComplete).toBe(false);
  expect(first.status).toBe("done");
  expect(first.agentId).toBeTruthy();
  expect(JSON.stringify(first)).not.toContain("issopen_pat_");

  const types = first.activity.map((item) => item.type);
  expect(types).toEqual(
    expect.arrayContaining([
      "issue.created",
      "issue.claimed",
      "issue.updated",
      "code_link.added",
      "issue.released",
      "review.changes_requested",
      "review.accepted",
    ]),
  );
  expect(
    first.activity
      .filter((item) => item.actorType === "agent")
      .every((item) => item.actorId === first.agentId && item.source === "mcp"),
  ).toBe(true);
  expect(
    first.activity
      .filter((item) =>
        ["review.changes_requested", "review.accepted"].includes(item.type),
      )
      .every(
        (item) =>
          item.actorType === "human" &&
          item.actorDisplayName === e2eOwner.name &&
          item.source === "rest",
      ),
  ).toBe(true);

  const repeated = await runDogfood({
    baseUrl: e2eBaseUrl,
    ownerEmail: e2eOwner.email,
    ownerPassword: e2eOwner.password,
    codeUrl,
  });
  expect(repeated).toMatchObject({
    alreadyComplete: true,
    projectId: first.projectId,
    issueId: first.issueId,
    issueKey: first.issueKey,
    status: "done",
    agentId: null,
  });
  expect(repeated.activity).toHaveLength(first.activity.length);

  await page.goto("/sign-in");
  await page.getByLabel("Email (required)").fill(e2eOwner.email);
  await page.getByLabel("Password (required)").fill(e2eOwner.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Issopen" }),
  ).toBeHidden();
  await page.goto(`/issues/${first.issueId}`);
  await expect(
    page.getByRole("heading", {
      name: "Make Phase 1 dogfooding reproducible and secret-safe",
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel(`Change status for ${first.issueKey}`),
  ).toHaveValue("done");
  await expect(page.getByText(codeUrl)).toBeVisible();
  await expect(
    page.getByText(`Accepted result for ${first.issueKey}`),
  ).toBeVisible();
  await expect(page.getByText(/Agent · Codex dogfood/).first()).toBeVisible();

  await page.goto("/agents");
  const agentCard = page
    .getByRole("heading", { name: /Codex dogfood/ })
    .locator("xpath=ancestor::article");
  await expect(agentCard.getByText("Revoked", { exact: true })).toBeVisible();
});
