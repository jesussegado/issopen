# 99 — Local verification; deployment pending

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
