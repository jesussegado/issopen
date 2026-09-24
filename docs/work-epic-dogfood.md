# Work-Epic controlled dogfood

Date: 2026-09-24. Scope: Issopen Epic 6, project
`65861dda-f5bd-40de-867c-a8cf34842d70`.

## Evidence delivered in the live Epic

The current Codex session used the production MCP identity and the explicit Epic
6 scope to deliver tickets 69 through 75. Every source change had its ticket in
Ready before the edit, was claimed by the active identity, moved through In
Progress, verified, linked to a public Git commit, returned to Ready for Human
Review and released. The commits are:

- 69: `17fcc27` — explicit work-epic scope.
- 70: `c870ed4` — paginated inventory and eligibility.
- 71: `5d41e8d` — semantic plan reconciliation.
- 72: `63133b6` — ticket-first guard and onboarding.
- 73: `4f49971` — iterative execution state machine.
- 74: `5d23651` — blocker handling and independent continuation.
- 75: `f180f69` — checkpoints, resume and safe stop.

The MCP was reread after every mutation. At the end of each ticket its live state
was `ready_for_review`, it had no claim, one matching code link and one evidence
comment. Git confirmed each linked commit on both Forgejo and public GitHub.

## Reproducible fixture

Run:

```bash
pnpm vitest run --root . tests/skill-work-epic-flow.test.mjs --exclude 'dist/**'
```

The fixture starts an explicit session, reads two pages, classifies Ready and
Backlog, reuses one semantic result, plans one missing result, applies the
ticket-first guard, advances a verified ticket through code evidence and human
review, simulates a client restart from a checkpoint and stops with
`no_eligible_work`. Every fixture ticket remains inside its selected Epic.

## Evidence boundaries

This report does **not** claim a new native Codex process was opened, a real
foreign claim was destructively injected, or an authenticated browser visually
confirmed the production board. Those boundaries are covered by deterministic
fixtures and live MCP/Git state, but the final browser/new-session observation is
left for human review. No production ticket was mutated merely to simulate a
failure, duplicate, foreign claim or stale response.
