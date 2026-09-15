# Administrative access audit106

Owner-only `/audit` reads the existing `membership_event`,
`workspace_invitation_event` and `ownership_event` ledgers. No copied feed, exports,
editing/deletion, personal view, background email or third-party telemetry.

GET `/api/v1/workspace/audit` revalidates canonical Owner under a workspace shared
lock, including every page/refresh. Member and foreign workspace requests fail;
demoted Owners lose access on their next request. All responses are no-store.

Filters: `person` (historical name or stable actor/subject ID, max120), exact
`action`, `from`/`to` ISO dates inclusive **UTC**, `limit`1–50 (default20), cursor.
Literal search escapes wildcard characters; filter/cursor SQL is parameterized.
Cursor binds workspace/filters and exact PostgreSQL microseconds plus source/ID;
descending pagination does not round to JavaScript milliseconds. Concurrent new
events appear on refreshed first page, not as duplicated items on older pages.

Future membership/invitation events get name snapshots from INSERT triggers in
0029; existing rows remain unchanged/null. UI labels old stable user IDs as
historical name unavailable rather than pretending current names were historical.
Removed memberships do not remove attribution or reactivate people. An invitation
with no known subject identity shows its invitation ID, not email/private link.
Once claimed, new events snapshot the associated user; old events are not rewritten.

Projection explicitly allows actor/subject, timestamp/type, same-workspace project
ID, role/permission deltas and bounded ownership/recovery impacts. No token/hash,
invitation URL, password, session identifier, IP, provider payload or raw changes
JSON. Recovery shows that the operator revoked the target identity's web sessions;
personal cross-workspace session inventory and ordinary own-session actions remain
private in100, not copied into another workspace's administration feed.

Membership/invitation records already reject UPDATE/DELETE at database level;
0029 extends the same append-only trigger to ownership records. Snapshot triggers
do not mutate old events. No cleanup/retention job currently removes these records;
they survive restores and normal membership removal. This describes technical
behavior, not a promise of comprehensive legal compliance or an erasure policy.
Backup access must remain restricted to infrastructure operators.

Web has explicit apply/clear/refresh, previous/next pages, plain-text impact details,
empty/error/retry states; a failed refresh clears the previous private listing.
Tests cover scoped authorization, revoked Owner, exact ties/microseconds, filters,
removed/renamed people, no secret payloads, DB/HTTP immutability, migration from old
events, and browser desktop/mobile filters/pagination/error recovery.

105 production-browser validation uncovered local Laurotech n8n restarting/network
events about every20seconds, causing host Chrome ERR_NETWORK_CHANGED. Do not alter
that unrelated workload for Issopen. Isolate production smoke in an official
version-pinned Playwright container with its own network namespace; no Docker socket,
only read-only code/dependencies/private test credential and private screenshot
output, no changed TLS checks or disabled server authorization.
