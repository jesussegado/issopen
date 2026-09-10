# Summary — Ticket 66: archive and restore Epics

## Delivered contract

- Epics have a nullable, indexed `archived_at` lifecycle marker. Existing
  installations upgrade with every Epic active.
- Archive and restore are reversible, optimistic-concurrency guarded and emit
  append-only `epic.archived` / `epic.restored` activity in the same
  transaction.
- Existing tickets remain linked and keep their exact workflow status. While
  the parent Epic is archived they are omitted from the board, the active REST
  collection and MCP `list_issues`; direct issue and Epic detail stay readable.
  Restoring the Epic returns them to their original columns. A row-lock guard
  rejects a new association to an archived Epic, including concurrent
  archive/assignment races.
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

## Production promotion

- Source `4ebabcf` was published as
  `registry.serviciosegado.com/issopen:epic-archive-4ebabcf` with immutable OCI
  digest `sha256:f741caa06ef3235f5cde2a70ce1ece87a9273a137715957f10a004d8d4951ed5`.
- GitOps `33ec3938` promoted that exact source revision and digest. Argo CD
  reported `Synced/Healthy`; the resulting pod was Ready with zero restarts.
- The pre-deploy backup `issopen-rKHep2` restored successfully into an
  isolated PostgreSQL 18 instance: 67 issues, 597 activity events, 8 Epics and
  all 10 attachments matched their stored sizes and SHA-256 hashes.
- Production applied migration 0016 (17 migrations total). PostgreSQL and
  attachment PVC UIDs were unchanged after the rollout.
- An authenticated Chrome smoke checked active/all Epic lists, the archive
  action and the linked-ticket view without mutating a real Epic. The public
  readiness endpoint returned HTTP 200 with HSTS.

## Inherited ticket archive follow-up

- Source `af1e2f7` implements derived ticket visibility without another schema
  migration; ticket rows and statuses are never rewritten.
- GitOps `26fa5c30` promoted
  `registry.serviciosegado.com/issopen:epic-ticket-archive-af1e2f7` at digest
  `sha256:ecc2acf08ba8907e824153830b9811acc74911e865573f155ffd568ba3ad09b7`.
- The fresh complete backup `issopen-QNBmK7` restored in isolated PostgreSQL 18
  with 67 issues, 603 events, 8 Epics, 10 evidence rows, 11 receipts and all 17
  migrations.
- Argo CD reached `Synced/Healthy`; the application pod was Ready with zero
  restarts, both PVC UIDs were unchanged and public readiness returned 200.
- Authenticated Chrome verified the new archive explanation and healthy board
  layout. Production MCP advertises archived-Epic omission on `list_issues`.
  Both checks were read-only because production had no archived Epic.
