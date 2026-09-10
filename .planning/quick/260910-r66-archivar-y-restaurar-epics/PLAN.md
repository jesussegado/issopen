# Quick plan — Ticket 66: archive and restore Epics

## Goal

Allow an owner or explicitly authorized Epic-writing agent to archive an Epic
reversibly without deleting it, detaching its tickets or hiding those tickets
from their normal workflow.

## Product contract

- Active Epic lists, board filters, new-ticket forms and Chrome destinations
  omit archived Epics by default.
- Manage Epics can reveal archived containers; direct Epic and issue links stay
  readable and visibly identify archived state.
- Archiving never mutates linked issues. Existing issues may continue through
  the workflow or be detached/reassigned, but no new issue may be associated
  with an archived Epic.
- Restore makes the same Epic active again, preserving its ID, number, title,
  description, issue associations and summary.

## Tasks

1. Add nullable `epic.archived_at` through a forward-only migration, indexed
   for project list filtering.
2. Extend the transactional Epic update operation with version-guarded archive
   and restore transitions, explicit activity and assignment guards.
3. Add active/archived/all filters to REST and MCP list contracts while keeping
   active as the backward-compatible default.
4. Add accessible archive confirmation, restore action, archived badges and a
   collapsible archived section in Manage Epics; preserve archived associations
   when editing an existing ticket.
5. Test domain, HTTP, MCP, web and desktop/mobile browser behavior, then run the
   full gate, backup/restore, immutable image and GitOps deployment.

## Invariants

- No Epic, issue, activity or attachment row is deleted.
- Archive/restore and activity are committed in the same transaction.
- Optimistic concurrency prevents a stale page or agent from archiving over a
  newer Epic edit.
- Archived Epics cannot be selected as a destination through REST, MCP, web or
  Chrome, including races with an archive transition.
- Rollback keeps the nullable column and data; an older binary would display
  archived Epics as active, so prefer roll-forward or restore before rollback.
