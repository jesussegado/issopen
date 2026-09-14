---
type: quick
status: complete
ticket: 108
epic: 3
source_base: ff95c2c
---

# 108 — Multiworkspace foundation

User mandate: continue Epic 3 until all feasible tickets are ready or genuinely
blocked. This plan is the first atomic increment, not a stopping checkpoint.
Canonical decisions: live Epic 3, 94/95 answers v2 and
docs/epic-3-collaboration-plan.md. No new product decisions needed.

## 1. Context and storage

Files: schema/migration, human-access, app/auth, invitations, extensions, owner.
Action: preserve existing rows and permissions; select membership explicitly per
request, deny invalid/ambiguous context; accept additional verified invitations;
keep Chrome/MCP bound to their workspace and removal local. Recovery must reject
ambiguity. No public workspace creation or grants by selection.
Verify: real PostgreSQL migration, cross-workspace authorization, invitation,
revocation and existing Chrome/MCP integration tests.
Done: multiple memberships safe without changing single-membership behavior.

## 2. Per-tab navigation

Files: web API/session, Shell, routes, live streams, tests/web and tests/e2e.
Action: own workspace selector, tab-local explicit context on requests and SSE,
draft confirmation, no remote state leakage across tabs or workspace switches.
Verify: two-tab contexts, invalid selection, drafts, account global sessions,
mobile navigation, existing tracker regression.
Done: visible and accessible workspace selection matches effective server context.

## 3. Verify, release and continue

Files: tests/docs, source AGENTS, STATE, scoped GitOps release descriptors.
Action: full quality gates; isolated backup/restore before migration; immutable
source/image/GitOps release, smoke without altering real memberships/reviewer.
Record evidence and Ready for Human Review only after acceptance criteria pass.
Next: 95 permissions, 96 management, 97 invitations, 98 onboarding, 99 profile,
101 assignment, 102 recipients, 103 notifications, 105 transfer, 106 audit, 107
acceptance. Add questions for genuine provider/human blockers and continue the
independent tickets. Never substitute backlog dependency for a human blocker.
Verify: pnpm validate, Compose, secret scan, platform checks, Argo/readiness/PVCs.
Done: 108 tested/deployed, ticket linked, next ticket plan started.

## Safety

Use installed legacy gsd-tools init because gsd-sdk is unavailable; inline work,
no delegated agents. Preserve dirty unrelated GitOps files. Migration forward-only;
old monoworkspace binary unsafe after multiple memberships, prefer roll-forward.
No DNS, Google, Store, real email, invitations or reviewer changes in this task.
