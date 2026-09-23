import type { FormEvent } from "react";
import type { IssueComment } from "../../types.js";
import { CollaboratorPicker } from "../CollaboratorPicker.js";
import { Badge, Button, Field, TextArea } from "../ui.js";
import {
  commentAuthorLabel,
  detailSourceLabels,
  formatDetailTimestamp,
  newestDetailItems,
} from "./presentation.js";

type Mention = { id: string; name: string };

export function CommentsPanel({
  comments,
  body,
  mentions,
  projectId,
  viewerId,
  canEdit,
  online,
  submitting,
  onBodyChange,
  onMentionsChange,
  onSubmit,
}: {
  comments: IssueComment[];
  body: string;
  mentions: Mention[];
  projectId: string;
  viewerId: string;
  canEdit: boolean;
  online: boolean;
  submitting: string | null;
  onBodyChange: (body: string) => void;
  onMentionsChange: (mentions: Mention[]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="detail-panel" aria-labelledby="comments-heading">
      <h2 id="comments-heading">Comments</h2>
      {comments.length === 0 ? (
        <p className="metadata">No comments yet.</p>
      ) : (
        <ol className="comment-list">
          {newestDetailItems(comments).map((comment) => (
            <li
              className={`comment-item comment-${comment.authorType}`}
              key={comment.id}
            >
              <div className="activity-identity">
                <Badge>{commentAuthorLabel(comment, viewerId)}</Badge>
                <Badge>{comment.authorType}</Badge>
                <Badge>{detailSourceLabels[comment.source]}</Badge>
              </div>
              <p className="description">{comment.body}</p>
              {comment.mentions?.length ? (
                <p className="mention-tags">
                  {comment.mentions.map((person) => (
                    <span className="badge" key={person.id}>
                      @{person.name}
                    </span>
                  ))}
                </p>
              ) : null}
              <time className="activity-meta" dateTime={comment.createdAt}>
                {formatDetailTimestamp(comment.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
      {canEdit ? (
        <form className="form-stack" onSubmit={onSubmit}>
          <Field label="Add comment" htmlFor="comment-body" required>
            <TextArea
              id="comment-body"
              disabled={submitting !== null}
              required
              maxLength={20000}
              value={body}
              onChange={(event) => onBodyChange(event.currentTarget.value)}
            />
          </Field>
          <details>
            <summary>Mention people ({mentions.length}/8)</summary>
            <p className="metadata">
              Choose project collaborators to notify. Typing a name in the
              comment alone does not notify or grant access.
            </p>
            <ul className="mention-list">
              {mentions.map((person) => (
                <li key={person.id}>
                  @{person.name}
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={submitting !== null}
                    onClick={() =>
                      onMentionsChange(
                        mentions.filter((item) => item.id !== person.id),
                      )
                    }
                  >
                    Remove mention {person.name}
                  </Button>
                </li>
              ))}
            </ul>
            <CollaboratorPicker
              projectId={projectId}
              disabled={submitting !== null || mentions.length >= 8}
              onChoose={(person) =>
                onMentionsChange(
                  mentions.some((item) => item.id === person.id)
                    ? mentions
                    : [...mentions, { id: person.id, name: person.name }],
                )
              }
            />
          </details>
          <Button type="submit" disabled={!online || submitting !== null}>
            {submitting === "comment" ? "Adding…" : "Add comment"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
