# Epic archiving

Epic archiving is a reversible lifecycle action. It removes a completed or
paused container from active planning surfaces without deleting its history or
changing any related ticket.

## User behavior

- **Archive Epic** is available from an active Epic detail and requires an
  explicit confirmation.
- The detail remains on screen after archiving, shows its archived state and
  keeps all related tickets accessible.
- Active board summaries, filters, issue forms and the Chrome extension omit
  archived Epics.
- **Manage Epics → Show archived** reveals archived containers. Their detail
  offers **Restore Epic** without creating a replacement or changing its
  number.
- An existing linked ticket can still change status, be edited, detached or
  moved to an active Epic. A new ticket or a reassignment cannot target an
  archived Epic.

## Storage and consistency

Migration `0016_milky_songbird` adds nullable `epic.archived_at` and an index
over project, archive state and number. Existing rows remain active because the
new value is `NULL`. Archive/restore takes a row lock, checks
`expectedVersion`, updates `archived_at` and `version`, and appends
`epic.archived` or `epic.restored` in the same transaction.

Ticket association checks take a compatible row lock. This serializes a new
association with an archive transition: the ticket is either linked before the
archive commits or rejected after it, never silently attached based on stale
state. Archiving itself never updates or deletes issue rows.

## REST and MCP

`GET /api/v1/projects/:projectId/epics` accepts:

- `archived=active` — default and backward-compatible active list;
- `archived=archived` — archived only;
- `archived=all` — both states, used by the management view.

`PATCH /api/v1/epics/:epicId` accepts `archived: true|false` together with the
usual optional `expectedVersion`. Direct Epic reads continue to work in either
state. A board request for one archived Epic returns not found because archived
Epics are not active filters; the unfiltered board still carries their compact
metadata so existing cards can identify the archived association.

MCP `list_epics` exposes the same `archived` filter and defaults to `active`.
MCP `update_epic` archives or restores using the existing opt-in `epics:write`
scope and idempotency contract. No new permission or destructive tool is added.

## Operations and rollback

Back up PostgreSQL before promotion and verify an isolated restore. The schema
change is additive and requires no data rewrite. Roll back the application by
restoring the previous immutable image digest only after considering that an
older binary ignores `archived_at` and therefore shows archived Epics as active.
Prefer restoring affected Epics before rollback or shipping a forward fix.
Never drop the column or its data as part of an application rollback.
