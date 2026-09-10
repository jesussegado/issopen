# Summary — Ticket 63: live board synchronization

## Result

- An authenticated project-scoped SSE endpoint watches the append-only activity
  log and emits only an opaque change cursor. It therefore observes mutations
  from REST, Chrome and MCP without duplicating domain hooks.
- An open board refetches authoritative state after an invalidation, focus,
  network recovery, visibility restoration or a 30-second fallback interval.
- Concurrent loads are ordered: stale responses cannot overwrite newer state,
  while an older successful initial load can still recover if a newer background
  refresh fails.
- Local Epic/status/question filters, collapsed columns and expanded cards are
  preserved because synchronization replaces server data, not presentation
  state. Streams close when the board unmounts.

## Verification before release

- Web route test exercises an SSE invalidation and preserves an expanded card
  plus a collapsed column.
- REST integration verifies owner authentication, project scoping, initial and
  post-mutation events, and absence of ticket content in the stream.
- Playwright uses two real tabs at 1440 px and 360 px; a ticket created in the
  second appears in the first within five seconds without navigation or reload.
- Lint, typecheck and the focused 22 tests pass. Complete gate, backup/restore,
  image publication, GitOps reconciliation and production smoke are recorded
  after the source revision is fixed.
