# Ticket 104 — live detail with explicit draft reconciliation

Approved decision: refresh automatically unless the user is editing. This is
an independent increment on the currently authorized workspace/project, not
the future multiworkspace or per-project read/edit implementation (108/95).

- Board and detail reuse the existing project SSE invalidation endpoint. No
  private ticket content is transmitted in events. REST remains authoritative.
- Visible tabs reconcile on events, reconnect errors, focus, visibility,
  network recovery and a 30-second fallback. Unmount/scope change aborts reads,
  removes listeners/timers and closes the stream.
- Clean detail refreshes status, questions, comments, links and activity. A
  typed answer, comment, link, review reason or open confirmation protects the
  current snapshot. A banner exposes comparison before explicitly loading new
  data while retaining drafts. No automatic submission or conflict merge.
- Selected questions are retained by ID, not array position. A remotely removed
  question with a draft offers a copy-before-reload warning. Drafts remain in
  memory only, not local storage; navigation/reload does not persist them.
- Response version guards run inside the domain transaction. Web answer saves
  send the question's expectedVersion; reviews send issue expectedVersion and
  the complete questionVersions snapshot. HTTP 409 preserves drafts and asks
  for comparison. Guards are optional for legacy REST callers; this does not
  retroactively protect an old web bundle without guards. Refresh after deploy.
- Reads started before a local mutation are discarded; older versions or
  missing confirmed append-only comments/links cannot roll back the view.
- Each SSE tick rechecks the database session and current project access with
  cookie caching and session refresh disabled. Revoked/expired sessions or
  removed access receive a generic access-lost signal; the stream closes and
  the UI clears private detail. New REST requests independently enforce access.
- The issue/epic edit routes retain their existing explicit conflict handling.
  Character-by-character collaboration, assignment and new permissions are
  not implemented here. Repeat cross-workspace/project-role tests in 107 when
  108/95/101/102 ship.

## Verification and rollout

PostgreSQL HTTP tests cover Owner/Member response conflicts, unchanged activity
on rejection and session/membership revocation with an already open stream.
Web tests cover clean refresh, dirty comparison, question reordering, 409,
offline recovery and listener cleanup. Two independent Chromium sessions test
real live comments and stale answer comparison/retry at 1440 and 360 px.
The complete suite additionally checks MCP/Chrome and existing edit conflicts.

No schema, secret, scope, OAuth or Chrome package change. Deploy the web/API
image through GitOps only, with a full backup and isolated restore first.
Rollback only source/image to the previous healthy revision; preserve both
PVCs, data and schema. A rollback removes these UX/concurrency protections;
refresh clients to avoid mixing old server and new guarded requests.
