# Profile and project directory — Epic3 ticket99

People can edit their own display name and optional local avatar in Account.
Changes are explicit Save, with preview/removal/cancel; nothing is uploaded while
preparing an image. The form retains drafts on409 and requires loading the current
profile for comparison before another save. Global name/avatar apply across the
person's workspaces; login email, Google account and stable identity never change.
Existing issue/comment/activity actor snapshots are not rewritten. The shell picks
up the saved display name; older sessions receive it on their next session read.

## Storage and safe image contract

0022 adds optional `user_profile` only: one row per user with opaque UUID version,
current `avatar_png` and update time. No backfill of provider images, new PVC or
storage service. The existing user/name column is updated in the same transaction
as profile/version under a user row lock; first edit expects null version. Concurrent
first or subsequent writes get200/409, never silently replace a newer draft. No-op
does not rotate version. Alternative Better Auth `/update-user` is disabled so it
cannot bypass this version/validation contract; signup stays disabled.

Client accepts one local PNG/JPEG/WebP up to4MiB and8megapixels; rejects SVG/GIF/APNG
and unsupported images. It decodes locally and scales proportionally to128×128.
Server accepts only a canonical RGB/RGBA PNG data URL up to96KiB, checks dimensions
before bounded decompression, verifies CRC/scanlines and removes metadata/tails.
Request body is stream-bounded135000bytes. Names are NFC, trimmed,1–120characters,
no controls/formatting/markup. HTML is always text-rendered. No arbitrary URL fetch
or reuse of `user.image`/provider URLs. DB check bounds stored dataURL length131094.
One bounded avatar in PostgreSQL means full database backup covers it atomically.
Replacing/removing affects the active DB, not previously viewed copies/backups.

## Authenticated API

- GET /api/v1/account/profile returns only own {name,version,avatarPng}; no-store.
- PATCH accepts only {expectedVersion,name,avatarPng}; requires own web session and
  trusted Origin. Own profile remains available with zero assigned projects.
- GET /api/v1/projects/:id/collaborators: current readable existing project only,
  canonical Owner plus explicitly assigned Members; no workspace-wide directory.
  Each row {id,name,role,permission,avatarUrl}; never email, provider IDs, tokens,
  file keys or other-project grants. `q` is literal escaped name substring,max80;
  limit1–50(default25), opaque cursor keyed by project/query/last stable user ID.
  Stable-ID ordering distinguishes equal names and avoids name changes reordering
  pagination. Foreign project404, malformed/filter-mismatched cursor400.
- GET /api/v1/projects/:id/collaborators/:userId/avatar rechecks reader and subject
  membership/project scope. PNG only, private/no-store, nosniff and sandbox CSP.
  Old URLs confer no permission and stop working after grant removal.

`CollaboratorService` is the reusable selection boundary for101/102/103, not an
agent identity list. UI opens from board Collaborators, supports search/pagination,
and revalidates via existing authorized SSE/focus/online/30s helper. Access-lost
clears visible people; already downloaded copies cannot be retroactively erased.
Removing someone does not delete their historical identity or require reactivation.
No new MCP scopes/tools or Chrome permission/package change in99.

## Verification and delivery

Unit/web tests: names, metadata/format/oversize, explicit save/cancel,409 draft and
compare, denied-directory clearing. Integration: same-origin/auth, no target-user
override or auth-endpoint bypass, simultaneous edits, exact privacy projection,
literal search/keyset/filter scope, identical names, foreign/removed access and old
avatar URL, zero-project own account, immutable historical attribution/providers.
Migration test starts at0021, preserves old rows/grants/versions, no imported avatars,
idempotent upgrade and enforced DB bound. Real browser1440/360 tests upload, reload,
conflict/compare, directory PNG and avatar removal using synthetic identities.

Deploy exact source/image through GitOps only after full gates and isolated DB+
attachment restore. Never modify real reviewer/Owner profiles for smoke. Observe
Argo revision/health/readiness and both unchanged PVCs before validation. Previous98
binary ignores profile table; prefer forward fix because its exposed `/update-user`
could change names outside versioning. Preserve DB/profile rows on recovery.
Public inventory1.1 adds local avatar storage and corrects108 workspace-local
revocation; no legal guarantee or Store dashboard operation is part of this change.
