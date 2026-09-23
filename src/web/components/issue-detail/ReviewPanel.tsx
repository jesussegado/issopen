import type { FormEvent } from "react";
import { Button, Field, StatusBanner, TextArea } from "../ui.js";

export function ReviewPanel({
  linkCount,
  online,
  submitting,
  requestingChanges,
  reason,
  onAccept,
  onRequestStart,
  onReasonChange,
  onRequestSubmit,
  onCancelRequest,
}: {
  linkCount: number;
  online: boolean;
  submitting: string | null;
  requestingChanges: boolean;
  reason: string;
  onAccept: () => void;
  onRequestStart: () => void;
  onReasonChange: (reason: string) => void;
  onRequestSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelRequest: () => void;
}) {
  return (
    <section className="review-panel" aria-labelledby="review-heading">
      <h2 id="review-heading">Review result</h2>
      {linkCount === 0 ? (
        <StatusBanner>No code result is linked yet.</StatusBanner>
      ) : (
        <p>
          Review the linked result before choosing an outcome. Issopen does not
          verify, merge, or deploy it.
        </p>
      )}
      <div className="inline-actions">
        <Button
          type="button"
          disabled={!online || Boolean(submitting)}
          onClick={onAccept}
        >
          {submitting === "accept" ? "Accepting…" : "Accept result"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!online || Boolean(submitting)}
          onClick={onRequestStart}
        >
          Request changes
        </Button>
      </div>
      {requestingChanges ? (
        <form className="form-stack" onSubmit={onRequestSubmit}>
          <Field label="Reason" htmlFor="review-reason" required>
            <TextArea
              id="review-reason"
              disabled={submitting !== null}
              required
              maxLength={1000}
              value={reason}
              onChange={(event) => onReasonChange(event.currentTarget.value)}
            />
          </Field>
          <div className="inline-actions">
            <Button type="submit" disabled={!online || submitting !== null}>
              {submitting === "request" ? "Requesting…" : "Request changes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={submitting !== null}
              onClick={onCancelRequest}
            >
              Keep reviewing
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
