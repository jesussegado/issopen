import { describe, expect, it } from "vitest";
import {
  issuePriorityValues,
  issueStatusValues,
} from "../../src/server/db/schema.js";
import {
  createProjectSchema,
  issuePrioritySchema,
  issueStatusSchema,
  projectKeySchema,
  repositorySubdirectorySchema,
  repositoryUrlSchema,
} from "../../src/server/domain/index.js";

describe("tracker domain contracts", () => {
  it("publishes exactly five workflow states and four priorities", () => {
    expect(issueStatusValues).toEqual([
      "backlog",
      "ready",
      "in_progress",
      "ready_for_review",
      "done",
    ]);
    expect(issuePriorityValues).toEqual(["low", "medium", "high", "urgent"]);
    expect(issueStatusSchema.safeParse("review").success).toBe(false);
    expect(issuePrioritySchema.safeParse("critical").success).toBe(false);
  });

  it("normalizes bounded project keys and rejects mutable audit input", () => {
    expect(projectKeySchema.parse(" iss ")).toBe("ISS");
    expect(projectKeySchema.safeParse("1ISS").success).toBe(false);
    expect(projectKeySchema.safeParse("ISS-OPEN").success).toBe(false);

    expect(
      createProjectSchema.safeParse({
        name: "Issopen",
        key: "ISS",
        actor: "forged-owner",
      }).success,
    ).toBe(false);
  });

  it("stores only safe bounded repository context without fetching it", () => {
    expect(repositoryUrlSchema.parse("https://example.test/repo.git")).toBe(
      "https://example.test/repo.git",
    );
    expect(repositoryUrlSchema.safeParse("javascript:alert(1)").success).toBe(
      false,
    );
    const credentialUrl = new URL("https://example.test/repo");
    credentialUrl.username = "user";
    credentialUrl.password = "secret";
    expect(
      repositoryUrlSchema.safeParse(credentialUrl.toString()).success,
    ).toBe(false);
    expect(repositorySubdirectorySchema.parse(".")).toBe(".");
    expect(repositorySubdirectorySchema.safeParse("../secrets").success).toBe(
      false,
    );
  });
});
