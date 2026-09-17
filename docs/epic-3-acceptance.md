# Epic3 acceptance matrix107

15Sep2026, derived from all20 answeredv2 decisions. Source of truth remains
[Epic3](https://issopen.serviciosegado.com/epics/c3b6a630-824e-473a-add9-ac41bf63e38c).
This matrix records completed technical verification and explicit external gates;
it is not a blanket production/Google certification or permission to close tickets.

## Approved branches and concrete evidence

Paths below are relative to this source repository. All test fixtures are isolated
synthetic identities; using two browser sessions is not two real Google accounts.

| Ticket / decision | Implemented boundary | Automated evidence |
| --- | --- | --- |
|94 roles;108 multiple workspaces | Owner/Member, explicit membership, per-tab context, no implicit grants | integration/multiworkspace + multiworkspace-migration; e2e/multiworkspace |
|95 project read/edit | Fresh workspace+project checks, hidden data404, no Member admin | integration/http, extensions, mcp; e2e/project-permissions |
|96 zero projects; remove/reinvite | Versioned permission deltas, zero-project waiting, removal scoped to membership | integration/http, member-access-migration; web/member-access; e2e/member-access |
|97 email+manual, requested reminders | Disabled configurable encrypted outbox; one generation, bounded retries; no auto reminders | integration/invitation-mail; unit/invitation-mail; web/invitation-mail; e2e/invitation-mail |
|98 post-login target | One project direct, many choose, zero wait; Google invitation protocol preserved | integration/auth; web/invitation-onboarding; e2e/onboarding |
|99 profile+avatar, minimal directory | Own profile, sanitized raster avatar; others' names/roles not emails | integration/profiles, profile-migration; unit/profiles; e2e/profiles |
|100 own sessions, Chrome separate | Current/other/all own web sessions only; installations separate | integration/auth, extensions; unit/account-sessions; e2e/account-sessions |
|101 one assignee or none | Fresh editable candidate; independent canonical Owner/agent claim; snapshot after removal | integration/assignments, assignment-migration; e2e/assignments |
|102 recipient optional, any editor answers/reviews | Advisory recipient; CAS question versions; preserve drafts; mine filter | integration/assignments; e2e/question-recipients |
|103 in-app directed only | Explicit mentions, idempotent comments, own inbox, stale-action state; no watchers/email | integration/notifications; e2e/notifications |
|104 clean refresh / dirty compare | Independent browser changes, drafts retained, explicit reconciliation, revoked-access clearing | e2e/detail-live, conflicts, board-live; web detail tests |
|105 protected transfer | Both recent server-proven logins, named confirmation, atomic roles/grants/issues, operator recovery explicit | integration/ownership; unit/auth-assurance; e2e/ownership |
|106 Owner-only administration audit | Existing ledgers; immutable snapshots, whitelisted details, filter-bound microsecond pagination | integration/access-audit, member-access-migration; e2e/access-audit |
|109 mobile navigation | Navigation closes after route change, board remains usable | e2e/member/account/project flows, production1440/360 smoke |

Tests in table live under tests/; extensions/chrome/tests separately checks16unit
and13browser flows including linking, selection, privacy, retry and idempotency.
Keyboard actions/native controls are exercised by Testing Library and Playwright;
mobile360px and desktop1440px include no-horizontal-overflow assertions.

## Cross-boundary and negative acceptance

- integration/http exercises Member read versus edit across project/epic/issues,
  comments/questions/board/SSE and membership permission changes. Negative IDs
  cannot become accessible because the actor owns some different workspace.
- integration/extensions tests intersection of current project edit rights and
  frozen installation scopes, foreign image denial, crossworkspace isolation,
  removal revokes only its installation; own web logout does not unlink Chrome.
- integration/mcp preserves agent identity, project allowlist, scopes, approvals,
  idempotency/version failures. Web Member session is not an agent credential.
  New profile/assignment/recipient/mail/admin mutations do not grant MCP powers.
- integration/notifications revalidates destination access, excludes removed
  projects/issues/Epics from counts/content, private read flags/cursors. Explicit
  mention never grants access. Duplicate retry cannot duplicate notification.
- integration/ownership validates fresh trusted login proof (not invitation
  session.createdAt), stale proposal/logout/cancel/concurrency and rollback on
  audit failure. Historical authors/assignees/agentclaims stay; no live transfer.
- Owner-only admin data and invitations use no-store including errors. Failed
  reload clears visible private data. Ordinary personal sessions are not copied
  into another Owner's admin audit. Attachments remain authenticated and private.

## Delivery and operational proof

17Sep ticket98 continuation: source222348d/GitOpsa50b27ab/digest0af833aa is
Synced/Healthy/Ready with zero restarts and unchanged PVCs. A regression first
reproduced the replacement-invitation failure, then verified bounded adoption of
only an abandoned unverified identity with no provider, access, ownership or
competing active claim. The real Google invitation completed and landed the Member
directly in its sole project; only that project was listed and the foreign Minecraft
URL returned the generic unavailable page. Production read-only verification found
exactly one accepted invitation, verified Google account, workspace membership and
project grant. A separate ordinary Google re-login has reached its passkey challenge
and still needs user presence before ticket98 can claim that final persistence step.

16Sep continuation: sourcef5dbbc4/GitOpsa3704a4a/digest65141db3 observed
Synced/Healthy/Ready0restarts/readinessJSONok/PVCs unchanged. Gmail enabled in
separate Secret, local/master/live-secret SMTP verify PASS without sending mail.
Queue0 at activation; user requests the first real invitation. Public privacy1.2
and authenticated Member smoke1440/360 PASS. A mobile min-content overflow found
by the first smoke was reproduced and fixed before the successful second smoke.
Final gate167unit/web111integration38webE2E+2skips,Chrome16+13/reproducible0.6.3,
scan414,ComposePASS; backuprestore113issues1041events13matchingimages19receipts.
SMTP authentication is not receipt or Google acceptance. Guide delivered in98.

Historical 15Sep release:

Final97/107 technical delivery: source3747d74, GitOps06a3d262,
imageinvitations-3747d74 digest135f9430, Healthy/Synced/Ready1/1/0restarts,
readinessJSONok and unchangedPVCs.167unit/web111integration36webE2E+2expected
skips,Chrome16unit13E2E,reproducible0.6.3,scan409,ComposePASS. Backuprestore
113issues1011events13matchingimages19receipts. Production1440/360 safeMember
smokePASS;0030 tableexists/mailJobs0/maildisabled/noSMTPcredentials/queueWarnings0.
No real pilot or Store acceptance claimed. Later source-doc commit only records
verification; runtime remains the exact3747d74 image above.

Each increment has a quick GSD summary, source commit link and GitOps commit in
its ticket. 106 source5044a29 / GitOps66d84b95 / imageaudit-5044a29 digest60980357
was observedHealthy/Synced with Ready1/1,0restarts and readinessJSONok. Positive
Owner audit tests ran locally; production reviewerMember received403/no-store.
Production smoke used dedicated new password sessions only, preserved existing
sessions/Google reviewer data and grants, and tested private image/foreign404,
account/profile/directory/assignments/questions/inbox/ownership at1440/360.

Backups before every schema increment include DB dump and private attachments;
restore uses disposable PostgreSQL18.6 with networknone, checks dump/archive SHA256
and each image's byte count/hash. Migration tests exercise old rows to new schema,
not just an empty DB. PVC identities and5GiRWOlocal-path remain unchanged. No
rollback below permission/multiworkspace boundaries; forward fix or controlled
restore after explicit incident authorization, not dropping tables/history.

Host Chromium network changes were traced to unrelated restarting Laurotech n8n;
production smoke uses official Playwright image in its own network namespace,
nonroot, read-only minimal mounts, no Docker socket, no privileges, TLS unchanged.
No unrelated workload was changed. This does not hide an IssopenHTTP error.

97 final full gates/backup/immutable delivery are recorded in its GSD summary and
live ticket; this document is included in that source release.107 needs those
technical gates plus the two real pilot prerequisites below to declare acceptance.

## External gates still blocking full acceptance

16Sep: both operational questions are answered. The Owner clarified in chat:
reuse Gremiox mail now; the Owner will perform the real Google trial. The remaining
gate is evidence, not another unanswered provider/operator decision.

1. **97**: Google Gmail SMTP, From serviciosegado@gmail.com; local and master
   authentication/TLS passed without sending. Separate mail Secret and privacy1.2
   prepared for declarative activation, no DNS/Gremiox/Google login changes.
   Owner must request a real invitation to their controlled pilot and confirm
   receipt; SMTP verify or accepted status is not inbox proof.
2. **98**: Real Google browser/OIDC acceptance, one-project landing and foreign
   project denial pass with a controlled invited account. The remaining pilot step
   is to complete the already-open ordinary Google re-login with user presence and
   confirm the same single-project access persists. Never reuse Store reviewer for
   role experiments; mocked OAuth or an existing Owner is not equivalent.
3. **107** depends on97/98 pilot evidence: record invitation acceptance, permitted
   project/denied project, assignee/question/mention/conflict, mobile and errors
   with authorized human identities. Do not mark complete based on automation.

No new product question for107: record the real trial result rather than
duplicating answered questions. Technical work is not stopped by that acceptance.
Store review87/88 belongs toEpic7 and remains separate; localChrome0.6.3 tests
do not prove approval of submitted0.6.2 or permission to resubmit the Store item.

Deferred by rejected alternatives: Admin/Viewer workspace roles, suspension,
public signup, automatic reminders, activity email/watchers, multiple assignees,
exclusive question answering, merged web/Chrome logout, MCP admin mutations.

Dependency audit additionally reports one pre-existing moderate esbuild dev-
server advisory through drizzle-kit/BetterAuth. Production serves built assets,
not that development server. No all-dependency-clean claim; dependency maintenance
is separate from successful functional gates, and should be tracked explicitly.
