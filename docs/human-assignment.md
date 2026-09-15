# Human responsibility — Epic3 ticket101

Each ticket has zero or one human assignee. This is independent of the workspace
Owner (`human_owner_id`) and execution claim (`claimed_by_agent_id`). All prior
issues migrate unassigned. Any current project editor may assign any collaborator
with access, including a reader; responsibility never grants edit rights. Editors
may clear or change assignment. No change to the workspace owner or agent claim.

0023 adds nullable userFK/restrict + bounded assignment-time name snapshot and a
project/assignee index. A check keeps ID/name jointly null or non-null. Current
authorized people display their current profile name; when access is removed,
retain the assignment and its original name with an explicit no-access warning.
This preserves attribution without exposing subsequent profile changes or granting
access. Choose a new person/unassigned to reconcile. Same-name users remain distinct
by stable IDs. Project directory99 is reused for selection; no emails/providers.

PUT /api/v1/issues/:id/assignee is web-human-session only, trusted Origin required.
Strict body {assigneeId:string|null,expectedVersion:number,questionVersions:[...]};
whole issue+question snapshot CAS. Workspace share lock serializes membership
changes and fresh actor permissions are resolved inside transaction. Issue row
lock and shared Epic lock prevent assignment to deleted/archived tickets. Eligible
target validated again server-side, not trusted from UI. No-op keeps version;
change increments version and appends attributed issue.assignee_changed with
previous/new IDs/names atomically. Nothing creates a membership or project grant.

Board and REST issues filters accept assignee=mine|unassigned|humanID; combine
with Epic/status/questions. Current filters stay visible for zero results. Detail
has explicit selection/save/cancel and409 comparison retaining draft. Comparison
shows current assignment, title/status and actual question answers. Live refresh
treats assignment selection as dirty, preserving drafts. Board status updates now
send issue expectedVersion to avoid accepting a stale assignment context.

MCP list_issues gains optional assignee=unassigned|humanID and compact attributed
read fields. Agent claim=mine still refers only to that agent, never a human.
Cursor fingerprint includes assignee; old cursor may require starting a new page
after rollout. Strict MCP update/create and Chrome capture inputs are unchanged;
there is deliberately no agent/Chrome assignment mutation or new automatic scope.
Existing tokens/installations get no assignment rights. A future agent mutation
must require a separately approved explicit scope and dedicated tests.

Rollback: keep0023/data;99 ignores assignment columns but cannot display/manage
them. Never repurpose owner/claim or drop columns. Prefer forward repair after use.
Backup database contains assignments and audit; no attachment/PVC change. Verify
pre0023upgrade/history, negative authorization/cross-project, concurrency/answers,
removal, pagination/MCPcompat and real isolated browser1440/360. Production smoke
is read-only; do not assign genuine user tickets or alter reviewer grants to test.
