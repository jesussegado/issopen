---
id: 260913-x6a
mode: quick
status: complete
date: 2026-09-14
---

# Epic 3 — first verified implementation block

## Outcome and scope

Owner requested implementation after answering all20 questions. Read all live
issues/answers and reconciled the contract against selected branches, not
recommendations. Final reread confirms all20 still v2 and answered. No synthetic
human answers or new blocking questions. No existing tickets moved to another Epic.

- 94: approved Owner/Member plus multiple workspaces, separate read/edit grants
  per project, manual-triggered email invitations, avatar, optional assignment,
  directed in-app notifications and protected ownership transfer documented.
- 108: new Backlog ticket for explicit multiworkspace foundation/migration and
  request/tab context before95 and dependent features. Not implemented here.
- 100: safe own-session metadata, current/other/all-other confirmed closures,
  CSRF and cross-user isolation, immediate revocation. Chrome/provider/agents
  remain separate and unchanged; future multiworkspace semantics documented.
- 104: reuse board events; refresh clean detail; protect drafts and compare
  remote changes explicitly. Version guards for question answers and reviews,
  no partial writes/activity on409, selected question byID, stale-read guard,
  network recovery, listener cleanup and session/access revalidation per SSE tick.
- 109: a full-suite failure exposed mobile navigation staying open after a
  project change and intercepting board controls. Created ticket before code;
  route/identity/workspace resets the menu, preserving Escape and focus behavior.

94 v7,100 v9,104 v9,109 v8 are Ready for Human Review with claims released.
All have evidence and source links; runtime tickets also link GitOps. This is
technical delivery, not human acceptance or completion of Epic3. Epic v4 has
16 tickets: four in review, twelve in Backlog. 107 has integration handoff.

## Commits and production artifact

- Contract94: `4df0a0970e3895c18856bf0e5ffe7cb0152ab2ca`.
- Sessions100: `dd5d7774e2271dc06f5ead50edc987fdf5c1a882`.
- Detail104: `79fd7a1`.
- Mobile109 and runtime source: `328a3864aef7485a346f7df92360dd023f7f47ad`.
- GitOps: `0ac6550dac30c8afd7323f3175c674e9dd2155a5`.
- Image: `registry.serviciosegado.com/issopen:epic3-328a386@sha256:aa62231589d8d06ea58625bc3df0036bef7c5979d11243298e20e580963e3736`.

Source commits pushed separately. Image built from exact git archive, not dirty
checkout, and registry digest inspected. Only Issopen's three image/source refs
plus operational documentation committed/pushed from the clean detached GitOps
worktree. Canonical control-plane worktree is divergent/dirty; its unrelated
watchdog/network edits were preserved and not published.

## Verification

- pnpm validate: lint/typecheck,115 unit/web,72 PostgreSQL integration,14 web
  E2E and2 expected desktop-only skips;16 Chrome unit and12 Chrome E2E pass.
- Web E2E at1440/360 use real separate Chromium sessions: live comments, remote
  answer,409, compare/load/retain/retry. Distinct Owner/Member behavior and
  session/membership revocation with an open stream covered by HTTP integration.
- Existing edit-conflict, board, OAuth, MCP and Chrome regressions pass.
- pnpm test:compose passes; secret scan308 files; eight extension build files
  reproducible. Submitted ZIP hash remains
  `0e9c636c51407797e95697fa5cb1a8d679448d13775c7887161079f2e2fb177b`.
- Canonical make validate:197 tests pass. Ansible and Helm unavailable; optional
  checks skipped, not claimed executed. Actual GitOps candidate:134 tests pass,
  Kustomize10 resources, three matching image references and diff check pass.
- Protected full backup at `.local/backups/epic3-first/issopen-fjkYaF` outside
  master/Git. Checksums verified; PostgreSQL18.6 restore without network:
  112 issues,905 events,13 evidences,19 receipts. All image sizes/hashes match.
  Only temporary restore container removed; backup and extracted verification
  copy retained privately. No restore/deletion against production.

The initial complete E2E gate failed because of the mobile overlay with a larger
project list;109 fixed the product, not the click/assertion. Updated test mocks
also assert new expectedVersion payloads; browser tests independently exercise
the real409. Complete gates repeated successfully after fixes.

## Production verification

Observed22:36–22:39UTC on13 September (14 September Europe/Madrid):
GitOps0ac6550d Synced/Healthy/Succeeded; pod `issopen-7fc8d89997-g97tp` Ready,
zero restarts, exact digest; public health/ready200. PostgreSQL unchanged and
PVC identities retained:

- data-issopen-postgres-0 → pvc-cf93e0a7-b978-46c2-9c03-c77f902742b9.
- issopen-attachments → pvc-c40b0035-0433-436f-91c4-feff7a20e754.

An initial50-second wait expired before Argo's normal reconciliation; later
read-only checks verified success. No force-sync or imperative Kubernetes writes.
Only the old terminating pod logged a transient readiness warning during Recreate;
the new pod remained healthy.

Independent headless Member smoke reads the existing synthetic review project:
safe no-store own-session metadata, current label, confirmations/Cancel/Escape,
detail/private attachment at1440/360, closed mobile navigation, foreign project404
and administration403. A second new smoke session revoked only the captured ID
of the first newly created smoke session; its open detail cleared and requests
became401, while the second remained200. Both smoke sessions cleaned up afterward.
No pre-existing user/reviewer session, ticket, installation or access grant was
changed to test the feature. Production screenshots visually inspected. No new
Google/Store action, email, invite, ZIP upload or personal browser manipulation.

## Remaining work

Continue108→95→96/97/98 and remaining profile/assignment/questions/notifications/
transfer/audit. The approved multiworkspace migration and per-project read/edit
permissions are not implemented by the session/detail changes. Revalidate them
together in107, including workspace-local revocation, Chrome installation scope,
MCP unchanged grants and future assignee/question recipient interactions.
No unanswered question currently blocks that next implementation work.

GSD Quick ran via installed legacy initializer because SDK absent; plan/checks
performed inline without subagents, no roadmap phase completion. This summary
completes the bounded first-block plan, not the full Epic.
