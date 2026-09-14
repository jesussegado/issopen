# Accepted member access — Epic3 ticket96

The Owner can search Members and edit explicit grants in Members and invitations.
Each project is No access / Read only / Edit. Workspace role stays Member; Owner
cannot be removed or downgraded here. A new project grants no implicit access.
Zero projects retains the membership and own-account access with an explanatory
waiting state. Removal is separate and reinvitation explicit; no suspension state.
This increment edits accepted memberships; initial invitation creation still
requires at least one project under the existing invitation contract.

## API and concurrency

GET /api/v1/members is Owner-only, with one repeatable-read snapshot for members,
versions and grants. Each member exposes version (opaque UUID) and projectGrants
[{projectId,permission:read|edit}]; projectIds remains for compatibility.
PATCH /api/v1/members/:userId accepts only {expectedVersion,grants}, max100 unique
project IDs. DELETE requires {expectedVersion}. Invalid input400, foreign404,
ordinary Member/Owner target403, stale version409. No automatic stale retry.
Both operations lock the canonical workspace Owner and target membership, validate
within the exact workspace, and write permission deltas/audit/version atomically.
Unchanged grants preserve their timestamps; no-op edits produce no new audit.

0021 adds random membership versions and nullable previous/next_permission audit
fields. Existing identities/roles/grants/history remain unchanged. New membership
after remove/reinvite has a different version, so a stale pre-removal UI cannot
change/remove it (ABA protection). HTTP never omits the version. The trusted local
recovery operator may call the internal method without one only within its own
explicit confirmation; canonical Owner authorization is still rechecked.

UI previews exact access changes before confirmation; cancel never mutates.
409 retains the proposed selection, requires explicit reload, compares it with
the current baseline and asks for confirmation again. A revoked/changed-role
membership cannot be saved from that form. Removal separately explains scope.

## Boundaries and evidence

95 policy revalidates next REST/Chrome request and existing SSE streams. A granted
project becomes readable/editable immediately; removed project is404, downgraded
write403, Chrome only offers editable destinations and refreshed tokens honor it.
Removing membership disables only its workspace-bound Chrome grants. Other spaces,
global web sessions, users, tickets, comments and historical actor snapshots remain.
101 will layer assignment/offboarding indicators over these retained identities;
106 renders the administrative audit. No real grants/reviewer/Store actions used
for implementation or verification. Store0.6.2 and developmentChrome0.6.3 unaffected.

Tests cover Owner/Member/foreign target, duplicate/invalid grants, concurrent
updates, stale removal/rejoin, no implicit new project, zero-project account,
old cookie/token/refresh/SSE, attribution after removal, migration preservation,
confirmation/cancel/conflict/draft and real desktop/mobile Owner workflow.
Tests use isolated PostgreSQL and synthetic identities only.

2026-09-14 gate:126 unit/web,80 integration,20 web E2E+2 expected skips,
16 Chrome unit/13 E2E, reproducible development0.6.3, secret scan329 andComposePASS.
Backup .local/backups/epic3-member-access/issopen-Qsoa0S restored in isolated
PostgreSQL18.6/network none:113issues951events13matchingimages19receipts.

## Deployment and recovery

Back up full DB and attachments and verify an isolated restore before0021.
Preserve both existing PVCs. Deploy immutable source/image via GitOps; observe
Argo revision/digest/health, readiness200, then isolated Member smoke without
changing real access. Old tabs must reload to obtain versioned members before
removal. Prefer forward fix; a pre96 binary can mutate memberships without rotating
the version, invalidating concurrency assumptions. Pre95 also ignores read-only
grants and pre108 is not multiworkspace-safe. Do not roll back by dropping data.
