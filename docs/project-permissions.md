# Project permissions — Epic3 ticket95

Workspace roles remain Owner/Member. Each explicit Member/project grant adds
`permission: read | edit`; absence is no access.0019 multiworkspace context is
required.0020 backfills existing project grants as edit, preserving behavior and
all IDs. No global Viewer/Admin, new role or implicit agent grant is introduced.

## Matrix

| Action within the selected workspace/project | Owner | Member edit | Member read | No project grant |
| --- | --- | --- | --- | --- |
| Board, Epics, ticket/history/questions, private images, SSE | yes | yes | yes |404 |
| Create/edit/archive Epic, create/edit ticket/status | yes | yes |403 |404 |
| Comment, answer/create question, code links, review/close | yes | yes |403 |404 |
| Delete ticket / workspace/project/access administration | yes |403 |403 |403 |
| Delete image | yes | only uploader |403 |404 |
| Own account, sessions and own Chrome installation controls | own only | own only | own only | own only |

`requireProjectAccess` and `requireProjectEdit` in human-access.ts are the shared
policy for REST and Chrome. Invalid/foreign workspace context fails before them.
Project mutation routes guarded: POST project issues/Epics, PATCH Epic (including
archive), PATCH issue, questions/answers/comments/code-links, both review actions,
POST web/Chrome captures, and DELETE image. Owner-only mutations retain their
separate workspace ownership check. Images are authorized separately from metadata.

REST project list/detail/board exposes server-derived canEdit; issue/Epic detail
also exposes canEdit. Web hides mutation controls, guards direct edit routes and
keeps read-only answers/history visible. Optional capability parsing only permits
legacy UI compatibility during rollout; it is never server authorization. SSE
rechecks current grants every tick and invalidates on read/edit changes as well
as activity. Detail applies a downgrade even while preserving a pending draft;
an answer draft can be recovered if edit access is restored.

Chrome intersects current edit grants with its existing OAuth scopes each request.
Its destination list contains only writable projects; without any it announces
canWrite=false. Old tokens and cached project IDs cannot bypass the server; even
idempotent capture replay is denied after a downgrade. Readable project Epic reads
remain safe, but no readonly destination is offered for ticket creation. The
submitted0.6.2 package/permissions/Store state are unchanged. Development0.6.3
hides creation/send actions on canWrite=false and explains how to regain access,
while preserving the local draft and account controls; it adds no permissions.
This source change is not a Store resubmission. Own disconnect remains
available without project write. MCP identity/scopes/allowlists are independent;
none are changed by this migration or by a human's project permission.

96 supplies the Owner UI for changing accepted memberships and per-project grants.
New collaboration actions in101–106 must reuse these checks, with final107 matrix.

## Verification and operation

Real PostgreSQL upgrade tests preserve existing grants as edit and keep later read
grants after repeated migration. Negative HTTP matrix checks every mutation plus
no audit writes on denial, stale cookie downgrade and live capability change.
OAuthChrome covers prior tokens, writable destination filtering, image reads and
denied uploader deletion after downgrade. Web route tests cover board/Epics/detail/
direct forms, live draft preservation; real browser E2E covers desktop/mobile.
Own account/MCP and existing foreign-workspace tests remain regression gates.

Reference reviewed2026-09-14: [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
The matrix follows least privilege, deny by default and server checks per request;
the local tests, not the reference alone, establish the implemented behavior.

Back up full DB and attachments and verify isolated restore before migration.
Do not roll back to a pre95 binary after setting a read grant: it ignores the
permission column and treats all project memberships as editable. Prefer a forward
fix. Never drop rows/columns, alter real grants or delete PVCs as a rollback shortcut.
