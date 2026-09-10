# Summary — Ticket 66: archive and restore Epics

## Delivered contract

- Epics have a nullable, indexed `archived_at` lifecycle marker. Existing
  installations upgrade with every Epic active.
- Archive and restore are reversible, optimistic-concurrency guarded and emit
  append-only `epic.archived` / `epic.restored` activity in the same
  transaction.
- Existing tickets remain linked and usable. A row-lock guard rejects a new
  association to an archived Epic, including concurrent archive/assignment
  races.
- REST and MCP lists default to active Epics and accept active, archived or all
  explicitly. MCP reuses the existing opt-in `epics:write` scope and
  idempotency contract.
- Board, issue forms and Chrome omit archived destinations. Direct Epic/issue
  views retain context, and Manage Epics reveals archived containers for
  restoration.
- The web provides a keyboard-accessible confirmation before archive and a
  direct restore action.

## Verification

- `pnpm validate`: passed, including lint, typecheck, 82 unit tests, 56
  integration tests, 10 web E2E cases across desktop/mobile (2 skipped by
  design), 76 Chrome unit tests, 12 Chrome E2E cases, reproducible extension
  build and secret scans.
- `pnpm test:compose`: passed.
- Upgrade coverage asserts `archived_at IS NULL` for old Epic rows while
  preserving all previous fields and ticket links.
- Browser E2E archives an Epic with a linked Done ticket, confirms it is
  absent from active destinations, reveals it in Manage Epics and restores it
  without losing the ticket.

Production backup/restore, immutable image and GitOps evidence are recorded in
the release documentation after promotion.
