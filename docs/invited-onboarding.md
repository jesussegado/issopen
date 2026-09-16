# Invited onboarding — Epic3 ticket98

Single assigned project opens directly; multiple projects show an explicit chooser
with each read/edit access; zero assigned projects shows a waiting state. Workspace
selection remains separate and per tab (108). Return paths stay on this origin;
scheme-relative, backslash, control characters, encoded path separators and oversized
paths fall back to `/`. An internal path is not authorization: the server revalidates
workspace/project access on every request (95), so foreign links still fail closed.

## Recovery

- New invitation: redeem the one-time private link, then explicitly link the exact
  verified Google address. The provisional session has no workspace permissions.
- Existing account: sign in first; the invitation is retained in the internal
  return path. No implicit account merging or public signup is introduced.
- Wrong Issopen account: explain the mismatch and offer a confirmed sign-out of
  only this browser session. Cancelling never signs out or changes the invitation.
- Google cancellation: return to verification with retry guidance; no activation
  or automatic invitation deletion. Retry still depends on link/session validity.
- Expired/revoked invitation: ask Owner for a new private link, not endless retries.
  If provisional verification expired before linking Google, Owner revokes/reinvites.
- Already accepted: sign into the invited account. Used links cannot onboard someone
  else. A used link is not evidence that the current browser has access.
- Password login remains only for operator-provisioned accounts, including recovery
  and the explicitly retained local Store reviewer. Never invent a member password.

Public invitation inspection, auth responses and invitation/sign-in HTML use
`Cache-Control: no-store`; `Referrer-Policy: no-referrer` applies after response
handlers so auth adapters cannot accidentally replace it. The application adds no
analytics. Do not copy private links into logs/screenshots/tickets; upstream access
logs remain an operator responsibility. Stale inspection/redemption responses do
not navigate to a previously viewed invitation.

## Validation and remaining external gate

16Sep decision: the Owner will perform the Google interaction personally.
Follow the [step-by-step human pilot](google-pilot.md), using another controlled
Google account and a synthetic project. No credentials or private links in tickets.

Isolated tests cover unsafe return paths (while retaining valid consent/MCP paths),
expired/revoked/claimed/accepted links, mismatched account and cancel, late responses,
new provisional/existing account, keyboard/mobile, zero and multiple projects.
Existing integration checks retain verified exact-email acceptance, replay/expiry,
no membership before verification, denied signup and forged Google state. Google
discovery in the start-flow test is now a strict fixture, not a network dependency.
Neither seeded Google accounts nor password browser tests count as real Google OIDC
acceptance. Question1abf3039 in98 requests the authorized invited pilot account and
operator who will complete provider interaction. Until that trial,98 is NOT complete.
No real grants, Owner/Google configuration or Store reviewer are changed by these tests.

## Delivery

No schema, dependency, OAuth scope or Chrome package changes. Back up full DB and
attachments and verify isolated restore; deploy exact source/image via the existing
GitOps app only. Observe actual Argo revision/health and then own-test-session-only
Member smoke at1440/360. Preserve both PVCs. Prefer forward fixes; the previous96
release is schema-compatible but loses onboarding safeguards. Pre96 rollback still
has membership-CAS risks; pre95 ignores read-only grants. No data rollback required.
