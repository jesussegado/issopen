---
status: fixing
trigger: "parece que no funciona con google; arreglalo, si intente loguearme antes con google de tener la invitacion lista"
created: 2026-09-16
updated: 2026-09-16
---

## Symptoms

- expected: After opening the private invitation, the invited Google account can be verified and gains only the assigned project access.
- actual: Google returns to the generic sign-in page and the invited account cannot complete onboarding.
- errors: Production emitted `signup_disabled` before the invitation existed, then `account_not_linked` after the invitation was claimed.
- timeline: The first Google sign-in was attempted before the invitation was ready; the invitation was later created and claimed.
- reproduction: Start Google from the public sign-in before onboarding, then claim an invitation and retry from the generic Google button instead of an active invitation-verification session.

## Current Focus

- hypothesis: Confirmed. The safe public-signup guard works, but an interrupted claimed invitation could not recreate its short-lived provisional session, so the user was routed into generic Google sign-in and looped on `account_not_linked`.
- test: A claimed, unaccepted provisional identity can resume only with its private token, no linked provider account and no membership; resumption rotates the provisional session and still requires exact Google verification.
- expecting: Reopening the same private invitation resumes verification without enabling public signup or granting access before Google proves the exact email.
- next_action: Commit, deploy through GitOps and repeat the real Google pilot.
- reasoning_checkpoint: Production health and provider discovery pass; database shows one recent claimed/unaccepted invitation with no Google account or membership.
- tdd_checkpoint: Regression failed before implementation; targeted, full validation, Compose, desktop/mobile E2E and isolated backup restore now pass.

## Evidence

- timestamp: 2026-09-16T17:29:57+02:00
  observation: Generic Google sign-in was correctly rejected with `signup_disabled` before onboarding.
- timestamp: 2026-09-16T17:31:31+02:00
  observation: A new invitation created a provisional user/session and became claimed.
- timestamp: 2026-09-16T17:32:01+02:00
  observation: Subsequent generic Google attempts were rejected with `account_not_linked`; no Google account or membership was created.
- timestamp: 2026-09-16T17:52:20+02:00
  observation: Full validation passed (168 unit/web, 111 integration, 38 web E2E plus 2 expected skips, 16 extension unit and 13 extension E2E); Compose and secret scan passed. Production backup restored in an isolated networkless PostgreSQL container with attachment hashes verified.

## Eliminated

- hypothesis: Google OAuth credentials or Issopen availability are down.
  evidence: `/api/public/auth-providers` reports Google enabled, readiness is OK, and Google callbacks reached Better Auth.
- hypothesis: The failed pre-invitation attempt created an unauthorized member.
  evidence: The provisional user has no provider account and no workspace membership.

## Resolution

- root_cause: A pre-invitation Google attempt was correctly rejected, but a later interrupted invitation had no bounded way to recreate its provisional session. Retrying from generic sign-in cannot implicitly link the provisional identity by design.
- fix: Add private-link recovery for unverified identities with no provider account or membership, rotate the previous provisional session atomically, expose Resume verification and make generic Google errors actionable.
- verification: Local regression, full test suite, desktop/mobile browser tests, Compose, secret scan and isolated backup restore pass. Real Google acceptance remains pending after deployment.
- files_changed: src/server/invitations.ts, src/web/routes/InvitationRoutes.tsx, src/web/routes/PublicRoutes.tsx, tests and invitation documentation.
