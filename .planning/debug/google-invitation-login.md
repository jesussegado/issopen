---
status: fixing
trigger: "parece que no funciona con google; arreglalo, si intente loguearme antes con google de tener la invitacion lista"
created: 2026-09-16
updated: 2026-09-17
---

## Symptoms

- expected: After opening the private invitation, the invited Google account can be verified and gains only the assigned project access.
- actual: Google returns to the generic sign-in page and the invited account cannot complete onboarding.
- actual_follow_up: A replacement invitation finds the abandoned provisional identity from the earlier attempt and incorrectly presents "Sign in first", although that identity has no usable sign-in method.
- errors: Production emitted `signup_disabled` before the invitation existed, then `account_not_linked` after the invitation was claimed.
- timeline: The first Google sign-in was attempted before the invitation was ready; the invitation was later created and claimed.
- reproduction: Start Google from the public sign-in before onboarding, then claim an invitation and retry from the generic Google button instead of an active invitation-verification session.

## Current Focus

- hypothesis: Confirmed follow-up. The first recovery fixed a claimed invitation, but a newly issued invitation still treats the abandoned, unverified provisional identity as an established account and asks for a sign-in method that does not exist.
- test: A pending replacement invitation may adopt an existing identity only when it is unverified, has no provider account, membership, instance/workspace ownership or other active claimed invitation. Established accounts must continue to sign in first.
- expecting: The current private invitation advances directly to exact-account Google verification while public signup and implicit account linking remain disabled.
- next_action: Commit and deploy the validated fix, then complete the same private invitation in the live Chrome session.
- reasoning_checkpoint: Production has exactly one recent pending invitation whose matching identity is unverified and has zero accounts, memberships, ownership and competing active claims.
- tdd_checkpoint: The replacement-invitation regression failed with 409 before the fix and now passes. Full validation passes: 168 unit/web, 111 integration, 38 browser tests plus 2 expected skips, 16 extension unit and 13 extension browser tests, reproducible build and secret scan.

## Evidence

- timestamp: 2026-09-16T17:29:57+02:00
  observation: Generic Google sign-in was correctly rejected with `signup_disabled` before onboarding.
- timestamp: 2026-09-16T17:31:31+02:00
  observation: A new invitation created a provisional user/session and became claimed.
- timestamp: 2026-09-16T17:32:01+02:00
  observation: Subsequent generic Google attempts were rejected with `account_not_linked`; no Google account or membership was created.
- timestamp: 2026-09-16T17:52:20+02:00
  observation: Full validation passed (168 unit/web, 111 integration, 38 web E2E plus 2 expected skips, 16 extension unit and 13 extension E2E); Compose and secret scan passed. Production backup restored in an isolated networkless PostgreSQL container with attachment hashes verified.
- timestamp: 2026-09-16T17:58:37+02:00
  observation: Source 847536a and GitOps 100b5a7b are live Synced/Healthy on digest 56ee4502, Ready with zero restarts and both PVC identities preserved. Public desktop/mobile recovery guidance passes; the claimed invitation remains unaccepted, has no membership and is eligible for bounded resume.
- timestamp: 2026-09-17T16:59:00+02:00
  observation: The live Chrome flow reproduces `EXISTING_ACCOUNT_REQUIRES_SIGN_IN` on a new pending invitation. A read-only production check confirms its matching identity is unverified and has no account, membership, instance ownership or competing active claimed invitation.
- timestamp: 2026-09-17T17:07:00+02:00
  observation: The new integration regression failed with 409 before implementation and passes after bounded orphan adoption. Full validation passes (168 unit/web, 111 integration, 38 web E2E plus 2 expected skips, Chrome 16+13, reproducibility and secret scan).
- timestamp: 2026-09-17T17:10:00+02:00
  observation: Compose passes. Fresh production backup is complete and its hashes pass; the actual dump restores in a disposable PostgreSQL 18.6 container with no network or published ports (113 issues, 1059 events, 13 evidence files with matching bytes/SHA-256, 19 receipts).

## Eliminated

- hypothesis: Google OAuth credentials or Issopen availability are down.
  evidence: `/api/public/auth-providers` reports Google enabled, readiness is OK, and Google callbacks reached Better Auth.
- hypothesis: The failed pre-invitation attempt created an unauthorized member.
  evidence: The provisional user has no provider account and no workspace membership.

## Resolution

- root_cause: A pre-invitation Google attempt was correctly rejected. Recovery now works for the same claimed invitation, but a replacement invitation sees the abandoned provisional row through the generic existing-user branch and demands an impossible sign-in.
- fix: Existing private-link recovery is deployed. The follow-up implements bounded adoption for a replacement invitation and requires an unverified identity with no authentication, access, ownership or competing active claim, serialized by identity.
- verification: The first recovery passed local regression, full test suite, desktop/mobile browser tests, Compose, secret scan, isolated backup restore and production health/guidance smoke. Follow-up production verification and real Google acceptance remain pending.
- files_changed: src/server/invitations.ts, src/web/routes/InvitationRoutes.tsx, src/web/routes/PublicRoutes.tsx, tests and invitation documentation.
