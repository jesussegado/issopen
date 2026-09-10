# Quick plan — Ticket 63: live board synchronization

## Goal

Make an already-open project board reflect tickets and other board-affecting
changes made through the web, Chrome extension or MCP without manual reload.

## Tasks

1. Add an authenticated, project-scoped Server-Sent Events endpoint driven by
   the transactional activity log and safe across all mutation sources.
2. Refetch authoritative board state on an SSE invalidation, reconnection,
   focus, visibility restoration and a low-frequency reconciliation interval.
3. Preserve filters, collapsed columns, expanded cards and focus while applying
   remote changes; ignore stale overlapping responses.
4. Cover authorization, stream invalidation and two-page live behavior; run the
   complete gate, backup/restore, immutable image and GitOps deployment.

## Invariants

- The stream contains only an opaque activity cursor, never ticket content or
  credentials, and is protected by the existing owner session boundary.
- PostgreSQL remains the source of truth; SSE is invalidation, not state.
- Deploy/reconnect gaps are repaired by an immediate authoritative refetch.
- The 30-second fallback reconciliation only runs while the document is visible.
