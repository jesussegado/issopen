# 101 — Local verification; deploying

Optional single human assignment independent from owner/agent claim; versioned
human-only PUT with full question snapshot, workspace lock/fresh edit scope,
target eligibility and archived/deleted protection. Atomic issue/event, no grants.
Removed people retain original attribution + no-access warning, current people
reflect profile names. Board All/Mine/Unassigned/Person and MCP cursor-bound read
filters; no new agent/Chrome mutation or automatic scope. Detail explicit save,
cancel and409 compare preserving selection and answer drafts. Board status also
sends expectedVersion. Reuses99 minimal directory with paginated selection.

15Sep gates158unit/web88integration26webE2E+2expectedskips, Chrome16unit13E2E,
reproducible0.6.3 unchanged tree38ba58ab/zipab821e0b, scan361, ComposePASS.
Pre0023 migration preserves existing owners/claims/status/event snapshots, nullable
assignment, enforcedFK/consistency and idempotence. Actual isolated browser1440/
360 checks selected recipient, race409/recovery, filters and revoked grant warning.
Screenshots visually reviewed. Test fixes: question service returns raw question,
native nested-select test uses accessible combobox name, prior status test now
asserts new expectedVersion. No production grants/tickets/profiles modified.

Backup .local/backups/epic3-assignment-20260915/issopen-Sp1yQn checksummed, isolated
PG18.6/networknone restore113issues974events13images matched hashes/bytes19receipts.
Source/image/GitOps and observed live smoke pending before moving101 to review.
102 quick260915-d77 planned; continue independent tickets despite97/98 external
provider/pilot questions (still unanswered15Sep07:30UTC).

Pre-acceptance follow-up15Sep07:38: recipient-query tests exposed Drizzle single-
table selection removing column qualification inside correlated SQL. Qualified
the101 assignee predicates explicitly so other-project/workspace grants cannot
make a withdrawn assignee appear eligible or expose their later profile name.
Added regression with withdrawn person still assigned another project AND Owner
of a different workspace. Assignment+tracker18testsPASS. Publish follow-up image
before accepting101 production delivery; firstGitOps691af152 not yet observed.
