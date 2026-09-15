# Workspace ownership —105

Protected web transfer at `/ownership`: current Owner proposes a verified Member;
both type the exact workspace name and explicitly confirm. Ordinary membership
editing and invitation acceptance never transfer ownership. Real Owner/reviewer
are not transferred, recovered or granted access for testing.

## Authentication and consent

Both people sign out/sign in within5minutes of acceptance. Keep the proposing
Owner session open; recipient refreshes status to see a proposal. Expiry is checked
on server, no job or automatic transfer. `authentication_assurance` is recorded
only by Better Auth's successful session.create.after hook for password sign-in
or verified Google callbacks; never session refresh, invitation acceptance, account
linking or caller-provided dates. Existing sessions must sign in again.

Google may reuse an existing Google session: this is recent provider authentication,
**not forced password entry or MFA**. Password/browser fixtures do not establish
real Google pilot acceptance, still tracked in98.

Proposal binds Owner's consenting session, both user IDs, exact workspace version
and target membership version. Logout/revocation, changed grants/removal,
cancellation, expiry and concurrent ownership changes reject acceptance. One
transfer cannot complete twice. Proposal retries bind request ID to exact inputs;
an uncertain acceptance response requires checking status, not blind retries.

## Reconciliation and boundaries

Workspace row lock serializes administration. One transaction updates canonical
workspace.owner_id, both membership roles/versions, issue.human_owner_id and issue
versions, plus immutable audit. A failure rolls everything back. Former Owner
becomes Member with edit grants to **current** projects, not administration or
future projects. Assignees, claims, comments, answers, historical actors, receipts
and image attribution are not rewritten. External tokens/scopes stay unchanged;
existing per-request authorization follows current roles/project access.

One **owned** workspace per person remains a database constraint, while multiple
member workspaces are supported. A Member already owning another is ineligible.

Web-only, Origin/session protected, no-store endpoints under
`/api/v1/workspace/ownership`: GET snapshot/people, POST proposal, `:id/accept`,
`:id/cancel`. No new MCP/Chrome rights. Only Owner searches eligible members;
Member sees only proposals involving them. Safe responses exclude consenting
session ID, request ID, email and raw authentication proof.

## Operator-only recovery

`owner recover` still recovers the **instance bootstrap identity**. It cannot
reclaim a workspace after transfer. `instance_owner` is separate from current
workspace ownership.

1. Independently verify operator authority, exact workspace ID and current Owner.
   Email/invitation knowledge is never authority. Obtain a backup with database
   and attachment manifest; verify restore in an isolated target.
2. In the authorized operator environment, supply `ISSOPEN_WORKSPACE_ID`,
   `ISSOPEN_OWNER_EMAIL` and `ISSOPEN_OWNER_PASSWORD` temporarily via protected
   environment/0600 secret material. Unique12–128character password, never source,
   Git, command-line arguments/history, logs or tickets. No shared/reviewer password.
3. Run `pnpm owner recover-workspace` (compiled equivalent:
   `node dist/runtime/scripts/owner.js recover-workspace`). Never run it simply
   to validate production.
4. Command verifies canonical Owner+verified email+Owner membership under lock,
   rotates local credential or creates one for Google-only identity. No ownership,
   email, Google links, MCP/Chrome tokens or other users changed.
5. **All web sessions of this identity across its workspaces are revoked**.
   Their outstanding consents become invalid. Audit records infrastructure
   operator (no fabricated human actor), target ID/name and action, no secret.
6. Deliver credentials via an approved private channel, verify login/new roles,
   retire temporary environment material, and separately assess any authorized
   external credential revocation.

Synthetic integration/browser tests cover auth proof, old/future/missing proofs,
eligibility, isolation/CAS, cancellation/expiry/revoked consent, concurrent acceptance,
history reconciliation and recovery after transfer. Two isolated users confirm and
cancel at1440/360. Deployment does not execute transfers/recovery.
