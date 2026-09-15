# Personal collaboration notifications — ticket103

Approved: in-app only, directed activity only. No email, watchers, push, new grants,
implicit invitation, dedicated reviewer or MCP/Chrome mutation permission.

`notification` records point to immutable activity events and current ticket scope.
Creation is in the source transaction; unique event/recipient/kind plus human
comment retry identity prevents duplicate delivery. Self events are suppressed.
Fresh project eligibility is checked at emission; every count/list/read marker
rechecks workspace membership and the exact project grant (another grant/owned
workspace is not enough). Deleted tickets/archived Epics are not shown. Lost
access hides content and count; history is retained, not deleted.

Events: human assignee changed; optional unanswered question directed to an
eligible editor; explicit comment mention; transition to Ready for Human Review
notifies the assigned human if they can edit. The assignee is not an exclusive
reviewer: any authorized editor still reviews. General activity does not notify.
Changes/removal/answering or withdrawn edit eligibility make prior required
actions visibly `No longer pending`. Read/unread is independent of pending state;
an unread historical notice remains unread until explicitly marked read.

Web comments select up to8 current project people (readers can receive mentions).
The text remains literal; typing @a-name alone does not notify. Server resolves
IDs/names and checks current eligibility, not user-supplied names or emails.
POST `/api/v1/issues/:id/comments` accepts optional mentionIds/clientRequestId;
mentions require UUID retry ID. Same issue/author/key with identical normalized
body+sorted unique recipients returns the original comment; changed content409.
UI retains the same key for a retry, preserves text/mentions on error. Internal
retry IDs/hashes are excluded from web/MCP comment projections. Old clients still
send body only; their input remains compatible, with no automatic mentions.

GET `/api/v1/notifications?status=all|unread&limit=1..50&cursor=...` is personal to
the authenticated human in the selected workspace. Cursor binds recipient, space
and filter; stable createdAt/id descending pages, separate whole-inbox unread
count. PUT `/api/v1/notifications/:id/read` `{read:boolean}` is own-only/idempotent,
revalidates access and returns404 for foreign/inaccessible records. Private
responses/errors use no-store. No raw comment body, email or credentials in inbox.

Header counter and page refresh at30sec/focus/reconnection; explicit refresh too.
Read markers sync with other sessions on refresh, not browser-local storage.
Refresh/access failure clears stale private list/count and offers retry. Delayed
responses can't overwrite another workspace. Question links open the selected
question; changes don't discard answer or comment drafts.

0025 adds empty nullable/default metadata for old comments and a new initially
empty inbox; no replay or retroactive notifications of historical work. No new
PVC or provider. Prefer forward fix; rolling back to102 leaves records intact but
stops emission. Do not drop history to roll back. Backup/restore includes the DB
alongside private attachments; live testing must not notify real people merely
for validation. Store package0.6.2 and dev0.6.3 stay untouched.
