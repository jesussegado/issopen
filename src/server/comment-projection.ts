import { issueComment } from "./db/schema.js";

// Retry identifiers/hashes are internal transport metadata, not ticket content.
export const commentColumns = {
  id: issueComment.id,
  workspaceId: issueComment.workspaceId,
  issueId: issueComment.issueId,
  body: issueComment.body,
  mentions: issueComment.mentions,
  authorType: issueComment.authorType,
  authorId: issueComment.authorId,
  authorDisplayName: issueComment.authorDisplayName,
  source: issueComment.source,
  createdAt: issueComment.createdAt,
};
export function publicComment(comment: typeof issueComment.$inferSelect) {
  return {
    id: comment.id,
    workspaceId: comment.workspaceId,
    issueId: comment.issueId,
    body: comment.body,
    mentions: comment.mentions,
    authorType: comment.authorType,
    authorId: comment.authorId,
    authorDisplayName: comment.authorDisplayName,
    source: comment.source,
    createdAt: comment.createdAt,
  };
}
