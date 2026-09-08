import { describe, expect, it } from "vitest";
import {
  contextIsCurrent,
  contextStamp,
  renderGsdContext,
} from "../skills/issopen/scripts/context.mjs";

describe("derived GSD context", () => {
  const detail = {
    issue: {
      id: "ticket",
      projectId: "project",
      epicId: "epic",
      version: 4,
      description: "Canonical technical plan",
    },
    questions: [
      {
        id: "q1",
        version: 2,
        answeredAt: "2026-09-09T00:00:00Z",
        answerOtherText: "Keep existing UI",
      },
    ],
  };
  const epic = {
    id: "epic",
    projectId: "project",
    version: 2,
    description: "Canonical order",
  };
  it("can recreate a derived copy without losing canonical decisions", () => {
    const first = renderGsdContext(
      detail,
      epic,
      "https://tracker.example.test",
    );
    expect(
      renderGsdContext(
        structuredClone(detail),
        epic,
        "https://tracker.example.test",
      ),
    ).toBe(first);
    expect(first).toContain("Keep existing UI");
    expect(first).toContain("Canonical technical plan");
    expect(contextIsCurrent(contextStamp(detail, epic), detail, epic)).toBe(
      true,
    );
  });
  it("invalidates a changed answer, a new question and an Epic change independently of issue.version", () => {
    const stamp = contextStamp(detail, epic);
    const changed = structuredClone(detail);
    changed.questions[0].version++;
    changed.questions[0].answerOtherText = "Different UI";
    expect(changed.issue.version).toBe(detail.issue.version);
    expect(contextIsCurrent(stamp, changed, epic)).toBe(false);
    expect(
      contextIsCurrent(
        stamp,
        {
          ...detail,
          questions: [...detail.questions, { id: "q2", version: 1 }],
        },
        epic,
      ),
    ).toBe(false);
    expect(contextIsCurrent(stamp, detail, { ...epic, version: 3 })).toBe(
      false,
    );
  });
  it("refuses missing question context and mismatched project/Epic associations", () => {
    expect(() => contextStamp({ issue: detail.issue }, epic)).toThrow(
      "Complete authoritative",
    );
    expect(() => contextStamp(detail, { ...epic, projectId: "other" })).toThrow(
      "does not belong",
    );
    expect(() =>
      renderGsdContext(detail, epic, "http://untrusted.test"),
    ).toThrow("HTTPS");
  });
});
