import { describe, expect, it } from "vitest";
import { draftLifetime, validDraft } from "../../lib/draft";

const now = 10000;
const draft = {
  version: 1,
  expiresAt: now + draftLifetime,
  owner: null,
  form: {
    projectId: "",
    epicId: "",
    title: "Draft",
    description: "",
    priority: "medium",
    status: "backlog",
  },
  evidence: null,
  pending: null,
  inline: null,
};
describe("one reviewed draft", () => {
  it("restores only an unexpired bounded versioned draft", () => {
    expect(validDraft(draft, now)).toEqual(draft);
    expect(validDraft(draft, now + draftLifetime)).toBeNull();
    expect(
      validDraft({ ...draft, expiresAt: now + 2 * draftLifetime }, now),
    ).toBeNull();
    expect(validDraft({ ...draft, version: 99 }, now)).toBeNull();
  });
  it("rejects extra original/history/token fields and arbitrary DOM values", () => {
    for (const extra of [
      { original: "private" },
      { history: ["private"] },
      { token: "private" },
    ])
      expect(validDraft({ ...draft, ...extra }, now)).toBeNull();
    expect(
      validDraft(
        {
          ...draft,
          evidence: {
            image: null,
            metadata: {
              mode: "element",
              dom: { html: "<input value=private>" },
            },
          },
        },
        now,
      ),
    ).toBeNull();
  });
});
