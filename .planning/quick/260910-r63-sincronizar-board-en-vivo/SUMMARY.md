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

## Verification and release

- Web route test exercises an SSE invalidation and preserves an expanded card
  plus a collapsed column.
- REST integration verifies owner authentication, project scoping, initial and
  post-mutation events, and absence of ticket content in the stream.
- Playwright uses two real tabs at 1440 px and 360 px; a ticket created in the
  second appears in the first within five seconds without navigation or reload.
- The complete gate passes: 81 unit/web tests, 54 integration tests, 10 browser
  E2E tests with two expected skips, 76 Chrome unit tests, 12 Chrome E2E tests,
  the Compose restore test and 197 homelab checks.
- Source `65f27202681374a292952777bd9fd972539b94ab` is deployed by GitOps
  `db1f864fb1b6a1af120d495a1aa787875a2a5940` as
  `registry.serviciosegado.com/issopen:board-live-65f2720` with OCI digest
  `sha256:8f26ffdffd4963850d474a86ee1964cd1acf8b8281f6d7313dae8d37f62f5065`.
- Argo CD is `Synced/Healthy`; the application pod is Ready with zero restarts,
  PostgreSQL stayed in place, both PVC UIDs are unchanged and public readiness
  succeeds.
- Backup `.local/backups/issopen-board-live/issopen-iikcKJ` restored into an
  isolated PostgreSQL 18 container without network access: 65 issues, 577
  events, ten evidences, ten receipts and 16 migrations. Every attachment
  matched by size and SHA-256.
- Production SSE rejected anonymous access. The existing authenticated Chrome
  owner session received its initial cursor and a second cursor after a real
  MCP activity mutation. Ticket 63 is Ready for Human Review v6 without an
  active claim.
