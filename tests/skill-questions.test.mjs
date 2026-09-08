import { describe, expect, it } from "vitest";
import {
  changedQuestionIds,
  currentAnswer,
  questionReview,
} from "../skills/issopen/scripts/questions.mjs";

describe("current human answers", () => {
  const question = {
    id: "q1",
    version: 1,
    blocking: true,
    options: [
      { id: "a", label: "Recommended" },
      { id: "b", label: "Alternative" },
    ],
    recommendedOptionId: "a",
    answeredAt: null,
    answerOptionId: null,
    answerOtherText: null,
  };
  it("does not treat recommendations or selected-but-unsaved options as answers", () => {
    expect(currentAnswer(question)).toBeNull();
    expect(currentAnswer({ ...question, answerOptionId: "a" })).toBeNull();
    expect(questionReview([question])).toMatchObject({
      answered: 0,
      unansweredBlocking: 1,
    });
  });
  it("honors a saved non-recommended choice and Other, rejecting invalid or empty answers", () => {
    const saved = {
      ...question,
      answeredAt: "2026-09-09T00:00:00Z",
      version: 2,
    };
    expect(currentAnswer({ ...saved, answerOptionId: "b" })).toEqual({
      kind: "option",
      optionId: "b",
      text: "Alternative",
    });
    expect(
      currentAnswer({ ...saved, answerOtherText: "Keep existing UI" }),
    ).toEqual({ kind: "other", text: "Keep existing UI" });
    expect(currentAnswer({ ...saved, answerOptionId: "missing" })).toBeNull();
    expect(currentAnswer({ ...saved, answerOtherText: "  " })).toBeNull();
    expect(
      currentAnswer({
        ...saved,
        answerOptionId: "a",
        answerOtherText: "contradiction",
      }),
    ).toBeNull();
  });
  it("detects revised answers and changed question sets for a requested resume", () => {
    const saved = {
      ...question,
      answeredAt: "2026-09-09T00:00:00Z",
      version: 2,
      answerOtherText: "Keep existing UI",
    };
    expect(changedQuestionIds([question], [saved])).toEqual(["q1"]);
    expect(changedQuestionIds([saved], [saved])).toEqual([]);
    expect(
      changedQuestionIds(
        [saved],
        [
          { ...saved, version: 3, answerOtherText: "Change UI" },
          { ...question, id: "q2" },
        ],
      ),
    ).toEqual(["q1", "q2"]);
    expect(
      questionReview([saved, { ...question, blocking: false }]),
    ).toMatchObject({ answered: 1, unansweredBlocking: 0 });
  });
});
