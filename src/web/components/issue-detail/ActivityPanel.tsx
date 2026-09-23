import type { Activity, Issue } from "../../types.js";
import { issueActivitySummary } from "../../types.js";
import { Badge } from "../ui.js";
import {
  activityActorLabel,
  detailSourceLabels,
  formatDetailTimestamp,
  newestDetailItems,
} from "./presentation.js";

export function ActivityPanel({
  activity,
  issue,
  viewerId,
}: {
  activity: Activity[];
  issue: Issue;
  viewerId: string;
}) {
  return (
    <aside className="activity-panel" aria-labelledby="activity-heading">
      <h2 id="activity-heading">Activity</h2>
      {activity.length === 0 ? (
        <p className="metadata">No activity yet</p>
      ) : (
        <ol className="activity-list">
          {newestDetailItems(activity).map((item) => (
            <li className="activity-item" key={item.id}>
              <p>{issueActivitySummary(item.summary, issue)}</p>
              <div className="activity-identity">
                <Badge>{activityActorLabel(item, viewerId)}</Badge>
                <Badge>{item.actorType}</Badge>
                <Badge>{detailSourceLabels[item.source]}</Badge>
              </div>
              <time className="activity-meta" dateTime={item.createdAt}>
                {formatDetailTimestamp(item.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
