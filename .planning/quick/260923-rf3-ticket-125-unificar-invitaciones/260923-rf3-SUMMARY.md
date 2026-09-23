---
phase: quick
plan: 260923-rf3
subsystem: access
status: complete
completed: 2026-09-23
tags:
  - refactor
  - invitations
  - security
requirements:
  - ISSOPEN-125
key_files:
  created:
    - src/server/invitation-primitives.ts
    - tests/unit/invitation-primitives.test.ts
  modified:
    - AGENTS.md
    - src/server/invitations.ts
    - src/server/owner-invitations.ts
    - docs/refactoring-v1.md
commits:
  - 4779b8d
  - gitops:b0e77964
metrics:
  tests_focused: 35
  tests_fast: 205
  tests_integration: 118
  tests_characterization: 78
---

# Quick 260923-rf3: Shared invitation security primitives

Ticket 125 replaces six repeated primitives with a small explicit module while
keeping member and Owner invitation services separate.

## Delivered

- Centralized normalized/masked email, 256-bit token generation, SHA-256 token
  hashing, canonical token validation, seven-day lifetime and lifecycle state.
- Preserved service-specific domain policies, summaries, transactions, events,
  OAuth redemption, errors and endpoint contracts.
- Added deterministic unit coverage for invalid tokens and lifecycle precedence;
  existing PostgreSQL HTTP/Auth suites continue to cover normalization, expiry,
  revocation, re-send rotation, single use, interrupted OAuth and races.
- Corrected the refactor map: unique-violation traversal has only one current
  invitation consumer, so it was not forced into a false shared abstraction.

## Verification

- Focused primitive + HTTP/Auth suites: 3 files, 35 tests PASS.
- `pnpm test`: 45 files, 205 tests PASS.
- `pnpm test:integration`: 22 files, 118 tests PASS.
- `pnpm refactor:check`: lint/types, 78 characterization tests and schema
  drift PASS; Drizzle still sees 42 tables and no migration.
- `pnpm build` and `pnpm test:secrets`: PASS (461 scanned files).
- GitOps: Kustomize render and 140 control-plane tests PASS.

## Production verification

- Image `refactor-invitations-4779b8d` published at immutable digest
  `sha256:d34e85dba7b75b52c16eee090bd3479afdf58a59836d5d511052fcc01e5570a0`.
- GitOps `b0e77964` reconciled `Synced/Healthy` at its exact full revision.
- Deployment has one updated/available replica; pod
  `issopen-5cc96b74dc-cwgb2` is Ready with zero restarts and the exact digest.
- Public `/health/ready` returns `{"status":"ok"}` and `/` returns HTTP 200.
- PostgreSQL and attachment PVCs remain Bound to their previous volume IDs.

## Self-check

PASSED. Source `4779b8d` contains the bounded extraction and executable
coverage. There is no SQL, permission, HTTP or visible product change.
