# Multiworkspace — ticket 108

People have one identity and global web sessions, with explicit Owner/Member
membership in each workspace. Joining another workspace requires its own verified
invitation; no public signup, team creation or implicit project grants are added.

## Request and browser context

`resolveHumanAccess` accepts a workspace ID. Without it, only exactly one
membership is unambiguous. `/api/v1/session` returns the person's own `workspaces`
and a nullable selected `workspace`. Other routes deny missing/foreign context.
An invalid explicit selection never falls back to another workspace. Conflicting
`X-Issopen-Workspace` and `?workspace=` values return 400.

Web JSON requests use the header; SSE/images carry the workspace ID in the query
(an identifier, not a credential). The tab remembers only this ID in sessionStorage,
never account/project data. Explicit links preserve it for new tabs/history.
The selector asks before leaving drafts and fully navigates, cancelling the old
screen. Another tab cannot change this tab's context. Invalid/withdrawn selection
shows an own-workspace chooser instead of fetching another team's content.
After accepting an invitation, navigation selects that invitation's workspace.

## Chrome and MCP

An installation's OAuth client metadata permanently binds its workspace at link
time. Neither a header nor a web selector can change the token destination.
The consent page reads its actual bound workspace, not the current tab's label.
Existing clients are backfilled while each identity still has one membership.
New links require explicit context when there are multiple memberships. Removal
revokes only that workspace's installations/tokens, while every request and token
refresh verifies current membership. No extension package update is required.

MCP identity/workspace/allowlists remain independent and unchanged. OAuth MCP
still targets the sole **owned** workspace, not an arbitrary joined workspace;
the schema still enforces one owned workspace per identity. A Member's additional
workspace does not change existing agent grants. Multi-ownership/transfer must
reconcile this invariant in 105, not infer a different OAuth destination.

## Removal and recovery

Removing a membership preserves identity, global web sessions, history and other
memberships; access to the removed workspace fails immediately, including SSE.
Own session revocation remains global across workspaces. Bootstrap/recovery uses
the unique `instance_owner` identity and exact email, never the first membership;
it does not create, transfer or adopt workspace ownership. Operator-only reviewer
recovery rejects multiworkspace identities before global credential/session
revocation. No real reviewer access is changed by these tests.

## Migration and verification

0019 preserves membership rows and project permissions, binds old Chrome metadata,
then replaces the global unique membership-user index with a nonunique lookup
index. The composite workspace/user primary key remains. No grants are added.

Tests cover pre-0019 upgrade/backfill/idempotency, verified second invitation,
foreign/ambiguous/conflicting context, mutation isolation, global own sessions,
per-workspace Chrome revocation and refresh, two browser tabs and mobile drafts.
The full prior authorization/MCP suite still applies. Before production, take
and restore-check a full database/attachment backup in isolated PostgreSQL.

Do not roll back to a mono-workspace binary after multiple memberships exist:
it may silently choose the first membership and revoke other workspaces' access.
Prefer a forward fix. Any restore is a separate approved data operation; never
delete PVCs or membership rows to make a binary rollback appear compatible.
