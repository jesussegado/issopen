import { describe, expect, it } from "vitest";
import {
  epicLabel,
  issueActivitySummary,
  issueLabel,
  issueReference,
} from "../../src/web/types.js";

describe("public ticket labels", () => {
  it("uses the same number-title format without brackets or internal keys", () => {
    const ticket = Object.freeze({
      number: 12,
      title: "Check the flow",
      key: "PRIVATE-12",
    });
    expect(epicLabel(ticket)).toBe("12-Check the flow");
    expect(issueLabel(ticket)).toBe("12-Check the flow");
    expect(issueReference(ticket)).toBe("12");
    expect(ticket.key).toBe("PRIVATE-12");
    expect(ticket.title).toBe("Check the flow");
  });

  it("formats historical activity without changing stored text or other references", () => {
    const issue = { number: 1, key: "PRI-1" };
    const summary = "Requested changes for PRI-1: related to PRI-10";
    expect(issueActivitySummary(summary, issue)).toBe(
      "Requested changes for 1: related to PRI-10",
    );
    expect(summary).toBe("Requested changes for PRI-1: related to PRI-10");
    expect(issueActivitySummary("Created PRI-10", issue)).toBe(
      "Created PRI-10",
    );
    expect(issueActivitySummary("Already displayed as [1]", issue)).toBe(
      "Already displayed as [1]",
    );
  });
});
