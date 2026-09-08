// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IssueDetailRoute } from "../../src/web/routes/IssueDetailRoute.js";
import type { IssueQuestion } from "../../src/web/types.js";

const timestamp = "2026-09-07T20:00:00.000Z";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockQuestions() {
  let questions: IssueQuestion[] = [0, 1, 2, 3].map((index) => ({
    id: `question-${index}`,
    workspaceId: "workspace-1",
    issueId: "issue-1",
    prompt: `Decision ${index + 1}`,
    recommendation: "Use the web experience.",
    options: [{ id: `option-${index}`, label: "Web", description: "" }],
    recommendedOptionId: `option-${index}`,
    blocking: true,
    answerOptionId: index === 1 ? `option-${index}` : null,
    answerOtherText: null,
    answeredByUserId: index === 1 ? "owner-1" : null,
    answeredAt: index === 1 ? timestamp : null,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  const summary = () => ({
    total: questions.length,
    answered: questions.filter((question) => question.answeredAt).length,
    unansweredBlocking: questions.filter((question) => !question.answeredAt)
      .length,
  });
  const save = vi.fn(async (path: string, init: RequestInit) => {
    const question = questions.find((item) => path.includes(`/${item.id}/`));
    if (!question) throw new Error(`Unexpected question: ${path}`);
    const answer = JSON.parse(String(init.body));
    const saved = {
      ...question,
      answerOptionId: answer.kind === "option" ? answer.optionId : null,
      answerOtherText: answer.kind === "other" ? answer.text : null,
      answeredByUserId: "owner-1",
      answeredAt: timestamp,
      version: question.version + 1,
    };
    questions = questions.map((item) => (item.id === saved.id ? saved : item));
    return json({ question: saved, questionSummary: summary() });
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith("/answer") && init?.method === "PATCH") {
        return save(path, init);
      }
      if (path === "/api/v1/issues/issue-1") {
        return json({
          issue: {
            id: "issue-1",
            projectId: "project-1",
            key: "WEB-1",
            number: 1,
            title: "Answer navigation",
            description: "",
            priority: "medium",
            status: "backlog",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          codeLinks: [],
          comments: [],
          questions,
          questionSummary: summary(),
        });
      }
      if (path.endsWith("/activity")) return json({ activity: [] });
      if (path === "/api/v1/projects/project-1") {
        return json({ project: { id: "project-1", name: "Web", key: "WEB" } });
      }
      throw new Error(`Unexpected request: ${path}`);
    }),
  );
  window.history.replaceState({}, "", "/issues/issue-1");
  return { save };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("automatic question navigation", () => {
  it.each([
    { kind: "option", order: [0, 2, 3] },
    { kind: "other", order: [3, 0, 2] },
  ])(
    "advances after $kind answers, skips answered questions and wraps to pending ones",
    async ({ kind, order }) => {
      const { save } = mockQuestions();
      const user = userEvent.setup();
      render(<IssueDetailRoute issueId="issue-1" />);
      expect(await screen.findByText("Decision 1")).toBeInTheDocument();
      for (let index = 0; index < (order[0] ?? 0); index += 1) {
        await user.click(screen.getByRole("button", { name: "Next" }));
      }

      for (const [position, index] of order.entries()) {
        expect(screen.getByText(`Decision ${index + 1}`)).toBeInTheDocument();
        expect(screen.getByRole("radio", { name: /Web/ })).not.toBeChecked();
        expect(screen.getByRole("radio", { name: "Other" })).not.toBeChecked();
        if (kind === "option") {
          await user.click(screen.getByRole("radio", { name: /Web/ }));
        } else {
          await user.click(screen.getByRole("radio", { name: "Other" }));
          await user.type(
            screen.getByLabelText("Your answer (required)"),
            `Custom answer ${index + 1}`,
          );
        }
        await user.click(screen.getByRole("button", { name: "Save answer" }));
        expect(
          await screen.findByText(`${position + 2} of 4 answered`),
        ).toBeInTheDocument();
        const nextIndex = order[position + 1] ?? index;
        expect(
          screen.getByText(`Decision ${nextIndex + 1}`),
        ).toBeInTheDocument();
      }

      // All answered: stay on the final question and keep editing available.
      expect(
        screen.getByRole("button", { name: "Change answer" }),
      ).toBeEnabled();
      expect(save).toHaveBeenCalledTimes(3);
      await user.click(screen.getByRole("button", { name: "Previous" }));
      expect(
        screen.getByRole("button", { name: "Change answer" }),
      ).toBeEnabled();
    },
  );

  it("keeps the question and draft on save failure and advances only after confirmation", async () => {
    const { save } = mockQuestions();
    let resolveSave: ((response: Response) => void) | undefined;
    save.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<IssueDetailRoute issueId="issue-1" />);
    expect(await screen.findByText("Decision 1")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Web/ }));
    await user.click(screen.getByRole("button", { name: "Save answer" }));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Web/ })).toBeDisabled();
    expect(screen.getByText("Decision 1")).toBeInTheDocument();
    resolveSave?.(json({ error: "Temporarily unavailable" }, 503));
    expect(
      await screen.findByText(/We couldn't save this answer/),
    ).toBeVisible();
    expect(screen.getByText("Decision 1")).toBeInTheDocument();
    expect(screen.getByText("1 of 4 answered")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Web/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Save answer" }));
    expect(await screen.findByText("Decision 3")).toBeInTheDocument();
    expect(screen.getByText("2 of 4 answered")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Web/ })).not.toBeChecked();
  });
});
