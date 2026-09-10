import { useRef, useState } from "react";
import { ApiError, apiRequest } from "../lib/api.js";
import { navigate } from "../lib/navigation.js";
import { useOnlineStatus } from "../lib/online.js";
import { type Issue, type IssueQuestion, issueLabel } from "../types.js";
import { Button, StatusBanner } from "./ui.js";

export function DeleteIssueButton({
  issue,
  questions,
  disabled,
}: {
  issue: Issue;
  questions: IssueQuestion[];
  disabled: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const inFlight = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnlineStatus();

  async function remove() {
    if (inFlight.current || !online || disabled) return;
    inFlight.current = true;
    setDeleting(true);
    setError(null);
    try {
      await apiRequest(`/api/v1/issues/${issue.id}`, {
        method: "DELETE",
        body: JSON.stringify({
          expectedVersion: issue.version,
          questionVersions: questions.map(({ id, version }) => ({
            id,
            version,
          })),
        }),
      });
      dialog.current?.close();
      navigate(`/projects/${issue.projectId}?notice=Ticket%20deleted`, true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.status === 409
            ? "This ticket or its questions changed. Cancel, reload and review the latest version before deleting."
            : caught.status === 403
              ? "You don't have permission to delete this ticket."
              : caught.status === 404
                ? "This ticket is no longer available. Cancel and return to the board."
                : "We couldn't confirm the deletion. Try again; retrying won't delete any other ticket."
          : "We couldn't confirm the deletion. Check your connection and retry; no other ticket will be affected.",
      );
    } finally {
      inFlight.current = false;
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        disabled={disabled || !online || deleting}
        onClick={() => {
          setError(null);
          dialog.current?.showModal();
        }}
      >
        Delete ticket
      </Button>
      <dialog
        ref={dialog}
        className="delete-ticket-dialog"
        aria-labelledby="delete-ticket-title"
        aria-describedby="delete-ticket-description"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const buttons =
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            );
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (!first || !last) {
            event.preventDefault();
            return;
          }
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
        onCancel={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
      >
        <h2 id="delete-ticket-title">Delete this ticket?</h2>
        <p className="delete-ticket-name">{issueLabel(issue)}</p>
        <p id="delete-ticket-description">
          It will disappear from the board, its Epic and connected tools.
          History and attachments are retained internally, but won't be
          accessible here. Recovery requires an administrator; there is no undo
          button.
        </p>
        {issue.claimedByAgentId ? (
          <p>
            An agent has claimed this ticket. Deleting it removes the claim, but
            doesn't stop work already running outside Issopen.
          </p>
        ) : null}
        {error ? <StatusBanner error>{error}</StatusBanner> : null}
        {!online ? (
          <StatusBanner error>
            You are offline. Reconnect before deleting.
          </StatusBanner>
        ) : null}
        <div className="delete-ticket-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={deleting}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting || disabled || !online}
            onClick={() => void remove()}
          >
            {deleting ? "Deleting…" : "Confirm deletion"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
