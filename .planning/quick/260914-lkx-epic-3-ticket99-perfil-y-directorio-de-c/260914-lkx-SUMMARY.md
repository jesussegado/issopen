# 99 — Delivered and verified

Profile/avatar CAS and project-only directory implemented according to both v2
answers. 0022 optional bounded profile row; no provider image import, private PNG
access, strict own-profile mutation, /update-user disabled. Existing identities,
grants and actor history preserved. Read-only people search with stable cursor,
same-name identity distinction and removed-access revalidation. Real browser1440/
360 upload/save/reload/conflict/compare/remove, safe directory projection and PNG.
Screenshots visually reviewed at both sizes. No real reviewer profile changed.

15Sep gates:155unit/web84integration24webE2E+2expectedskips, Chrome16unit13E2E,
reproducible0.6.3 unchanged tree38ba58ab/zipab821e0b, scan349, ComposePASS.
Long pre-existing extensions integration combining3OAuth flows+restore now30s,
assertions retained; removed a flaky default5s limit under full container suite.
Profile E2E scoped duplicate name locator to main content. Directory subscription
uses a latest-state ref rather than resubscribing when busy state changes.

Private backup .local/backups/epic3-profiles-20260915/issopen-4OTHrp verified and
restored into isolated18.6/networknone:113issues967events13images matching hashes
and bytes19receipts. Pre0022 migration preserves users/grants/membership versions,
idempotent upgrade, no avatar backfill and enforced DB size constraint. No production
restore. Publish source/image/GitOps then observe exact revision and smoke before
moving99 to human review. Continue101 and other independent tickets.

15Sep07:24UTC delivery confirmed: source93cdf43c0efbc0edf6e4e32c7715c5223758acd1,
GitOpsa0b1ab59a963156113f6db2104d3278fcf15ae3e, profiles-93cdf43@
sha256:954737775cefb84e7b615f1d0e13f689017d1246a4a80bcc94e936e03eee1b62.
Exact ArgoSynced/Healthy, podissopen-5c9b57fd67-d2mrm Ready0restart, readiness200,
bothPVCidentitiesunchanged. Member HTTPS1440/360smokePASS including ownprofile+
privateprojectdirectory/readprojection, foreign404, privateattachment, sessions,
mobilemenu and only its own newlycreated session revoked. No realprofile/grant/
ticket/oldsessions changed.99 moved Ready for Human Review with evidence and
commitlinks viaMCP, claimreleased.101 executingquick260915-csg.
