import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AuditEntry,
  type AuditPage,
  auditActions,
} from "../../shared/audit-contract.js";
import { Button, PageHeading, StatusBanner } from "../components/ui.js";
import { apiRequest } from "../lib/api.js";
import { selectedWorkspace } from "../lib/workspace-context.js";

type Filters = { person: string; action: string; from: string; to: string };
const empty: Filters = { person: "", action: "", from: "", to: "" };
function personLabel(person: AuditEntry["actor"]) {
  return (
    person.name ??
    (person.id
      ? `User ${person.id} (historical name not recorded)`
      : "Infrastructure operator")
  );
}
function impact(event: AuditEntry) {
  const c = event.changes,
    items: string[] = [];
  if (c.previousRole || c.nextRole)
    items.push(
      `Workspace role: ${c.previousRole ?? "none"} → ${c.nextRole ?? "none"}`,
    );
  if (c.previousPermission || c.nextPermission)
    items.push(
      `Project permission: ${c.previousPermission ?? "none"} → ${c.nextPermission ?? "none"}`,
    );
  if (c.previousOwner || c.currentOwner)
    items.push(
      `Ownership: ${c.previousOwner ?? "unknown"} → ${c.currentOwner ?? "unknown"}`,
    );
  if (c.formerOwnerRole)
    items.push(
      `Previous Owner is now ${c.formerOwnerRole}, retaining edit access to ${c.retainedProjectCount ?? 0} existing projects.`,
    );
  if (c.credential) items.push(`Local emergency credential ${c.credential}.`);
  if (c.webSessions)
    items.push(
      "All web sessions of the recovered identity were revoked. External Google/MCP/Chrome credentials were not changed.",
    );
  return items;
}
export function AccessAuditRoute({ workspaceId }: { workspaceId: string }) {
  const [draft, setDraft] = useState(empty),
    [filters, setFilters] = useState(empty),
    [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [data, setData] = useState<AuditPage | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const generation = useRef(0),
    mounted = useRef(true);
  const cursor = cursors.at(-1);
  const load = useCallback(async () => {
    const version = ++generation.current;
    setBusy(true);
    setError("");
    setData(null);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value) query.set(key, value);
    if (cursor) query.set("cursor", cursor);
    try {
      const result = await apiRequest<AuditPage>(
        `/api/v1/workspace/audit?${query}`,
        { cache: "no-store", headers: { "X-Issopen-Workspace": workspaceId } },
      );
      if (
        mounted.current &&
        version === generation.current &&
        selectedWorkspace() === workspaceId
      )
        setData(result);
    } catch (e) {
      if (mounted.current && version === generation.current)
        setError(e instanceof Error ? e.message : "Audit could not be loaded.");
    } finally {
      if (mounted.current && version === generation.current) setBusy(false);
    }
  }, [workspaceId, filters, cursor]);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, [load]);
  return (
    <div className="page-stack account-page">
      <PageHeading>Access audit</PageHeading>
      <p>
        Workspace administration only. Historical invitations, access changes
        and ownership actions. Personal browser session inventory stays private;
        operator recovery shows only its administrative impact. Times and date
        filters use UTC.
      </p>
      <form
        className="detail-panel form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          setCursors([undefined]);
          setFilters({ ...draft });
        }}
      >
        <label className="field">
          Person name or ID
          <input
            value={draft.person}
            maxLength={120}
            onChange={(e) => setDraft({ ...draft, person: e.target.value })}
          />
        </label>
        <label className="field">
          Action
          <select
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
          >
            <option value="">All actions</option>
            {Object.entries(auditActions).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="button-row">
          <label className="field">
            From date (UTC)
            <input
              type="date"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </label>
          <label className="field">
            Through date (UTC)
            <input
              type="date"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </label>
        </div>
        <div className="button-row">
          <Button type="submit" disabled={busy}>
            Apply filters
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setDraft(empty);
              setFilters({ ...empty });
              setCursors([undefined]);
            }}
          >
            Clear filters
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void load()}
          >
            Refresh audit
          </Button>
        </div>
      </form>
      {error && <StatusBanner error>{error}</StatusBanner>}
      {busy && <p role="status">Loading audit…</p>}
      {data && (
        <>
          <p role="status">
            Page {cursors.length} · {data.events.length} events
          </p>
          {!data.events.length && <p>No events match these filters.</p>}
          {data.events.map((event) => (
            <article
              className="detail-panel form-stack audit-event"
              key={`${event.source}:${event.id}`}
            >
              <h2>
                {auditActions[event.type as keyof typeof auditActions] ??
                  event.type}
              </h2>
              <time dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleString(undefined, {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </time>
              <dl className="metadata-list">
                <div>
                  <dt>Actor</dt>
                  <dd>{personLabel(event.actor)}</dd>
                </div>
                <div>
                  <dt>Subject</dt>
                  <dd>
                    {event.subject.kind === "invitation"
                      ? `Invitation ${event.subject.id}`
                      : personLabel(event.subject)}
                  </dd>
                </div>
                {event.projectId && (
                  <div>
                    <dt>Project ID</dt>
                    <dd className="mono">{event.projectId}</dd>
                  </div>
                )}
              </dl>
              <details>
                <summary>Impact and reference</summary>
                <div className="form-stack">
                  <ul>
                    {impact(event).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="mono">
                    Event {event.id} · {event.source}
                  </p>
                  <p className="metadata">
                    Read-only historical record. Later membership/name changes
                    do not rewrite it.
                  </p>
                </div>
              </details>
            </article>
          ))}
          <div className="button-row">
            <Button
              variant="secondary"
              disabled={busy || cursors.length === 1}
              onClick={() => setCursors((stack) => stack.slice(0, -1))}
            >
              Newer events
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !data.nextCursor}
              onClick={() => {
                if (data.nextCursor)
                  setCursors((stack) => [
                    ...stack,
                    data.nextCursor ?? undefined,
                  ]);
              }}
            >
              Older events
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
