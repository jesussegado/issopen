# 103 — Local gates verified, deployment pending

Directed in-app inbox with private count/read markers, scoped cursor and minimal
content. Atomic events for assignments, questions, mentions and assigned-editor
review; no self/duplicate/grants/email/watchers. Revocation hides content/count,
obsolete actions remain visibly historical. Literal selected mentions with
idempotent web comment retry (internal hash/key excluded from projections).
Question links open correct question; drafts and actual human actors preserved.

15Sep gates:162unit/web,92integration,30webE2E+2expectedskips,Chrome16unit13E2E,
reproducible0.6.3 tree38ba58ab/zipab821e0b unchanged,scan379. ComposePASS08:20.
Migration preserves old comments, answers/owners/claims/history, adds initially
empty inbox with no replay. Two real isolated browser sessions at1440/360 test
uncertain write+retry, one comment/notification, read/unread, filter and question
navigation/answer/obsolete state. Screenshots reviewed, no horizontal overflow.

Browser tests found post-login workspace-storage race in the header counter;
fixed by explicit server-confirmed workspace context and regression. Visual review
also found header count lag after explicit inbox refresh; refresh now updates both.
First full run used pre-follow-up build and failed that new assertion; clean
rebuilt full validation passes. This is test history, not a production incident.

Backup .local/backups/epic3-notifications-20260915/issopen-ghrLoY restored isolated
PG18.6/networknone:113issues988events13images matching hashes/bytes19receipts.
Source/image/GitOps observation and production read-only smoke required before
moving103 to review.102 delivereda6f4297/GitOpsa6e79100; actual97/98 external
questions remain unanswered08:19.105 nextquick260915-e7e: explicit web transfer,
auth assurance must distinguish login from a freshly minted invitation session.
