---
id: 260913-vul
mode: quick
status: complete
date: 2026-09-13
source_commit: eb4b4e16f4f95a54842bf2f6768badfa7acea621
---

# Epic 3 planning delivered

The owner asked only to define tickets and questions for existing Epic 3,
`c3b6a630-824e-473a-add9-ac41bf63e38c`, in the Issopen project. The Epic initially
had no children. Preserve its invite-only intent and implemented Epic 7 baseline;
do not interpret planning as authorization to implement or deploy.

## Delivered

- Created 14 Backlog tickets, 94–107, via MCP, in the existing Epic.
- Added 20 native blocking questions across 13 tickets. Each has two or three
  options and a recommendation; the native Other input remains available.
  No question answered on the owner's behalf, no claims acquired.
- Each ticket defines baseline, bounded scope, dependencies, acceptance criteria,
  verification, file anchors and exclusions. Validation 107 has no independent
  product question; it checks the decisions from 94–106.
- Updated the Epic description from v1 to v2 with baseline, ticket links,
  answer order and conditional scope. Start with 94 (roles/workspaces), then
  95 (permission scope). Recommendations are not accepted decisions.
- Committed the derived index and AGENTS entry as `eb4b4e1`:
  [collaboration plan](../../../docs/epic-3-collaboration-plan.md).

Coverage: scope, authorization matrix, existing-member access, invitation
delivery, onboarding, profile/directory, own sessions, human assignees,
question/review routing, mentions/notifications, concurrent editing, ownership
recovery, access audit and end-to-end acceptance. Keep Owner/Member and one
workspace as the existing baseline. Additional roles, tenancy, email and web
ownership transfer remain explicit choices, not inferred requirements.

## Inspection and checks

Inspected live project tickets to avoid duplicating Epic 7, board SSE 63,
review policy 68 or Epic 6 agent workflows. Source review confirms no operation
to edit existing-member project grants, a read-only account profile, and no
dedicated human assignee or notification model. See file anchors in the index.

Reread all 14 created issues after adding questions. Snapshot: all v1, Backlog,
claim null; question versions v1, 20 unanswered/blocking, 0 answered. Verified
correct Epic/project and unique titles. The dependency graph is complete,
acyclic and already in execution order. Email delivery only blocks notification
email if selected; existing-detail synchronization and audit can progress
without optional email/transfer implementation.

`git diff --check` and `pnpm test:secrets` PASS (294 scanned files).
No runtime code changed, so app tests, builds, deployments and browser acceptance
were not run or claimed as new evidence. No invitations, emails, accounts,
permission changes, production mutations or Store actions were performed.
Other Epics and human answers remain untouched.

MCP creation idempotency prefix: `epic3-plan-20260913-usr-`; Epic update key:
`epic3-plan-20260913-map`. Do not recreate these tickets. Consult live records
for current answers/versions rather than using this initial snapshot as a lock.

## GSD and handoff

Used GSD Quick inline, with the installed legacy initializer because gsd-sdk
is absent, consistent with prior quick tasks. No subagents, phase completion
or roadmap changes. STATE points to this planning result.

Await owner decisions in Issopen and implementation authorization. Before code,
reread answers, reconcile contradictory choices and refine selected branches.
Do not expand permissions to settle an ambiguity. Keep Store review access
unchanged; Epic 7's external pilot/publication gates are separate from this plan.
