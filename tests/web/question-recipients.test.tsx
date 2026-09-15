// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import {
  QuestionRecipientEditor,
  QuestionRecipientLabel,
} from "../../src/web/components/QuestionRecipientEditor.js";
import type { Issue, IssueQuestion } from "../../src/web/types.js";

const issue = { id: "issue", projectId: "project", version: 1 } as Issue;
const question = {
  id: "question",
  version: 1,
  recipientUserId: null,
  options: [],
} as unknown as IssueQuestion;
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("shows unavailable recipients and keeps a read-only viewer from redirecting them", () => {
  render(
    <QuestionRecipientLabel
      question={{
        ...question,
        recipientUserId: "person",
        recipientName: "Person",
        recipientCanAnswer: false,
      }}
    />,
  );
  expect(screen.getByText(/Recipient can no longer answer/)).toBeVisible();
  render(
    <QuestionRecipientEditor
      issue={issue}
      question={question}
      questions={[question]}
      canEdit={false}
      onDirty={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Change recipient" }),
  ).not.toBeInTheDocument();
});
it("cancel does not write; comparison keeps selection and refreshes the full guard", async () => {
  const fetchMock = vi.fn(
    async (_path: unknown, init?: RequestInit) =>
      new Response(
        JSON.stringify(
          init?.method === "PUT"
            ? { error: "Question changed" }
            : {
                issue: { ...issue, version: 4 },
                questions: [
                  { ...question, version: 3, prompt: "Updated prompt" },
                ],
                questionSummary: {
                  total: 1,
                  answered: 0,
                  unansweredBlocking: 1,
                },
              },
        ),
        { status: init?.method === "PUT" ? 409 : 200 },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(
    <QuestionRecipientEditor
      issue={issue}
      question={question}
      questions={[question]}
      canEdit
      onDirty={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Change recipient" }));
  await user.click(
    screen.getByRole("button", { name: "Cancel recipient change" }),
  );
  expect(fetchMock).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Change recipient" }));
  await user.click(screen.getByRole("button", { name: "Save recipient" }));
  await screen.findByText("Question changed");
  expect(screen.getByRole("button", { name: "Save recipient" })).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Compare current question recipients" }),
  );
  await screen.findByText("Updated prompt");
  await user.click(screen.getByRole("button", { name: "Save recipient" }));
  expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toEqual({
    recipientId: null,
    expectedVersion: 4,
    questionVersions: [{ id: "question", version: 3 }],
  });
});
