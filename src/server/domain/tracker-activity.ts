import { and, asc, eq, gt, or } from "drizzle-orm";
import { activityEvent } from "../db/schema.js";
import { TrackerCapability, type TrackerDatabase } from "./tracker-support.js";

export type ActivityPageCursor = {
  createdAt: Date;
  id: string;
};

export class TrackerActivityCapability extends TrackerCapability {
  constructor(
    db: TrackerDatabase,
    private readonly getIssue: (
      workspaceId: string,
      issueId: string,
    ) => Promise<unknown>,
  ) {
    super(db);
  }

  async listActivity(workspaceId: string, issueId: string) {
    await this.getIssue(workspaceId, issueId);
    return this.db
      .select()
      .from(activityEvent)
      .where(
        and(
          eq(activityEvent.workspaceId, workspaceId),
          eq(activityEvent.issueId, issueId),
        ),
      )
      .orderBy(asc(activityEvent.createdAt), asc(activityEvent.id));
  }

  async listActivityPage(
    workspaceId: string,
    issueId: string,
    options: { limit: number; after?: ActivityPageCursor },
  ) {
    await this.getIssue(workspaceId, issueId);
    const after = options.after;
    const rows = await this.db
      .select({
        id: activityEvent.id,
        type: activityEvent.type,
        actorType: activityEvent.actorType,
        actorId: activityEvent.actorId,
        actorDisplayName: activityEvent.actorDisplayName,
        source: activityEvent.source,
        summary: activityEvent.summary,
        createdAt: activityEvent.createdAt,
      })
      .from(activityEvent)
      .where(
        and(
          eq(activityEvent.workspaceId, workspaceId),
          eq(activityEvent.issueId, issueId),
          after
            ? or(
                gt(activityEvent.createdAt, after.createdAt),
                and(
                  eq(activityEvent.createdAt, after.createdAt),
                  gt(activityEvent.id, after.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(activityEvent.createdAt), asc(activityEvent.id))
      .limit(options.limit + 1);
    return {
      items: rows.slice(0, options.limit),
      hasMore: rows.length > options.limit,
    };
  }
}
