import { useState } from "react";
import { apiRequest } from "../lib/api.js";
import type { Epic, Issue, IssueQuestion } from "../types.js";
import { Button, StatusBanner } from "./ui.js";

export type CurrentDraftBase = {
  item: Issue | Epic;
  questions: IssueQuestion[];
};

export function ConflictReview({
  url,
  kind,
  onUseBase,
}: {
  url: string;
  kind: "issue" | "epic";
  onUseBase: (value: CurrentDraftBase) => void;
}) {
  const [latest, setLatest] = useState<CurrentDraftBase | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setError(false);
    try {
      const response = await apiRequest<{
        issue: Issue;
        epic: Epic;
        questions?: IssueQuestion[];
      }>(url);
      setLatest({ item: response[kind], questions: response.questions ?? [] });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className="detail-panel form-stack"
      aria-label="Resolve editing conflict"
    >
      <p>
        Your draft has not changed. Compare the saved version and merge any
        changes into your draft before saving again.
      </p>
      <Button type="button" onClick={() => void load()} disabled={loading}>
        {loading ? "Loading…" : "Compare latest version"}
      </Button>
      {error ? (
        <StatusBanner>
          Could not load the latest version. Your draft is preserved.
        </StatusBanner>
      ) : null}
      {latest ? (
        <>
          <h2>
            Saved version {latest.item.version}: {latest.item.title}
          </h2>
          <pre className="whitespace-pre-wrap">{latest.item.description}</pre>
          {latest.questions.length > 0 ? (
            <ul>
              {latest.questions.map((question) => (
                <li key={question.id}>
                  {question.prompt}:{" "}
                  {question.answerOtherText ??
                    question.options.find(
                      (option) => option.id === question.answerOptionId,
                    )?.label ??
                    "Unanswered"}
                </li>
              ))}
            </ul>
          ) : null}
          <Button type="button" onClick={() => onUseBase(latest)}>
            I have merged the changes; keep my draft
          </Button>
        </>
      ) : null}
    </section>
  );
}
