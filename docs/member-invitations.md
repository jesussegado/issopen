# Member invitations and Google verification

Status: implemented for Epic 7 ticket 81. Email delivery is deliberately manual
for the pilot; the Owner copies the private link from Issopen and sends it over a
trusted channel.

## Human flow

1. The Owner opens **Members**, enters the person's Google account email and
   selects one or more projects.
2. Issopen normalizes the address, creates a seven-day invitation and reveals
   its URL once. Resending rotates the secret and immediately invalidates the
   previous URL.
3. The invitee opens the URL. The public page exposes only the workspace name,
   a masked email and invitation state.
4. Redeeming the link claims it once. A new person receives a 15-minute
   provisional session that has no workspace or project access. An existing
   Issopen account must sign in normally before it can claim its invitation.
5. The person explicitly chooses **Verify with Google**. Better Auth binds the
   OAuth result to the current provisional or existing user and requires the
   same verified email. Implicit email-based account linking is disabled.
6. Only after that fresh Google proof does Issopen create the `member`
   workspace membership and the selected project allowlist, replace the
   provisional session and open the assigned workspace.

An authenticated claimant may reopen the same URL to resume an interrupted
verification. Anonymous replay, another signed-in user, an expired/revoked link
or an already accepted link is rejected. OAuth by itself never grants a
membership.

## Storage and authorization

- `workspace_invitation` stores only SHA-256 of a 256-bit random token, never
  the raw link. It records expiry, claim, acceptance, revocation and the exact
  provisional session, if any.
- `workspace_invitation_project` binds each planned grant to the same workspace
  through composite foreign keys.
- `workspace_invitation_event` and `membership_event` are protected by
  append-only database triggers. They attribute creation, resend, claim,
  acceptance, project grants and revocation to a human actor.
- `src/server/invitations.ts` is the mutation boundary. Owner REST handlers do
  not write membership rows directly.
- `src/server/human-access.ts` remains authoritative after acceptance. Members
  see only explicitly assigned projects, while Owner-only APIs return `403`.

The invite URL is a bearer secret until it is claimed. Do not put it in logs,
tickets, analytics or Git. Public invitation responses use `Cache-Control:
no-store` and `Referrer-Policy: no-referrer` and never reveal the full email.

## Owner controls and revocation

The **Members** page lists invitations, their state and planned projects. The
Owner can:

- create a fresh link for an unclaimed pending or expired invitation;
- revoke a pending/claimed/expired invitation;
- remove an accepted Member from the workspace.

Revoking a claimed invitation deletes only its provisional session. It never
terminates unrelated sessions of a pre-existing account. Removing a Member
deletes the membership and project grants, terminates all human sessions for
that user, revokes their Issopen OAuth access/refresh tokens and disables OAuth
clients owned by them. Historical audit rows remain.

## Failure and recovery

- Lost or leaked unclaimed link: use **Create new link**; the old token stops
  resolving.
- Claimed by the wrong browser/account: revoke it and issue a new invitation.
- Google unavailable: no membership is created; keep password access for the
  Owner, restore Google and resume with the authenticated invited account.
- Provisional session expired after Google was linked: sign in with that Google
  account, reopen the original link and continue. If the link itself expired,
  the Owner must issue a new one.
- Member access must end: use **Remove access** and verify their old cookie gets
  `401` and assigned projects no longer appear.

## Migration and rollback

Migration `0018_steady_ironclad` is additive. Before production rollout, take
the normal PostgreSQL backup. A binary rollback leaves the invitation tables
and audit triggers in place; an older binary ignores them. Do not delete the
tables or membership rows during a routine rollback. If a rollout is stopped,
disable Google login and revoke unfinished invitations from the last compatible
version.

Automated integration coverage proves normalization, hash-only storage, masked
inspection, expiry, token rotation, anonymous replay denial, existing-account
collision denial, explicit fresh Google proof, project isolation, revocation,
session invalidation and immutable audit events. Final acceptance still uses a
real second Google account after production OAuth is configured by ticket 79.
