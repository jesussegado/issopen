---
id: 260913-u1g
mode: quick
status: complete
date: 2026-09-13
---

# Epic 7 — continuation after human answers

## Work delivered

- Reconciled live answers and submission evidence. Kept human-closed tickets
  untouched; final reread finds 78–83 Done. 84 v14 and 85 v11 are Ready for
  Human Review, no claims, with comments and code links.
- Documented the actual Store submission: 0.6.2, item
  `eohpecaogeelnicbpeedjdganacfknok`, 2026-09-13 19:24 UTC, Pending review,
  Unlisted, automatic publication disabled. No new upload/publication.
- Prepared executable pilot 87 and operations 88 runbooks, linked from the
  tickets. Their real Store acceptance remains pending, not claimed complete.
- Implemented 91: Owner-only delete visibility includes workspace matching;
  owner and human comment/activity attribution use actual identity. Other
  names render as safe text. Member retains legitimate actions; no new grant,
  schema, data migration or Chrome package change.
- Updated the Epic description to replace obsolete planning-time blockers
  with live progress and remaining external checkpoints.

## Commits and artifact

- Source documentation: `e8be86a` (`docs(store): reconcile submission and prepare pilot operations`).
- Source runtime: `be31905c19eaecb031d913f63d10d2b07f980547`.
- GitOps: `b02403355e1e148a2d25887939ee5f41b4eb1694`.
- Image: `registry.serviciosegado.com/issopen:member-detail-be31905@sha256:2439285d63d1cc26814d454db9fd6cafdaa5e4702bbd0b1adc248095d6099e67`.
- Built from exact source `git archive`; ignored credentials and backups were
  not part of the build context. Source and GitOps commits pushed separately.
- Existing detached GitOps checkout fast-forwarded to latest remote main
  before editing, preserving concurrent Laurotech deployments. No unrelated
  changes from the canonical dirty control-plane worktree were published.

## Validation

- `pnpm validate`: lint/typecheck, 98 unit/web, 66 integration, 10 web E2E and
  2 expected skips, Chrome unit tests and 12 Chrome E2E pass.
- Chrome reproducibility: eight build files identical; submitted ZIP hash
  remains `0e9c636c51407797e95697fa5cb1a8d679448d13775c7887161079f2e2fb177b`.
- `pnpm test:compose` passes. Secret scan: 289 files pass.
- Canonical `make validate`: 197 tests pass; optional Ansible/Helm checks
  skipped because tools absent. This is not the legacy GitOps candidate gate.
- Actual GitOps candidate: 134 tests pass, Kustomize renders ten resources,
  descriptor/values/Deployment image references match, diff check passes.
- Complete pre-deploy backup at 19:45:50 UTC, protected outside Git/master.
  Isolated networkless PostgreSQL restore verifies 97 tickets, 809 events,
  13 image evidences and 19 receipts; each image size/hash matches. Test
  container removed; private backup retained. The restore harness initially
  used obsolete column/table names, was corrected, and then passed; this was
  a test-script mismatch, not corruption or a production restore attempt.

## Production result

GitOps `b0240335` Synced/Healthy, observed at 20:00–20:02 UTC. New pod
`issopen-9497946cd-kdvwg` Ready, zero restarts and exact declared digest.
Public `/health/ready` HTTP 200, existing PostgreSQL and both PVC identities
unchanged. The Recreate rollout required no imperative Kubernetes mutation.

An isolated headless Chromium session logged in as the review Member and
read the existing synthetic ticket at 1440 and 360 px. Owner label is truthful;
Delete ticket absent; edit/comment actions remain; own activity reads You;
private image loads; mobile has no horizontal overflow. Exact one-project
allowlist, foreign project/issue 404 and administration 403 pass. Screenshot
visually checked. No real ticket mutation, new extension install, clipboard
read or user-browser interaction; only the new smoke session was signed out.
Owner controls and foreign/null workspace cases passed automated regression.

91 is Ready for Human Review v7, claim null, with source/GitOps links and
complete evidence. 84/85 also have no claims. Epic description v4 matches
current progress; 78–83 were not modified by this task.

## Remaining checkpoints

- 86: user answered Google test account after the local reviewer submission.
  Clarification `bc1536c9-4c81-4f84-8b7c-f0803036e26c` awaits a human answer
  before replacing that access. Preserve current reviewer until a controlled
  replacement is tested; no borrowed publisher/Owner identity.
- 86 also needs actual Google approval and manual Unlisted publication.
- 87 needs the approved/published Store installation and real invited Google
  pilot; existing unpacked tests do not replace it.
- 88 needs pilot evidence and real Store update/recovery acceptance. No
  unnecessary production credential rotation or data deletion was performed.

## Workflow notes

GSD quick was initialized with the installed legacy CLI because the SDK was
absent, as announced. Plan and verification were performed inline without
subagents. No roadmap changes. Live Issopen remains authoritative; these
files contain evidence only, never credentials or synthetic human answers.
