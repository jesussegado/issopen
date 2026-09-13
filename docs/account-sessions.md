# Own web sessions — ticket 100

Account lists the current signed-in browser first and the other active web
sessions of the same user. Device labels are approximate categories; raw
User-Agent, IP address and bearer tokens are not exposed by this API.
Dates mean creation, session refresh and expiry, not exact last activity.
The list is no-store and bounded to 100 entries; a truncation notice explains
how to see more after closures. Expired sessions are excluded.

## API and authorization

- `GET /api/v1/account/sessions`: current user only; metadata IDs are not tokens.
- `POST /api/v1/account/sessions/:sessionId/revoke`: first resolve the target by
  session ID **and authenticated user ID**, then revoke through Better Auth.
  An unknown/foreign/already-removed ID returns 404 without affecting another
  account. Closing the current session also clears its auth cookies.
- `POST /api/v1/account/sessions/revoke-others`: Better Auth retains the current
  session and closes other active web sessions belonging to its user.
- Both mutations inherit the authenticated same-origin guard; no MCP tool,
  extension endpoint or administrative cross-user action was added.

The web asks for confirmation and explains which browsers must sign in again.
Cancel does not mutate; failed requests remain retryable without showing success.
After successful closure it reloads authoritative data and restores keyboard
focus. A lost response can require refreshing to distinguish a completed closure
from an unavailable target. Revocation is effective on the next request: cookie
caching is explicitly disabled, matching the prior default. Existing credentials,
session expiry settings, user records and memberships are unchanged.

## Scope and multiworkspace

Sessions authenticate an identity, not one workspace. Closing one signs that
browser out across that identity's workspaces. Removing a workspace membership
is a different operation and must not be implemented by globally closing its
user's sessions when multiworkspace ships (108).

Web session closure does not sign out the Google provider, disconnect a Chrome
installation or revoke any agent PAT/OAuth credential. Account links separately
to `/extensions`. The owner chose separate controls; no combined emergency action.

## Verification and delivery

Tests cover own/foreign/expired sessions, no-store/minimal response, missing and
foreign Origin, immediate invalidation, other-session preservation, current cookie
cleanup, Member access and continued Chrome access/refresh after web sign-out.
Component tests cover confirmation/cancel, retries, status and focus; isolated
desktop/mobile Chromium checks use two synthetic browser sessions. Never close
the user's real browser or Google Store review account to test this feature.

No migration, environment variable or extension artifact change. Deployed in
source328a386/GitOps0ac6550d; runtime, restore and production smoke evidence
is recorded in quick260913-x6a (14 September 2026, Europe/Madrid).
Rollback to the preceding app image removes the UI/API but does not resurrect
revoked sessions; users sign in normally. No DB restore is required for that rollback.

Framework behavior inspected in installed Better Auth 1.7.2 and checked against
[session management](https://better-auth.com/docs/concepts/session-management).
The self-service inventory/termination boundary follows the technical guidance in
[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
not a claim of certification.
