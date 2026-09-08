export function currentAnswer(question) {
  if (!question.answeredAt || !Number.isFinite(Date.parse(question.answeredAt)))
    return null;
  const selected = question.options?.find(
    (option) => option.id === question.answerOptionId,
  );
  const other =
    typeof question.answerOtherText === "string"
      ? question.answerOtherText.trim()
      : "";
  if (selected && !other)
    return { kind: "option", optionId: selected.id, text: selected.label };
  if (!question.answerOptionId && other) return { kind: "other", text: other };
  return null;
}

export function questionReview(questions) {
  const items = questions.map((question) => ({
    id: question.id,
    version: question.version,
    answeredAt: question.answeredAt ?? null,
    blocking: question.blocking === true,
    answer: currentAnswer(question),
  }));
  return {
    items,
    answered: items.filter((item) => item.answer !== null).length,
    unansweredBlocking: items.filter(
      (item) => item.blocking && item.answer === null,
    ).length,
  };
}

export function changedQuestionIds(previous, current) {
  const signature = (question) =>
    JSON.stringify([
      question.version,
      question.answeredAt ?? null,
      question.blocking,
      currentAnswer(question),
    ]);
  const before = new Map(
    previous.map((question) => [question.id, signature(question)]),
  );
  const after = new Map(
    current.map((question) => [question.id, signature(question)]),
  );
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((id) => before.get(id) !== after.get(id))
    .sort();
}
