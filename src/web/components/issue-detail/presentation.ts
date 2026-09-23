import type { Activity, IssueComment } from "../../types.js";

export const detailSourceLabels: Record<Activity["source"], string> = {
  chrome_extension: "Chrome extension",
  rest: "Web",
  mcp: "MCP",
  system: "System",
  operator: "Operator",
};

export function formatDetailTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function activityActorLabel(activity: Activity, viewerId: string) {
  if (activity.actorType === "human")
    return activity.actorId === viewerId
      ? "You"
      : activity.actorDisplayName || "Workspace member";
  if (activity.actorType === "agent")
    return `Agent · ${activity.actorDisplayName}`;
  return "System";
}

export function commentAuthorLabel(comment: IssueComment, viewerId: string) {
  if (comment.authorType === "human")
    return comment.authorId === viewerId
      ? "You"
      : comment.authorDisplayName || "Workspace member";
  if (comment.authorType === "agent")
    return `Agent · ${comment.authorDisplayName}`;
  return "System";
}

export function newestDetailItems<T extends { id: string; createdAt: string }>(
  items: T[],
) {
  return [...items].sort(
    (left, right) =>
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
}
