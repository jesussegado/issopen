---
type: quick
status: executing
ticket: 96
epic: 3
source_base: 23d789e
---

# 96 — Accepted member access management

Both live questions v2: zero-project membership remains active; remove/reinvite,
not suspension. Reuse108 tenancy and95 central read/edit checks. Inline GSD.

## 1. Guarded membership mutations

Owner-only PATCH accepted member grants (none/read/edit), exact workspace, unique
projects and atomic audit deltas. Opaque version rotates on mutation/reinvitation
to reject stale edits/removal, including remove/rejoin ABA. Lock canonical owner
and target membership; coherent list snapshot. Preserve user/content/history,
other-workspace sessions/Chrome. No implicit grants on project creation.

## 2. Owner management UI

Search members, show role/access, edit individual project permissions, explicit
impact preview and confirmation/cancel. Zero-project state is not removal.
409 preserves the draft, requires explicit reload/reconciliation. No real
membership/reviewer changes. Assignee offboarding indicator integrates in101.

## 3. Validate and deploy

PostgreSQL migration and concurrent/foreign/old-session/token/SSE tests; browser
desktop/mobile management with synthetic accounts. Complete gates, backup and
isolated restore, immutable source/image/GitOps rollout and nonmutating production
smoke. Record evidence before moving96 to human review; continue independent
Epic tickets.97 provider/from question blocks actual email configuration only.
