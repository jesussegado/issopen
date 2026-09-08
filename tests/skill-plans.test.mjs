import { describe, expect, it } from "vitest";
import { planSections, renderPlan } from "../skills/issopen/scripts/plans.mjs";

describe("complete canonical plan rendering", () => {
  const plan = Object.fromEntries(
    Object.keys(planSections).map((key) => [key, `Content for ${key}`]),
  );
  it("keeps human decisions and technical detail together in the ticket", () => {
    const decision = "Other: conservar la UI existente; pregunta q1 versión 2";
    const result = renderPlan({ ...plan, decisions: decision });
    expect(result).toContain(decision);
    for (const key of Object.keys(planSections).filter(
      (key) => key !== "decisions",
    ))
      expect(result).toContain(plan[key]);
  });
  it("rejects missing acceptance/verification and overflow instead of publishing an incomplete plan", () => {
    expect(() => renderPlan({ ...plan, acceptance: "" })).toThrow("acceptance");
    expect(() => renderPlan({ ...plan, verification: undefined })).toThrow(
      "verification",
    );
    expect(() => renderPlan({ ...plan, design: "x".repeat(50000) })).toThrow(
      "split by functional outcome",
    );
  });
});
