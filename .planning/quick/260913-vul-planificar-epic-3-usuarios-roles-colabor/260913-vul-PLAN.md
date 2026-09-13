---
id: 260913-vul
mode: quick
status: complete
---

# Plan Epic 3 in Issopen, without implementation

User asks to define the needed tickets and questions for Epic 3. Authoritative
Epic c3b6a630-824e-473a-add9-ac41bf63e38c v1 has zero issues. Original intent:
login, users, roles, collaboration, invite-only. Preserve invite-only and the
already implemented Epic 7 baseline (79–83 and 91); no duplicate implementation
of Google OAuth, Owner/Member, base invitations or Member presentation.

## Task 1 — Inspect baseline and design bounded work

- Files: docs/workspace-memberships.md, docs/member-invitations.md,
  src/server/{human-access,invitations}.ts, src/server/http/invitations.ts,
  src/server/db/schema.ts, src/web/routes/{MembersRoute,AccountRoute}.tsx.
- Action: verify capabilities and missing collaboration surfaces; read live
  project tickets to avoid duplicates, including Epic 5 UI and Epic 6 agent loop.
- Verify: baseline versus proposal explicitly separated; no new product scope
  silently selected; questions only for meaningful unresolved decisions.
- Done: topologically ordered ticket outline with acceptance and file anchors.

## Task 2 — Create planning tickets and questions via MCP

- Files: no runtime changes; canonical plan is live Issopen.
- Action: create incremental Backlog tickets in existing Epic 3 with scope,
  dependencies, acceptance, verification, boundaries and recommendations;
  add blocking questions to the affected tickets, not pre-filled human answers.
- Verify: fresh Epic/issue checks, all IDs in correct project/Epic, no duplicate
  titles, complete dependency links, questions/options/recommendations readable.
- Done: Epic description maps baseline and new work, explains answer order and
  gated optional scope. Preserve other Epics, claims, answers and workflow.

## Task 3 — Record handoff

- Files: docs/epic-3-collaboration-plan.md, AGENTS.md, .planning/STATE.md,
  this quick SUMMARY.md.
- Action: keep a derived ticket index and baseline evidence in GSD; no duplicate
  mutable answers. Validate scoped docs, commit/push and report counts/link.
- Verify: reread every created issue and question count; secret/diff checks.
- Done: planning delivered, nothing implemented/deployed or invited/sent.

GSD Quick uses the installed legacy initializer because gsd-sdk is absent,
as in the previous tasks. Execute inline, no agents, no roadmap edits.
