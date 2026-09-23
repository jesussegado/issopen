---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Epic 10 ticket 129 deployed and ready for human review; starting 130
last_updated: "2026-09-23T14:58:00Z"
last_activity: 2026-09-23
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 11
  completed_plans: 10
  percent: 91
---

# Project State

## Follow-up 23Sep — MCP registry families (Epic 10 ticket 129)

Ticket 129 reduces `tools.ts` to a 21-line facade over four independent tool
families. All 18 registrations compare unchanged and a contract hash protects
names, descriptions, schemas and annotations; scope, allowlist, cursor and
idempotency checks remain visible in handlers. Source `e4e7499`; 26 focused,
118 integration, 215 fast and 82 characterization tests pass with lint/types,
zero schema drift, build and secret scan. GitOps `4004f732`, digest `c484ca8c`;
140 GitOps tests, Argo Synced/Healthy, pod/PVC/HTTP checks and a live 18-tool MCP
catalog with canonical hash `cf1b9bf2` pass. Public onboarding surfaces were
reviewed; the documentary guide states that internal module layout is not part
of the MCP contract. Ticket is Ready for Human Review v7 without claim. No
observable contract changed. See quick 260923-rf8; next ticket is 130.

## Follow-up 23Sep — Tracker capability split (Epic 10 ticket 127)

Ticket 127 reduces `TrackerService` to a 213-line compatible facade over five
non-importing domain capabilities. All 30 moved operations compare unchanged;
the architecture gate prevents sibling imports and REST/MCP bypasses. Source
`c99686e`; 73 focused, 118 integration, 214 fast and 81 characterization tests
pass, along with 16 Chrome unit tests, 13 Chrome E2E, reproducible extension,
lint/types, zero schema drift, build and secret scan. GitOps `f77145cd`, digest
`d3415d47`; 140 GitOps tests, Argo Synced/Healthy, Ready/0-restart pod,
readiness/root and unchanged PVCs pass. Ticket is Ready for Human Review v7
without claim. No schema or public contract change. See quick 260923-rf7; next
ticket is 129.

## Follow-up 23Sep — Tracker transaction invariants (Epic 10 ticket 126)

Ticket 126 centralizes active issue locks/predicates, expected-version CAS,
question snapshots, issue version stamps and fully attributed activity while
keeping transactions and business SQL explicit. Source `d5bba0d`; 52 focused,
118 integration, 213 fast and 80 characterization tests pass with lint/types,
zero schema drift, build and secret scan. GitOps `165cda3e`, digest `3fc86465`;
140 GitOps tests, Argo Synced/Healthy, Ready/0-restart pod, readiness/root and
unchanged PVCs pass. The concurrent stale-draft test proves exactly one
attributed audit event. Ticket is Ready for Human Review v6 without claim. No
schema or public contract change. See quick 260923-rf6; next ticket is 127.

## Follow-up 23Sep — Integration boundary fixtures (Epic 10 ticket 134)

Ticket 134 centralizes isolated PostgreSQL lifecycle/reset, HTTP runtime and
Member identities, MCP transport and Chrome OAuth setup without hiding actors,
permissions or scenario data. Source `81ed567`, GitOps `1ba1d3cb`, digest
`84c7a5b3`; Argo is Synced/Healthy, app pod Ready/0 restarts, readiness/root
PASS and both PVC IDs unchanged. The four suites pass together with 64
scenarios, complete integration has 118 tests, characterization 76 and the
fast suite 212 without expected Git fatal noise. Lint/types, zero schema drift,
build, secret scan and 140 GitOps tests pass (one unrelated socket-race retry
was green isolated and on the full rerun). No runtime, SQL, permission or
product change. See quick 260923-rf5; next ticket is 126.

## Follow-up 23Sep — Central HTTP validation (Epic 10 ticket 128)

Ticket 128 replaces controller-local Zod/UUID/JSON/error copies with small
transport primitives and one `DomainError` serializer while domain services
retain business rules. Source `c716d6e`, GitOps `b9d0ea90`, digest `e352101d`;
Argo is Synced/Healthy, app pod Ready/0 restarts, public readiness/root PASS and
both PVC IDs unchanged. Gates pass: 13 focused HTTP/architecture, 211 fast,
118 integration, 78 characterization and 140 GitOps tests, plus lint/types,
zero schema drift, build and secret scan. No SQL, authorization, public payload
or visible product change. See quick 260923-rf4; next ticket is 134.

## Follow-up 23Sep — Shared invitation security primitives (Epic 10 ticket 125)

Ticket 125 centralizes actual common email, token, lifetime and lifecycle-state
primitives while member and Owner services retain their separate policies,
transactions, errors and OAuth paths. Source `4779b8d`, GitOps `b0e77964`,
digest `d34e85db`; Argo is Synced/Healthy, pod Ready/0 restarts, public
readiness/root PASS and both PVC IDs unchanged. Gates pass: 35 focused,
205 fast, 118 integration and 78 characterization tests, zero schema drift,
build, secret scan and 140 GitOps tests. No SQL, HTTP, permission or visible
product change. See quick 260923-rf3; next dependency-safe ticket is 128.

## Follow-up 23Sep — Modular Drizzle schema (Epic 10 ticket 124)

Ticket 124 splits the 1,681-line schema behind its unchanged public facade into
identity, access, agents, tracker, notifications, captures and explicit
cross-domain relations. Source `16d4df6`, GitOps `b3ddcbf0`, digest `ed9e2823`;
Argo is Synced/Healthy, pod Ready/0 restarts, public readiness/root PASS and
both PVC volume IDs unchanged. Exact exports match, Drizzle sees the
same 42 tables and generates no migration. Gates pass: lint/types, 78 focused
characterization, 201 fast tests, 118 integration tests on ephemeral PostgreSQL
and production build. Deep imports and cyclic module dependencies now fail an
architecture test. No runtime contract, SQL, permission or product change.
See quick 260923-rf2.

## Follow-up 23Sep — Refactor safety baseline (Epic 10 ticket 123)

Ticket 123 establishes the non-regression baseline before moving production
code. Source `d695272` documents hotspots and dependency order for 123–136,
adds executable modular-monolith boundaries, runs Drizzle generation against a
temporary migration copy and exposes one `refactor:check` command. Gates pass:
lint/types, 76 focused characterization tests, 199 fast unit/web tests and zero
schema drift. No runtime, schema, migration, permission or deployment change.
See quick 260923-rf1; next dependency-safe ticket is 124.

## Follow-up 21Sep — Visual polish and stability v1 (Epic 9)

Tickets119–122 are implemented, deployed and Ready for Human Review with claims
released. Source8cf80bb/0d1001b and GitOps90a1da77 publish stable filter layout,
280–360px board columns, compact ticket hierarchy, touch-specific guidance,
mobile shell fixes and a bounded detail activity rail. Full gates pass:
195unit/web,118integration,42webE2E+2skips,Chrome16+13,reproducible build,
Compose, secret scan and140GitOps tests. Production is Synced/Healthy on exact
digest ed79fcd8, podReady0restarts, readinessOK and PVCs unchanged. Read-only
visual smoke at1440×1000 and390×844 reports no document overflow or console/page
errors. Review findings in phase01 REVIEW.md are resolved.

## Follow-up 21Sep — Project completion workflow (ticket68)

Human decision v2: disabling Ready for Human Review makes verified agent work
finish directly at Done. `showReviewColumn` now governs new completion
transitions; historical review tickets remain readable and `showDoneColumn`
stays visual-only. MCP exposes the effective policy through `get_project.workflow`;
web selectors, skill0.2.1, all onboarding surfaces and AGENTS agree. Closing
still requires independent `issues:close`; no grant or migration was added.
Full gates pass:194unit/web,118integration,42webE2E+2skips,Chrome16+13,
reproducible skill/build, Compose, scan443 and140GitOps tests/render. Source
5ebb449/GitOps84c294b5/digest374c0345 observed Synced/Healthy, podReady0restarts,
readinessOK and PVCs Bound. Live onboarding and MCP policy verified. Issopen's
own project currently requires human review, so 68 is ReadyHumanReview v9 with
evidence/commit linked and no claim. See quick260921-r68 summary.

## Follow-up 17Sep — ChatGPT Authenticate (ticket117)

User reports Authenticate failure. Confirmed CIMD1.7.2/Node24 pinned DNS callback
shape error before login, plus web sign-in losing the signed OAuth continuation.
Plan derived from issue117v4/questions[] in quick/260917-oauth117; persistent
debug evidence in debug/chatgpt-authenticate.md. Patched dependency, isolated
regressions and updated onboarding. Full gate on isolated85c03e3 passes192unit/web,
115integration,42webE2E+2skips,Chrome validation/reproducibility and secret scan441;
Compose and140GitOps tests pass. Fix381fdf3 is included in concurrently released
20c4b30/GitOpsaf286bf0/digest103cd7d0 (no older image overwrite). ArgoSynced/Healthy,
podReady0restarts/PVCunchanged. Live official CIMD+JWKS200, fresh Owner browser login
continues to enabled ChatGPT consent at1440/360, no overflow/page errors; isolated
test session signed out. Consent not granted; final ChatGPT account acceptance
still belongs to the user. No credential, permission or schema changes.

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-30)

**Core value:** Convertir una intención humana en trabajo estructurado y seguro que ChatGPT y agentes de código externos puedan entender, ejecutar y devolver a revisión dentro de un único flujo trazable.
**Current focus:** Epic 3 implementation after all 20 human answers (v2).
16Sep Google pilot diagnosed: attempts before the invitation were correctly denied
as signup_disabled; after claim, retrying the generic Google button produced
account_not_linked because an interrupted provisional session had no bounded resume.
Recovery847536a/GitOps100b5a7b/digest56ee4502 is Synced/Healthy/Ready0restarts.
The latest private invitation link now offers Resume verification only for an
unverified identity with no provider account or membership, atomically replacing
the prior provisional session. It still requires exact Google proof and grants no
workspace/project access by itself; public signup/implicit linking remain disabled.
Full gates168unit/web111integration38webE2E+2skips,Chrome16+13,reproducible,
scan415/ComposePASS. Backuprestore113issues1053events13images19receiptsPASS;
production guidance smoke1440/360, readiness/provider/PVCs PASS. The actual Google
callback/acceptance remains human-pending: reopen the same link, Resume verification,
then Verify with Google. Debug session .planning/debug/google-invitation-login.md;
ticket98 released while awaiting that result.

Previous checkpoint:
16Sep decisions: reuse Gremiox Gmail SMTP and sender serviciosegado@gmail.com;
Owner will perform the Google trial. Both operational questions are answered.
Separate issopen-mail-env created with independent AES key; recovery source
.local/secrets/issopen-mail.env ignored0600. No existing secrets/Gremiox/DNS changed.
Activation6005ace / GitOps33a99f6e / digest17dead1b observed Synced/Healthy/Ready,
SMTP authentication from actual pod environment passed, queue0/readinessok/PVCs
unchanged. No email sent by the agent; receipt and Google remain unverified.
Public mobile smoke found min-content overflow; regression and two-CSS-rule fix
f5dbbc4 passed full gates167unit/web111integration38webE2E+2skips,Chrome16+13,
reproducible0.6.3/scan414/Compose. GitOpsa3704a4a/digest65141db3 observed
Synced/Healthy/Ready0restarts with readinessJSONok/PVCs unchanged. Final production
smoke passed: public privacy1.2 at1440/360, authenticated Member flows, private
images/foreign404, admin403 and only-new-test-session revocation/cleared detail.
Backuprestore113issues1041events13matchingimages19receiptsPASS.
13 tickets remain ReadyHumanReview;97/98/107 await actual human pilot evidence,
not more provider/operator questions. Guide docs/google-pilot.md and comment98.
Never reuse Store reviewer for pilot grants/Google, alter Store87/88 or close by
inference. GSD quick260916-llb records the current continuation.

Previous checkpoint:
106 delivered5044a29/GitOps66d84b95/digest60980357, Healthy/Synced/Ready/PVC,
isolated1440/360production smokePASS; review/released.97 technical gatesPASS:
167unit/web111integration36webE2E+2expectedskips,Chrome16unit13E2E, reproducible
0.6.3/scan408/Compose. Backuprestore113issues1011events13matchingimages19receipts.
97 releasing disabled SMTP;09:30production env confirms no transport/provider/key.
97 question0dd7a18c and98 question1abf3039 stillunanswered.107 matrix in docs/
epic-3-acceptance.md; finish97 safe rollout and record external blockers honestly.

Previous checkpoint:
105 delivered1033c36/GitOps77699d9d/digesta5673137, Healthy/Synced/Ready0restarts,
readinessJSONok/PVCunchanged and isolated-network1440/360prodsmokePASS09:01;
ReadyHumanReview/claimreleased.163unit/web99integration32webE2E+2skips/Chrome16+13,
reproducible/scan390/Compose/backuprestore113issues995events13images19receiptsPASS.
106 audit implemented, final gates163unit/web102integrationPASS; browser/Chrome
running; backuprestore113issues997events13images19receiptsPASS.97 claimed/planned
quick260915-fcr; provider/From/pilot question pending09:03;98 realGooglepilot pending.
Host Chrome interference traced to unrelated Laurotech n8n restarts/network; use
isolated Playwright container for live smoke, never change unrelated workload.

Previous checkpoint:
103 delivered75dfb6e/GitOpsbfd8fce/digestaa9a22d3, Healthy/Synced/Ready0restarts,
readinessJSONok/PVCunchanged and production1440/360smokePASS08:32;review/released.
105 executing protected transfer/recovery quick260915-e7e. Specific integration
and two-user browserPASS; full163unit/web98integration32webE2E+2skips/Chrome16+13
reproducible/scan387PASS, final rollback regression/field polish verifying.
Backup ownership-uROyx4 complete; restore/release next. Continue106/97/107.
Never mutate actual ownership, Google reviewer or existing sessions for tests.

Previous checkpoint:
102 delivereda6f4297/GitOpsa6e79100/digest4704d59a Healthy/Synced/Ready0restarts,
readinessJSONok/PVCunchanged and production1440/360smokePASS; review/claimreleased.
103162unit/web92integration30webE2E+2skips/Chrome16+13/reproducible/scan379PASS,
backuprestore113issues988events13images19receipts. ComposePASS;deploy/live smoke next.
105 planquick260915-e7e, not claimed or implemented. Keep independent work moving
through105/106/97/107.97/98 external questions still unanswered08:19.

Previous checkpoint:
101 deliveredcd83694/GitOpsc2cfee/digestb5d69949 Synced/Healthy, Ready0restarts,
readinessJSONok/PVCunchanged and production1440/360smokePASS; review/claimreleased.
102 local gates160unit/web89integration28webE2E+2skips/Chrome16+13/reproducible/
scan367/ComposePASS. Backuprestore113issues976events13images19receipts. Publishing
102 before review.103 planquick260915-doi; continue through105/106/97/107 until
all feasible work ready or genuinely blocked.97/98 unanswered external questions.

Previous checkpoint:
99 delivered93cdf43/GitOpsa0b1ab59/digest95473777; Synced/Healthy, Ready0restarts,
readiness200/PVCunchanged, Member1440/360smokePASS.155unit/web84integration24webE2E
+2skips,Chrome16+13/reproducible/scan349/ComposePASS. Backuprestore113issues967events
13images19receipts.99 review/claimreleased;101 executingquick260915-csg,
assignment+filters+strict web-only mutation, no new agent/Chrome rights.
Continue independent work until allready or genuine blockers.97/98 external
questions remain; don't treat password/fixtures as realGoogle acceptance.

Previous checkpoint:
98 technical delivery19f3a81/GitOpsbebfda10/digest5bcce1f6, Synced/Healthy13:44,
Ready0restart, readiness200, PVCidentitiesunchanged, Member1440/360smokePASS.
150unit/web81integration22webE2E+2skips/Chrome16+13/reproducible/scan336/ComposePASS.
Backuprestore113issues960events13images19receipts.98 InProgress/warning for actual
Googlepilot question1abf3039, claimreleased; not a completed realOIDC trial.
99 claimed+InProgress, quick260914-lkx, localprofile/directory implementation/tests.
97 provider/from question0dd7a18c pending. Keep independent Epic work moving.

Previous checkpoint:
96 delivered3156b31/GitOps7f6d9515/digest5073c128: Synced/Healthy, Ready0restarts,
readiness200/PVCunchanged, Member1440/360smokePASS.126unit/web80integration20webE2E
+2skips,Chrome16+13/reproducible,scan329/ComposePASS. Backuprestore113issues951events
13images19receipts.96review/claimreleased;98executingquick260914-l2z.97 provider/from
question0dd7a18c and98 realGooglepilot question1abf3039 pending; continue technical
work and independent tickets. No real grants/tickets/existing sessions modified.

Previous checkpoint:
95 delivered23d789e/GitOpsb69e88b9/digeste37d0b3b, Synced/Healthy exactrevision,
Ready0restarts/readiness200/PVCunchanged and isolatedMember1440/360smokePASS.
123unit/web78integration18webE2E+2skips/ComposePASS; Chrome development0.6.3
16unit13E2E/reproducible, submittedStore0.6.2 untouched. Backup isolatedrestore
113issues942events13images19receipts.95 inreview withoutclaim.96 inprogress,
quick260914-koj.97 question0dd7a18c provider/from/pilotrecipient pending: blocks
realemailconfiguration only; continue all independent Epic work.

Previous checkpoint:
Continuation260914-jhl delivered108:source390f3d0/GitOpscbf737cd/digest06d2fec0,
ArgoSynced/Healthy, Ready0restarts, readiness200, PVCsunchanged. Fullgates and
productionMember smoke1440/360PASS; backuprestore113issues/932events/13images/
19receipts.108 Ready for Human Review withoutclaim.95 nowclaimed/inprogress,
quick260914-k34;10remainingBacklog. Keep executing until allfeasible tickets
are ready or genuinely human/providerblocked.97 newblocker recorded above.
No real sessions/reviewer/Storechanges. See quickSUMMARY for precise evidence.

Previous increment:
Quick 260913-x6a delivers contract94 (`4df0a09`), own web sessions100
(`dd5d777`), live detail/draft reconciliation104 (`79fd7a1`) and mobile
navigation109 (`328a386`). All four Ready for Human Review, no claims.
GitOps `0ac6550d` Synced/Healthy, source `328a386`, digest `aa622315`, pod
Ready/0 restarts and public readiness200; PostgreSQL and both PVC identities
unchanged. No Google/Store/Chrome package changes or real session revocation.
115 unit/web,72 integration,14 web E2E (2 expected skips),16 Chrome unit/12 E2E,
Compose and secret scan pass. Backup restored isolated without network:
112 issues,905 events,13 matching image hashes,19 receipts. Production Member
smoke at1440/360 verifies account/dialogs, detail/attachment, navigation, foreign
access denial and stream cleanup when only a new smoke session is revoked.

Epic remains open:12 Backlog tickets. Next108 tenancy then95 per-project
read/edit permissions; proceed to membership/invitations/profile/assignment/
notifications/transfer/audit. All 20 answers reread unchanged before handoff.
100/104 are independent current-runtime increments, not completion of108/95;
repeat integration with new permissions and memberships in107. No unresolved
human questions currently; no new invite/email/provider actions performed.
See docs/epic-3-collaboration-plan.md and live Epic for current authority.

Independent Epic 7 follow-up: Chrome 0.6.2 was submitted on
2026-09-13 at 19:24 UTC: Pending review, Unlisted, automatic publication
disabled. Dashboard rechecked at 20:23 UTC: still Pending review. Not approved
or published. Reread live tickets and dashboard before any publication.

Follow-up 2026-09-13, quick 260913-v4j: 86 clarification answered at 20:21:42
UTC — keep current isolated local reviewer during this review. Both questions
v2 answered, no unanswered blocker. Preserve credentials, project allowlist
and private test instructions; future invited Google pilot remains in 87.
Existing reviewer login/read-only desktop/mobile smoke passed, foreign reads
and admin still denied; only test session signed out. Runtime b0240335 remains
Synced/Healthy, Ready/0 restarts and readiness 200. Documentation c0199fd,
Epic v5/comment updated; no deployment, new account or claim. 87/88 still need
the real Store/pilot/update gates, not additional review-access clarification.

Follow-up 2026-09-13: quick 260913-u1g reconciles Store evidence and prepares
pilot 87/operations 88 runbooks without pretending their real gates passed.
84 v14, 85 v11 and 91 v7 are Ready for Human Review, claims null. User-closed
78–83 are preserved. Ticket 91 corrects Member actions and actor attribution;
source be31905, GitOps b0240335 Synced/Healthy, runtime digest 2439285,
pod Ready/0 restarts, public readiness 200 and both PVC identities unchanged.
98 unit/web, 66 integration, 10 web E2E (2 expected skips), Chrome unit/12 E2E,
Compose and secret scan pass; submitted Chrome ZIP hash unchanged. Canonical
homelab 197 tests and actual GitOps candidate 134 tests/render pass. Backup
restored isolated: 97 tickets, 809 events, 13 image hashes and 19 receipts.
Independent production Member smoke at 1440/360 px passed without ticket
mutation or disturbing user Chrome. At that checkpoint the 86 clarification
was unanswered; the later explicit keep-access answer is recorded above in
quick 260913-v4j. Preserve both the decision history and current reviewer.

Earlier follow-up 2026-09-13 (before submission): quick 260913-qn7 provisions the owner-approved local
Member in a fresh Google Review Demo project with synthetic data only. Source
e05ff24; no runtime/GitOps change. Password login, exact allowlist, private-data
404/admin 403, real packaged Chrome OAuth and synthetic image ticket passed.
94 unit/web and 66 integration tests plus lint/types/build/secret scan pass.
Private Store instructions saved and reload-verified; no submission/publication.
Keep reviewer active through review then explicitly revoke per
docs/chrome-review-access.md. Ticket 91 records a Member-only UI presentation
defect; server authorization is enforced. Credentials only in ignored 0600
operator storage and Google's private form. GSD artifacts contain no secrets.

Follow-up 2026-09-10: ticket 64 gives the `+` and `Create ticket in Epic` label
an explicit 8 px gap while retaining its accessible name and destination.
Source 44b1bda, GitOps cfc0474b Synced/Healthy, digest 0964635; pod Ready/0
restarts, public readiness, PostgreSQL and both PVCs verified. All 233 automated
tests plus two expected skips pass across app and Chrome. Fresh backup restored
isolated with 65 issues, 583 events, 10 evidences/receipts and 16 migrations;
all attachment hashes/sizes match. Production Chrome smoke passed. Ticket Ready
for Human Review v6, claim null.

Follow-up 2026-09-10: ticket 62 fixes stale post-success Chrome attachments in
0.5.5 (source f337430 plus formatting-only 3da9fc5); the reproducible ZIP and
checksum passed and the managed profile retained its extension ID. Ticket 63
adds project-scoped authenticated SSE plus focus/online/visibility/30 s
reconciliation (source 65f2720). GitOps db1f864f is Synced/Healthy on digest
8f26ffd; pod Ready/0 restarts, PostgreSQL and both PVCs preserved, readiness
public. Full gates, Compose, 197 homelab checks and isolated backup restore
passed. A live owner SSE stream observed an MCP activity mutation. Both tickets
are Ready for Human Review v6 with no active claim.

Follow-up 2026-09-10: Epic 5 tickets 57–59 simplify compact Epic listings,
add private paste/file images to normal web ticket creation, and keep
`+ Create ticket in Epic` visible for populated Epics. Source b7c48cb, GitOps
c9c46e9e Synced/Healthy, runtime digest bd534bb; pod Ready/0 restarts, PostgreSQL
and both PVCs preserved. 80 unit/web + 53 integration + 8 web E2E (2 expected
skips) + 76 Chrome unit + 12 Chrome E2E, Compose and 197 homelab checks pass.
Fresh backup restored without network with all nine attachment hashes/sizes
matching. Authenticated desktop/mobile production smoke passed without mutation.
MCP links/evidence are present; tickets 57, 58 and 59 are Ready for Human Review
v6, claim null, with no unanswered questions.

Follow-up 2026-09-10: ticket 61 presents `ready_for_review` as Ready for
Human Review and adds independent per-project visibility for that column and
Done. Migration 0015 defaults both flags to true; hiding is board-only and
preserves states, direct links and MCP. Quick 260910-g1z, source 5048f51,
GitOps ddf9d971 Synced/Healthy, digest 09d68e4, pod Ready/0 restarts and both
PVCs unchanged. 79 unit/web + 52 integration + 8 web E2E + 76 extension unit +
12 extension E2E, Compose and 197 homelab checks pass. Full backup restored
isolated with 2 projects, 62 tickets, 540 events and 7 attachments; production
has 16 migrations and both existing projects enabled. UI verified at 1440/360
px without mutation. Ticket Ready for Human Review v6, claim null.

Follow-up 2026-09-10: ticket 60 adds owner-only web deletion with confirmation,
logical tombstone 0014, audit/retention, version guards and hidden reads/evidence.
No Chrome/MCP delete permissions. Quick 260910-fdz, source c8d0d1a, GitOps
543a2f65 Synced/Healthy; pod Ready on master, both PVCs unchanged, public UI
button/cancel tested at 1440/360 px without DELETE. 226 tests + Compose PASS,
197 homelab PASS. Full backup restored isolated; 7 production images intact.
Ticket Ready for Review v6, claim null. No real tickets deleted; extension
untouched. Rollback to older binary would show tombstones: prefer roll-forward.

Follow-up 2026-09-10: ticket 56 styles the success link and stacks final
composer actions at full width with 12px gaps (quick 260910-f5d), source
c76a591 published. Release 0.5.4 passes 220 tests/checksum/reproducibility.
Live Chrome had a new confirmation and one image by delivery: exact new CSS
applied without reload, UI/confirmation/image preserved, three stacked actions
verified. Runtime still 0.5.3; complete 0.5.4 artifact awaits a safe future reload.
Ticket 56 Ready for Review v6, claim null; no backend or personal data changes.

Follow-up 2026-09-10: ticket 54 merges destination search and selection into
one editable combobox for Proyecto and Epic. Quick 260910-euw, source b5795e6
published; 0.5.3 release 219 tests PASS, checksum/reproducibility verified.
Managed Chrome loaded/connected, 2 searchable inputs / 0 duplicate search
fields; filtering/selection/cancel verified. Existing draft and real image
preserved. Ticket 54 Ready for Review v6, claim null; no backend changes.

Follow-up 2026-09-10: ticket 53 fixes native dropdown positioning observed in
managed Chrome 152 Linux (popup outside the browser window). SelectField lists
stay in the panel. Quick 260910-ehq, source fb11c419281c published. Release
0.5.2 passes 218 tests + 197 homelab checks, checksum/reproducibility verified.
Loaded same managed Chrome ID: all four lists and clicks verified in viewport,
connected, existing image/draft preserved. Ticket 53 Ready for Review v6,
claim null. No server, permission changes, clipboard reads or user uploads.

Follow-up 2026-09-10: ticket 52 adds a dismissible information notice and
permanent Account help, quick 260910-e2r, source dbfc597. 215 tests PASS,
ZIP/checksum/reproducibility verified. Managed Chrome 0.5.1 loaded/connected;
dismissal survives reload, Account help accessible, existing image and confirmed
draft preserved. Ticket 52 Ready for Review v6, claim null. No backend/GitOps
changes or clipboard reads/uploads; previous extension 0.5.0 retained.

Follow-up 2026-09-10: source 22b7e89, GitOps 4eb5b1ec Synced/Healthy; 213
tests PASS plus Compose. ZIP/checksum/reproducibility verified. Up to five
private images, native paste/files, local 24 h draft and atomic retry preserved.
Same extension ID/profile, 0.5 connected with maxImages=5. Both PVCs unchanged;
full production backup restored isolated (4 PNGs/4 receipts), post-deploy audit
intact. No personal clipboard reads or images uploaded. Ticket 51 v6 claim null.
Do not downgrade to 0.4.3 with multi-image draft/pending operation.

Follow-up 2026-09-10: ticket 50 moves account details behind the header user
button (quick 260910-cw3), Ready for Review v6, claim null. Release f6aa3e6:
217 tests PASS, two expected skips, ZIP/checksum verified. Chrome 0.4.3 loaded
in the same test profile/extension ID, still connected; account dialog and focus
verified. No capture/draft loss on toggling (isolated UI and real OAuth tests).
Previous 0.4.2 retained; no server/GitOps change or personal acceptance closure.

Follow-up 2026-09-10: ticket 49 explains capture failures with safe cause codes
and recovery steps (quick 260910-cbj), Ready for Review v6, claim null. Clean
release db26d87: 216 tests PASS, two expected skips, ZIP/checksum verified.
Chrome 0.4.2 loaded in the same test profile and still connected; previous 0.4.1
retained for rollback. No server/GitOps change. Parallel creation buttons
724a2da retained. Historical screenshot cause remains unknown.

## Current Position

Phase: 1 (Private Single-Owner Dogfooding MVP) — EXECUTING
Plan: 5 of 5
Status: Epic 3 planning delivered; awaiting human decisions and implementation request
Last activity: 2026-09-17 - Completed quick260917-onb: secret-free agent onboarding, pinned skill 0.2.0 and personalized MCP setup deployed and verified in production. Roadmap phase progress unchanged.

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 52min | 3 tasks | 35 files |
| Phase 01 P02 | 32min | 2 tasks | 15 files |
| Phase 01 P03 | 35min | 2 tasks | 22 files |
| Phase 01 P04 | 58min | 2 tasks | 36 files |

## Accumulated Context

### Decisions

- [Quick 260910-f5d]: Highlight success link and vertically stack final composer
  actions. For a CSS-only change while a confirmation is open, apply validated
  stylesheet live rather than discard the in-memory success view by reloading.

- [Quick 260910-euw]: Proyecto/Epic use one editable input-combobox each.
  Search text is transient; only an option confirms an ID. Escape/Tab/outside
  restore the confirmed label. Keep native text editing and in-panel lists.

- [Quick 260910-ehq]: Extension ticket selectors use in-panel HTML lists,
  avoiding the observed out-of-window native popup in Chrome Linux. Preserve
  keyboard access, saved values and pending-operation locks; test real clicks.

- [Quick 260910-e2r]: General information is a dismissible in-panel notice,
  remembered locally and always readable under Account. Preserve operational
  errors and attachment limits. Closing must not alter draft/session.

- [Quick 260910-d89]: Owner explicitly replaces internal captures with external
  PNG/JPEG/WebP paste/uploads, 5 images/8 MiB aggregate/32 MP each. No page access,
  optional clipboardRead on gesture only. User-added images enter the local
  draft; submit is the only upload. API v1 additive, no DB migration; preserve
  legacy pending hashes, permissions and private evidence.

- [Quick 260909-vje]: Chrome 0.4 adds reviewed-only IndexedDB drafts (24 h),
  owner-scoped receipts that survive reconnection, separate human write consent,
  bounded structural DOM, inline project/Epic, PNG normalization and private
  storage. Keep originals/history in RAM. Restore/GC use isolated fixtures and
  recoverable quarantine. See docs/chrome-delivery.md. Deployment, backup restore
  and technical dogfooding verified separately; personal acceptance remains in 33.

- [Quick 260909-tfb]: OAuth human extension audience stays separate from MCP;
  per-installation public clients, PKCE, 30-day absolute lifetime. 0.3 capture
  stays in RAM until explicit PNG download; DOM/upload/storage criteria stay
  pending. Server source and unpacked extension version deploy independently.
- [Quick 260909-r6j]: Owner explicitly prioritizes Chrome Epic before the
  remaining historical sequence; do not mark phases complete. First cut is
  scope + installable local-only foundation. OAuth/capture/submission remain
  in 21–33; `docs/chrome-extension.md` records roadmap differences and answers.
Decisions are logged in PROJECT.md Key Decisions table. Current roadmap-level structure:

- [Roadmap]: Nine sequential phases start with the complete private dogfooding loop; no parallel phase execution.
- [Phase 1]: The first usable MVP is Docker Compose → responsive web tracker → authenticated ChatGPT MCP → separately authenticated external code agent → human review.
- [Deferral]: Collaboration, visual storage/capture, audits, broad Community compatibility, release hardening, and Cloud follow only after the Phase 1 loop works.
- [Boundary]: Issopen governs backlog, permissions, activity, status, and code-result references; repository edits, CI, merge, and deployment remain external and human-controlled.
- [Release]: Community and Cloud share product capabilities and artifacts; Cloud differentiates by capacity and operation.
- [Phase 01]: Owner provisioning stays outside HTTP registration and uses a transaction, singleton constraint, and advisory lock.
- [Phase 01]: Only esbuild may run dependency build scripts; optional native dependency scripts stay disabled.
- [Phase 01]: Local Compose binds HTTP to loopback, while non-development deployments require an HTTPS public base URL.
- [Phase 01]: Kubernetes remains disabled until an immutable image repository and digest are supplied.
- [Phase 01]: Project keys are immutable and each issue materializes its readable key at creation.
- [Phase 01]: Per-project issue numbers allocate atomically with a scoped UPDATE RETURNING operation.
- [Phase 01]: Activity is append-only in the service and protected from direct update or delete by PostgreSQL.
- [Phase 01]: REST derives workspace, actor, source, and time from the authenticated owner session.
- [Phase 01]: Use native browser controls and a small History API router without a component or desktop framework.
- [Phase 01]: Apply UI mutations only from authoritative REST responses before focus restoration and announcements.
- [Phase 01]: Run browser acceptance against ephemeral PostgreSQL at 1440px and 360px.
- [Phase 01]: Keep Better Auth, MCP and CIMD on exact 1.7.2; use CIMD while broad dynamic registration stays disabled.
- [Phase 01]: Resolve every agent request through verified token scopes and a persisted project allowlist.
- [Phase 01]: Keep issues:close independent and absent from default Codex and ChatGPT grants.
- [Quick 260902-ght]: An issue belongs to zero or one lightweight Epic from
  the same project/workspace; Epic progress is derived from issue states and
  grouping reuses existing issue scopes.
- [Quick 260907-wrj]: The approved six-piece aperture, forest `#027067` and
  mint `#6FD9B5` define the web identity; shared Brand and color tokens follow
  `docs/design/0001-brand-identity.md`.
- [Quick 260908-kiy]: The favicon uses a separate opaque white background for
  dark browser tabs; the header logo and touch icon keep their transparent asset.

### Pending Todos

- Epic 4 / ticket 44: project/repository association, selected real improvement,
  then publication and pilot. Owner approved a new Issopen-only testing PAT,
  INCLUDING issues:close; created and MCP-verified on 2026-09-09, expires
  2026-10-09. Stored in ignored homelab .local/secrets/issopen-codex-pilot.env
  (0600). Existing grants, saved human answers and client approval policies
  remain unchanged. Only 43 was closed by explicit owner request.

### Completed Todos

- Epic 4 / ticket 43: Done, version 22, claim null, independently reread via MCP
  at 16:00:02 UTC after the owner requested closure. Native execution/reopen,
  planning/repeat and changed-answer query evidence remains documented; unrun
  plan reconciliation/failure cases are not relabeled PASS. Test harness PID
  2517887 stopped; final report retained in /tmp/issopen-ide-control-MPtIb5.
  Global config restored, fixture disk unchanged. Do not resume this closed
  task automatically; 44 and publication require a separate request.
- `2026-08-30-documentar-mvp-autoprogramable-con-chatgpt`: integrado en
  `PROJECT.md` y `REQUIREMENTS.md`; su roadmap de doce fases quedó superado el
  2026-08-31 al mover el MVP privado completo a la fase 1.

### Completed Quick Tasks

| ID | Description | Date | Commits | Status | Directory |
| --- | --- | --- | --- | --- | --- |
| 260923-rf8 | Ticket 129: modularizar registro MCP por familias | 2026-09-23 | Fuente `e4e7499`, test `9c66447`; GitOps `4004f732` | Catálogo productivo de 18 tools idéntico; Synced/Healthy; ticket Ready for Human Review v7 sin claim | [260923-rf8](./quick/260923-rf8-ticket-129-modularizar-registro-mcp/) |
| 260923-rf7 | Ticket 127: dividir TrackerService por capacidades | 2026-09-23 | Fuente `c99686e`; GitOps `f77145cd` | Gates completos y despliegue Synced/Healthy PASS; ticket Ready for Human Review v7 sin claim | [260923-rf7](./quick/260923-rf7-ticket-127-dividir-tracker-capacidades/) |
| 260923-rf6 | Ticket 126: invariantes transaccionales compartidas del tracker | 2026-09-23 | Fuente `d5bba0d`; GitOps `165cda3e` | Gates completos y despliegue Synced/Healthy PASS; ticket Ready for Human Review v6 sin claim | [260923-rf6](./quick/260923-rf6-ticket-126-invariantes-transaccionales/) |
| 260923-rf3 | Ticket 125: primitivas seguras compartidas de invitación | 2026-09-23 | Fuente `4779b8d`; GitOps `b0e77964` | Gates completos y despliegue Synced/Healthy PASS; sin cambio de contrato | [260923-rf3](./quick/260923-rf3-ticket-125-unificar-invitaciones/) |
| 260923-rf2 | Ticket 124: esquema Drizzle modular sin cambio SQL | 2026-09-23 | Fuente `16d4df6`; GitOps `b3ddcbf0` | 42 tablas sin drift; gates y despliegue Synced/Healthy PASS | [260923-rf2](./quick/260923-rf2-ticket-124-modularizar-schema/) |
| 260923-rf1 | Ticket 123: red de seguridad y mapa de refactor | 2026-09-23 | Fuente `d695272` | Lint/types, 76 caracterización, 199 fast tests y schema drift PASS; sin cambio runtime | [260923-rf1](./quick/260923-rf1-ticket-123-red-seguridad-refactor/) |
| 260917-onb | Onboarding autocontenido para agentes, MCP y skill | 2026-09-17 | Fuente `5131c64`; GitOps `cbf58075` | Gates/Compose/Argo/smoke responsive PASS; ticket 115 Ready for Human Review | [260917-onb](./quick/260917-onb-onboarding-agentes-mcp-skill/) |
| 260916-llb | Gmail de Gremiox, privacidad y guía de piloto Google | 2026-09-16 | 6005ace, f5dbbc4; GitOps33a99f6e, a3704a4a | Desplegado, SMTP/gates/restore/smoke PASS; recepción y Google pendientes del Owner | [260916-llb](./quick/260916-llb-epic-3-reutilizar-correo-de-gremiox-y-gu/) |
| 260914-koj |96 gestión versionada de miembros/proyectos |2026-09-14|3156b31; GitOps7f6d9515|Gates/restore/smoke PASS; revisión humana|[260914-koj](./quick/260914-koj-epic-3-ticket96-gestionar-miembros-y-per/) |
| 260914-k34 |95 permisos read/edit y UI Chrome |2026-09-14|23d789e; GitOpsb69e88b9|Gates/restore/smoke PASS; revisión humana|[260914-k34](./quick/260914-k34-epic-3-ticket95-permisos-lectura-edicion/) |
| 260914-jhl |108 contexto multiworkspace |2026-09-14|390f3d0; GitOpscbf737cd|Gates/restore/smoke PASS; revisión humana|[260914-jhl](./quick/260914-jhl-epic-3-implementar-base-multiworkspace-t/) |
| 260913-x6a | Epic 3: contrato94, sesiones100, detalle104 y navegación109 | 2026-09-14 | `4df0a09`, `dd5d777`, `79fd7a1`, `328a386`; GitOps `0ac6550d` | Gates/restore/smoke PASS; cuatro Ready for Human Review;108/95 y resto pendientes | [260913-x6a](./quick/260913-x6a-implementar-epic-3-tras-respuestas-contr/) |
| 260913-vul | Planificar Epic 3 usuarios, roles y colaboración | 2026-09-13 | `eb4b4e1` | 14 tickets / 20 preguntas verificadas; sólo planificación, sin deploy | [260913-vul](./quick/260913-vul-planificar-epic-3-usuarios-roles-colabor/) |
| 260913-v4j | Confirmar acceso de revisión y comprobar Store tras respuesta 86 | 2026-09-13 | `c0199fd` | 2/2 respuestas; reviewer smoke PASS; Store Pending review, sin deploy | [260913-v4j](./quick/260913-v4j-confirmar-acceso-de-review-del-ticket-86/) |
| 260913-u1g | Epic 7 respuestas, evidencia Store y detalle Member 91 | 2026-09-13 | `e8be86a`, `be31905`; GitOps `b0240335` | Gates/restore/smoke PASS; 84/85/91 Ready for Human Review; 86/87/88 external gates pending | [260913-u1g](./quick/260913-u1g-continuar-epic-7-tras-respuestas-validar/) |
| 260913-qn7 | Cuenta Member y proyecto aislado para revisión Google | 2026-09-13 | `e05ff24` | 160 tests PASS; OAuth/imagen y formulario privado Google verificados; Store Draft | [260913-qn7](./quick/260913-qn7-preparar-cuenta-member-y-proyecto-aislad/) |
| 260910-f5d | Chrome: enlace de éxito y acciones finales apiladas | 2026-09-10 | `c76a591` | 220 tests PASS; 0.5.4 CSS live, 0.5.3 runtime/confirmation preserved; 56 Ready for Review | [260910-f5d](./quick/260910-f5d-mejorar-enlace-y-apilar-acciones-de-tick/) |
| 260910-euw | Chrome: fusionar búsqueda y selección de Proyecto/Epic | 2026-09-10 | `b5795e6` | 219 tests PASS; 0.5.3 loaded, draft preserved; 54 Ready for Review | [260910-euw](./quick/260910-euw-unificar-busqueda-y-seleccion-de-proyect/) |
| 260910-ehq | Chrome: selectores accesibles dentro del panel | 2026-09-10 | `fb11c41` | 218 tests PASS; 0.5.2 loaded, draft preserved; 53 Ready for Review | [260910-ehq](./quick/260910-ehq-corregir-selectores-chrome-desplazados-f/) |
| 260910-e2r | Chrome: aviso cerrable y ayuda permanente en Cuenta | 2026-09-10 | `dbfc597` | 215 tests PASS; 0.5.1 loaded, draft preserved; 52 Ready for Review | [260910-e2r](./quick/260910-e2r-convertir-informacion-de-chrome-en-aviso/) |
| 260910-d89 | Chrome: pegar/subir varias imágenes al ticket | 2026-09-10 | `4426dc6`, `22b7e89`; GitOps `4eb5b1ec` | 213 tests + Compose PASS; deployed/connected; 51 Ready for Review | [260910-d89](./quick/260910-d89-simplificar-chrome-a-pegar-o-subir-varia/) |
| 260910-cw3 | Chrome: cuenta en diálogo desde el botón de usuario | 2026-09-10 | `f6aa3e6` | 217 tests PASS; 0.4.3 loaded/connected; 50 Ready for Review | [260910-cw3](./quick/260910-cw3-mover-cuenta-de-chrome-al-boton-de-usuar/) |
| 260910-cbj | Chrome: explicar fallos de captura con causa y pasos específicos | 2026-09-10 | `db26d87` | 216 tests PASS; 0.4.2 loaded/connected; 49 Ready for Review | [260910-cbj](./quick/260910-cbj-aclarar-errores-de-captura-chrome-con-ca/) |
| 260910-cbm | Chrome: botones Crear proyecto/Epic arriba del compositor | 2026-09-10 | `724a2da` | 183 tests PASS; 0.4.1 loaded in connected test Chrome; server unchanged | [260910-cbm](./quick/260910-cbm-mover-crear-proyecto-y-crear-epic-arriba/) |
| 260909-vje | Complete Chrome capture-to-ticket, private storage, drafts, release and production verification | 2026-09-09 | Source `e5da82f`; GitOps `db767e30`, docs `fac0669d` | Technical delivery verified; owner acceptance in 33 | [260909-vje](./quick/260909-vje-completar-epic-chrome-dom-adjuntos-priva/) |
| 260909-tfb | Chrome OAuth 21 + capture 23 and local part of editor 25 | 2026-09-09 | Source `2d9b376`, `def5297`; GitOps `5a6b2c2e` | 21/23 verified, Ready for Review; 25 partial | [260909-tfb](./quick/260909-tfb-oauth-humano-y-captura-local-segura-de-l/) |
| 260909-r6j | Chrome Epic: decisiones aprobadas y base MV3/panel lateral, tickets 19–20 | 2026-09-09 | `18658bb`, `1b59442` | Verified; Ready for Review in Issopen | [260909-r6j](./quick/260909-r6j-implementar-ext-01-y-ext-02-del-epic-chr/) |
| 260902-ght | Epics de proyecto, filtro del tablero y detalle de tickets relacionados | 2026-09-02 | `dd2434c`, `70a8a43` | Verified | [260902-ght](./quick/260902-ght-a-adir-epics-de-proyecto-para-agrupar-is/) |
| 260902-mmt | Publicar Epics por GitOps y validar producción | 2026-09-02 | `144ca29`, `2de2c41`, `7f27149` | Verified | [260902-mmt](./quick/260902-mmt-publicar-la-imagen-de-issopen-con-epics-/) |
| 260907-vpo | Seis variantes y refinamiento de seis piezas en verde bosque y menta | 2026-09-07 | `96de32a`, `cfe220d` | Verified | [260907-vpo](./quick/260907-vpo-explorar-seis-variantes-verdes-y-moradas/) |
| 260907-wrj | Aplicar logo, favicon y paleta bosque/menta en toda la web y documentar la decisión | 2026-09-07 | `d206bc6` | Verified | [260907-wrj](./quick/260907-wrj-aplicar-la-identidad-aperture-de-seis-pi/) |
| 260908-ja5 | Desplegar identidad bosque/menta por GitOps y verificar producción | 2026-09-08 | Fuente `2b0bb5a`, GitOps `a1956385` | Verified | [260908-ja5](./quick/260908-ja5-desplegar-la-identidad-bosque-y-menta-de/) |
| 260908-kiy | Añadir fondo blanco al favicon y desplegar la corrección | 2026-09-08 | Fuente `5e2debd`, GitOps `4527b882` | Verified | [260908-kiy](./quick/260908-kiy-a-adir-fondo-blanco-al-favicon-de-issope/) |

### Blockers/Concerns

- Epic 3: product and operational questions answered, implementation delivered.
  97 needs actual requested-email receipt,98 needs Owner's distinct Google pilot,
  107 needs its real collaboration evidence. Follow docs/google-pilot.md; do not
  repeat provider/operator questions or replace Google with fixture acceptance.

- Epic 7: Google approval/manual publication and real Store pilot/update gates
  in 87/88 remain. Access clarification 86 is resolved: keep the current local
  Member and private instructions during review. Unpacked smoke is not Store
  acceptance. No unanswered question remains in 86 as of 20:26 UTC.

- Phase 1 uses an operator-only singleton bootstrap and recovery that revokes
  sessions; no anonymous owner-creation route is allowed.

- Phase 1 needs a reachable HTTPS URL and the minimum OAuth client flow that ChatGPT Work actually accepts; broad client compatibility is explicitly deferred.
- Codex is the selected dogfood code agent. It receives a one-time, hashed and
  revocable PAT with a project allowlist and no default close scope; repository
  credentials remain outside Issopen.

- The previous `01-DISCUSS-CHECKPOINT.json` describes the superseded portability-first phase and must not be resumed as the current scope.
- The DOM privacy contract, audit semantics, legal license, and Cloud limits require evidence in Phases 5, 7, 8, and 9 respectively.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-09-17
Stopped at: ticket115 agent onboarding deployed/verified at GitOps cbf58075; human review remains. Existing external Owner gates for97/98/107 and Store87/88 remain unchanged.
Resume file: ./quick/260917-onb-onboarding-agentes-mcp-skill/260917-onb-SUMMARY.md
