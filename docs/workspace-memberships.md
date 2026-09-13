# Workspace memberships and authorization

Issopen's external-user pilot has two human roles. A person can belong to one
workspace at a time; this keeps session routing unambiguous until workspace
switching is deliberately designed.

## Role contract

| Capability | Owner | Member |
| --- | --- | --- |
| Read the workspace and own role | yes | yes |
| Create or configure projects | yes | no |
| Work with Epics, tickets, comments, questions, reviews and captures | every project | assigned projects only |
| Read ticket images and activity | every project | assigned projects only |
| Delete tickets | yes | no |
| Manage workspace, members and invitations | yes | no |
| Manage agents or authorize MCP clients | yes | no |
| Link and revoke a Chrome installation | own installations | own installations |
| Create projects from Chrome | yes | no |

The server is authoritative. Hiding a navigation item is only a usability aid:
REST, evidence, extension and OAuth entry points independently enforce the same
policy. Requests for an unassigned or foreign project return `404` so an
identifier cannot be used to discover private resources. Owner-only operations
return `403` with an actionable message.

## Data model and audit

- `workspace_membership` stores the `owner` or `member` role. Its unique user
  index intentionally limits the pilot to one workspace membership per person.
- `project_membership` is the explicit Member allowlist. Owner access is
  represented by the role and does not need one row per project.
- `membership_event` is append-only application audit data for bootstrap,
  grants, role changes, project grants/revocations and membership revocation.
  It records the subject and human actor; invitation work must use the central
  membership service rather than mutate membership rows from route handlers.
- `workspace_invitation`, `workspace_invitation_project` and
  `workspace_invitation_event` implement the hash-only, one-use invitation
  protocol. Its complete lifecycle, Google proof and recovery contract is in
  [Member invitations](member-invitations.md).
- The legacy `workspace.owner_id` remains the canonical instance owner and is
  retained for backward compatibility. An `owner` membership that does not
  match it is rejected by the authorization resolver.

`src/server/human-access.ts` is the central policy boundary. New human routes
must resolve `HumanAccess` once, call `requireWorkspaceOwner` for administration
or `requireProjectAccess` for project data, and build mutations through
`humanMutationContext`.

## Migration and rollback

Migration `0017_bright_fabian_cortez` is additive. It creates the three role
and membership tables,
backfills each existing `workspace.owner_id` as an Owner membership and appends
one deterministic `membership.backfilled` event. Existing workspace, project,
Epic, ticket and session rows are not rewritten.

Before production rollout, take the normal PostgreSQL backup. The safe rollback
is to deploy the previous application image while leaving the additive tables
in place; previous binaries continue to use `workspace.owner_id`. Restore the
database backup only if the migration itself failed or data verification shows
unexpected changes. Do not manually delete membership rows as a rollback.

The isolated migration integration test applies migrations through `0016`,
seeds historical owner/workspace/project data, applies `0017`, checks the
backfill and Member allowlist, reruns the migration for idempotency, and executes
the previous binary's owner/project query unchanged.
