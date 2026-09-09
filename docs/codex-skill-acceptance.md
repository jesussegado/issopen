# Codex skill: acceptance checkpoint — 2026-09-09

Scope: Epic 4, "crear skill para usar desde codex". Issopen remains the
canonical plan and decision store. This is derived verification evidence, not
permission to publish, create production credentials, or close tickets.

## Revisions and actual surfaces

- Native client: codex-cli 0.153.0, shipped with the installed editor extension.
- Native read-only model session: skill 71b29a8, isolated installation; production
  MCP server a4cabe5. Twelve tickets traversed in three pages (5/5/2), cursor
  exhausted. Agent identity, project/Epic and effective scopes checked; no writes.
- Native execution fixtures: skill 8d5470f; local Hono, real PostgreSQL 18.6,
  synthetic owner/agent and a disposable Git repository. Production untouched.
- Notify-only version comparison corrected in fa979b6: older/equal/unknown
  versions are not incorrectly described as newer releases.
- Production: image plan-guards-a4cabe5, digest
  sha256:136db447a56d1d00fbb71967ed760edd46af11d2db7f3f907eada7c4e87184b1.
  Argo revision 235e7a921712d6ea74d474f93d476b0fb53a1412, Synced/Healthy.
  Application and PostgreSQL are 1/1 Running with zero restarts; public readiness
  returned status ok. Later commits are skill/test/documentation only.

## Acceptance matrix

| Scenario | Evidence | Result / boundary |
| --- | --- | --- |
| Install, discover, remove, rollback, local changes | Seven installer tests, structural validator; native app-server discovery | Passed. One enabled skill discovered; candidate also invoked from the editor UI. |
| Native connection, read-only Epic, pagination | Native app-server MCP read, fresh CLI model and isolated editor query | Passed for query. CLI traversed twelve real tickets; editor read the synthetic Epic/answer with zero domain mutations. |
| Repository identity, ambiguity, allowlist | Repository helper tests; MCP integration isolation | Passed at helper/service level. Production project association not filled by inference. |
| Empty Epic, create/update, scopes | MCP integration with real database and separate identities | Passed. Existing scopes are unchanged by enum migration; Epic scopes opt-in. Not a native model write acceptance. |
| Full plans, reuse, GSD derived context | Renderer/context tests, forward review, native editor planning and repeated request | Functional planning/repeat passed: complete plans, linked existing work, preserved human note/answer, same IDs/content/events on repeat. Initial create approval is inconclusive and excluded from approval evidence; see checkpoint below. |
| Saved choices and Other, changed answers | Question/context tests; HTTP/domain integration; synthetic web answers and fresh native query | Native query read changed Other at question v3 while issue remained v2 and identified stale plan without writing. Explicit changed-answer planning resume is still pending. |
| Next Ready, own claim, tests and review | Selection/checkpoint tests, MCP integration, Chromium dogfood and native editor fixture | Passed in the native editor: own claim, In Progress, actual edit/test, one attributed comment, guarded Ready for Review and released claim. |
| Conflicts, retries, revocation, lost response | Guards/idempotency integration; retry helper; two-editor Chromium tests | Passed. Draft preserved; explicit comparison/rebase; no silent replay with changed data. |
| Notify-only update and rollback | Five update tests and installer tests | Passed. No auto-update, timeout doesn't block work, version-aware notification. No stable release tag published. |
| New editor UI session and real pilot | Owner-authorized query/execution plus reopen/resume of the actual editor conversation | Native execution passed. Remaining planning/changed-answer/failure scenarios stay open in 43; real pilot remains pending in 44. |

## Native execution: blocked safely, not a passing pilot

The opt-in executable fixture is scripts/verify-native-skill.mjs. Run from the
source root with an authenticated native Codex binary and Docker:

    pnpm exec tsx scripts/verify-native-skill.mjs /absolute/path/to/codex

It starts a loopback-only test MCP and disposable database, installs a pinned
skill in a temporary repo, and seeds a single Ready issue with a saved Other
answer. It requires an actual source change, independent Node test, attributed
comment, Ready for Review and released claim. It cannot pass merely because the
model says it succeeded. Its sanitized report records client/revision, actual
domain state and tool calls. It stops its server/database after either outcome.
This model test is opt-in (time/inference cost), not part of the deterministic CI
suite. Its fresh installation comes from Git HEAD, not uncommitted skill files.

Both attempts stopped at claim_issue. The second provides the precise native
client error:

    MCP tool call requires approval, but approval policy is never

Fixture /tmp/issopen-native-acceptance-R697NJ:

- Ticket stayed Ready and unclaimed; zero agent mutations/comments.
- Saved Other answer stayed Hola, one answered question, zero unanswered blockers.
- No source changes. The existing test stayed failing, as expected before work.
- Codex reported the permission gate; it did not bypass via REST, SQL or owner.
- Sanitized evidence: acceptance-results/report.json inside that fixture.

Do not change the user's approval policy, mislabel mutations as read-only, or use
an alternate route to make this blocked test appear successful. Complete the
positive native write flow through an appropriately approved interactive client.
The test exits nonzero until that full flow is observed.

## Owner-approved isolated editor preparation — 2026-09-09

The owner approved preparing an isolated interactive session, not changing the
global Codex configuration. The fixture now supports:

    pnpm exec tsx scripts/verify-native-skill.mjs /absolute/path/to/codex --editor

This creates a separate VS Code user-data/extensions directory and uses the
already-installed Codex extension with a temporary launcher. Only that process
receives the synthetic MCP credential and on-request, user-reviewed write
approvals. The personal Issopen skill is disabled only for that process; the
candidate is installed into the disposable repository. The harness does not
overwrite global config or the personal installation. The extension can persist
a project-trust entry when creating a thread; inspect the hash check and remove
only that identified temporary entry during cleanup, preserving unrelated edits.

The launcher prints the fixture path, PID and loopback URL, never its credential.
`START-HERE.md` contains the read-only and bounded execution prompts. The owner
must authorize the temporary folder if VS Code shows Restricted Mode; do not
disable workspace trust or approve MCP writes on their behalf. Query the printed
`/__acceptance/status` URL for independent database state, events, changed files,
the real Node test result and a global-config hash comparison. SIGINT/SIGTERM to
the printed harness PID saves a sanitized report outside the repo and stops the
test server/database. Close only the isolated editor window when finished.

Observed checkpoint (12:17 UTC):

- VS Code 1.135.0, Codex extension 26.901.22334, native CLI 0.153.0.
- Candidate skill pinned to 4a5c0bf; native app-server discovery confirmed exactly
  one enabled copy in `/tmp/issopen-native-acceptance-kKpc80`.
- Discovered a checker defect: disabled personal copies were counted as active
  duplicates. The checker now ignores explicitly disabled copies while still
  rejecting multiple enabled copies.
- The isolated VS Code window reached its visible Workspace Trust screen. The
  extension is not active under Restricted Mode; owner authorization is pending.
- Synthetic ticket remains Ready, unclaimed, Other=Hola, zero agent events or
  comments, no source changes. The Node test intentionally remains failing
  before implementation. Global config hash is unchanged.
- Regression verification after the checker correction: 75 unit/web tests
  passed (including four protocol-fixture discovery cases), lint and TypeScript
  passed, secret scan passed on 164 files. Those four cases are mocked protocol
  tests, not additional native model acceptance.

### Editor query passed after owner trust — 12:24 UTC

The owner completed Workspace Trust. A fresh conversation was started and its
prompt submitted through the actual Codex panel, not an SDK imitation:
`01a0861e-4f60-7681-afc6-e6ab8b93c4a7` (12:22:31–12:24:39 UTC).

- Invoked the isolated candidate and used native `get_agent_context`,
  `list_projects`, `get_project`, `list_epics`, `get_epic`, `list_issues` and
  `get_issue` tools.
- Correctly identified the synthetic identity, ten effective scopes (no close),
  exact one-project allowlist and matching repository association.
- Read ticket version 2 and question version 2; reported the saved Other=Hola
  and zero unanswered blockers, not the recommended Hello. Missing release-source
  configuration did not stop the query or trigger an installation change.
- Independent loopback snapshot confirmed Ready, unclaimed, zero agent events
  or comments and no changed source files. The fixture test remains intentionally
  failing until the execution stage.
- The extension automatically added the temporary folder's trust entry to the
  global Codex config. The operator removed only that new stanza; the harness
  SHA-256 comparison then confirmed the exact original config was restored.
  The owner-approved trust in the isolated VS Code profile and process overrides
  remain available; no permissions were broadened to bypass a prompt.

Private UI evidence lives in `/tmp/issopen-ide-control-9PKiLo` (not Git).
The bounded execution prompt was submitted in that same panel with
on-request/user approvals preserved. At 12:27 UTC the model had verified the
eligible Ready ticket and current answer, then requested `claim_issue`. The UI
displayed the actual approval card with that synthetic issue UUID and a stable
idempotency key. It is waiting for the owner to select Allow once; the operator
did not approve it. No domain/source mutation had occurred at this checkpoint.
This query and approval request do not yet establish native writes, a release
or the real pilot. Ticket 43 stays open.

At 12:28 UTC the owner approved `claim_issue` once in the editor. The independent
snapshot confirmed the claim belongs to synthetic agent
`8505e981-65b6-4daf-89b5-55d6f03d9687` and exactly one `issue.claimed` event. This
is the first verified native editor mutation. No source files or saved answers
changed; the global config hash still matches the original. The model reread
the issue, checked ownership and unchanged plan/questions, and requested
`move_issue` to In Progress with expectedVersion=3 and the complete question
version set. The owner subsequently approved that transition.

At 12:31–12:32 UTC the native editor model changed only `greeting.mjs` from
Hello to Hola and ran `node --test greeting.test.mjs`: exit 0, one passed,
zero failed. The operator independently reran the same test and checked the
diff, staging area, untracked files and Git history: exactly one modified source
file, no staged/untracked additions and no new commits beyond the fixture
baseline. The independent database snapshot reports In Progress, the correct
claim, unchanged Other=Hola and only claim/status-change events. Global config
hash still matches the original.

The model compared current plan and question versions again, rendered an
evidence comment with commands/results and explicitly pending delivery steps,
then requested `add_comment`. Its actual approval card is visible in the editor
and awaits the owner. Code/test acceptance has passed for this fixture; evidence
publication, Ready for Review and claim release remain incomplete. No Done,
release, deployment or real pilot is claimed.

At 12:34 UTC the evidence comment was confirmed in the synthetic database after
owner approval, with agent attribution and one `issue.comment_added` event.
The model reread the issue, verified the comment's author and unchanged context,
and requested the transition to Ready for Review with expectedVersion=4 and
the complete question-version set. That approval is now visible; the ticket
still remains In Progress with its own claim until approval. Release is also
pending. The test remains passing and the global config hash unchanged.

### Editor execution and reopen/resume passed — final snapshot 13:34 UTC

The owner closed the isolated Codex window while the guarded review transition
was pending. The operator reopened the same isolated profile/repository and
conversation, then submitted a bounded resume request. The native model reread
identity, current ticket/questions, activity and the existing evidence comment.
It did not repeat the source change or duplicate the comment.

With the owner's interactive approvals, the native client moved the ticket to
Ready for Review using expectedVersion=4 and the complete question-version set,
then released its own claim. The review operation retained its original
idempotency key across the reopen. Final issue version was 6.

Independent report saved at shutdown:
`/tmp/issopen-ide-control-9PKiLo/final-report.json` (13:34:25 UTC):

- Ready for Review; claimedByAgentId=null.
- Exactly one attributed agent comment and five agent events: claimed,
  status changed, comment added, status changed, released.
- Saved Other=Hola unchanged; real Node test passed (1/1).
- Only `greeting.mjs` changed; separate Git checks confirmed no staging,
  untracked additions or new commits beyond fixture baseline 47b3aad.
- Exact original global config hash restored; personal skill unchanged.
- No production work item, deployment, release or implicit Done.

This establishes native editor execution and recovery of a pending checkpoint,
not recovery after a changed answer. Some final native read calls overlapped
harness shutdown; the independently persisted domain report establishes the
successful transition/release. The old loopback server/database is now stopped;
do not count a newly seeded database as a continuation of this fixture.

### Planning and changed-answer fixture

Run the same pinned candidate with an additional empty Epic:

    pnpm exec tsx scripts/verify-native-skill.mjs /absolute/path/to/codex --editor --planning

Add `--background` when a terminal runner may stop long-lived commands. This
launches the same harness detached, prints its PID and a private log path, and
does not change approval policy. Wait for `editorFixtureReady` in that log before
using it. To finish, send SIGTERM to that exact harness PID: it saves its report
and closes only its test server/database. Do not leave disposable services running
after acceptance. Closing the editor alone does not terminate the harness.

The project already contains one greeting ticket and a saved Other answer.
The request asks for a named greeting and a local CLI: inspect whether the model
reuses that ticket, preserves the human note/answer, writes complete functional
plans, and asks the genuinely unresolved output-format question. Repeating the
request must preserve identities and avoid equivalent tickets/questions.
Read `planning` in the independent snapshot for full plans/questions; inspect
meaningful content as well as counts. All writes still require human approval.

The private control directory also holds `synthetic-owner.json` (0600) to drive
answers through the disposable web UI. This is fixture setup, not an agent
answering production questions. Record the first answer, then its changed
version before explicitly requesting resume in a fresh native conversation.
Compare question versions independently from issue.version and ensure no stale
plan wins. The snapshot now includes staged/untracked files, baseline/current
commit and remote equality as well as unstaged changes.

Preparing this harness is not a passing model test. Record each observed stage
and leave ticket 43 open until its outstanding acceptance criteria are satisfied.

At 13:51–13:53 UTC, fresh native CLI conversation
`01a08670-5003-7952-a752-c69d39bdc513` queried the new fixture
`/tmp/issopen-native-acceptance-K6YeaT` (candidate 4a5c0bf). It resolved Epic
number 2 to UUID `e7831454-dd59-4e50-bdbc-f14f5ede236d` using `list_epics`,
then `get_epic` and the scoped child listing confirmed zero tickets and no next
cursor. Identity/allowlist and repository association matched. The native turn
completed successfully, retained the installed version without release-source
configuration and did not execute the planning instructions found in START-HERE.
Its final response lives privately in the control directory
`/tmp/issopen-ide-control-n4K3NM/empty-epic-query.txt`.

Independent snapshot after the query: zero agent events, no changed/staged/
untracked files, baseline commit and remote unchanged, empty Epic unchanged.
The native client persisted a temporary project-trust entry in global config
when creating the thread; the operator removed only that stanza and verified
the original hash again. This client side effect is not attributed to a skill
tool mutation. An unrelated global MCP startup timed out during shutdown;
the Issopen calls themselves completed successfully. Empty-Epic native query:
PASS. Native mutating planning and changed-answer resume are still pending.

The terminal-owned harness subsequently received SIGTERM (exit 143) at 13:55 UTC.
Its final report preserved the same zero-mutation assertions, which were checked
again after shutdown. The exact source of the signal was not established. A new
background fixture was started at 13:58 UTC, PID 2517887 (parent PID 1), not a
continuation of that database. Private launcher log:
`/tmp/issopen-native-launch-Uta13p/fixture.log`; control:
`/tmp/issopen-ide-control-MPtIb5`; repo:
`/tmp/issopen-native-acceptance-jck3x2`; loopback `http://127.0.0.1:40385`.
Candidate revision 62908c4 has unchanged skill contents. New project UUID
`d8d42e16-9f4e-45c2-9824-87847d59824b`, empty Epic
`66543fe1-cff5-49db-9517-8b246ca70f0d`. Read its START-HERE planning prompt after
the owner authorizes the new folder in VS Code. Initial snapshot: zero agent
events, original repository and global configuration, saved Other=Hola.

At 14:54 UTC the owner-trusted editor started native conversation
`01a086a9-ee45-7fd0-9074-ddab1f8397f4`. It read the target Epic, existing ticket
and saved Other=Hola v2. At 14:58 UTC it created synthetic ticket
`903b1277-3787-476e-812a-d1841ac04956` for the optional-name library result,
in Backlog with a detailed plan and an explicit dependency on the existing
greeting ticket. Independent snapshot: one issue.created event, original answer
and human Epic note preserved, no on-disk file changes. Full planning: NOT passed.

Input automation lost focus: the initial native message was incomplete, a later
typing attempt changed only the unsaved START-HERE editor buffer, and the full
prompt was subsequently queued. The first write's approval coincided with operator
keyboard actions, so genuine owner approval cannot be established for that step.
Treat that approval evidence as inconclusive, not PASS. Stop blind keyboard/click
automation while approval cards are present. At 15:03 UTC the editor visibly
waited for owner approval of a second create_issue (local Node command); the
operator did not approve this pending request. Keep the current fixture for
continuation, not a newly seeded substitute. Once idle, discard only the accidental
unsaved buffer and verify the full prompt was received. The native client also
added temporary global project trust; global config hash is not yet restored.
Planning/reuse and changed-answer resume remain pending, as does final cleanup.

Following the owner's next approvals, the native model created the Node-command
ticket `c0afce57-6ff9-423e-b827-a7d4451f713b` and blocking question
`111ed044-0d92-4d80-80b7-92ecd4680515` v1 (plain text recommended / JSON,
unanswered). It reread the ticket and saved the question reference in its plan
using expectedVersion=1 plus the complete question-version set; ticket is now v2.
The independently reviewed plan covers library reuse, process outputs/exit code,
argument handling, tests without shell, dependencies and mutually exclusive
format branches pending the human choice. No recommended answer was selected.
Snapshot at 15:14 UTC: two created issues, one question, one issue update; both
new tickets Backlog/unclaimed, original Other=Hola v2 and Epic note unchanged,
no changed/staged/untracked files or remote changes. The editor waits for a
guarded library-plan link update, then intends the Epic map update. These are
partial planning observations, not completion/repeated-planning acceptance.

### Completed plan/repeat and changed-answer query — 15:40 UTC

The owner-approved library link and Epic map updates completed. The first native
turn ended at 15:29:37 UTC with two complete functional plans in Backlog, a single
unanswered blocking format question, links to the existing greeting result,
an acyclic 1 → 2 → 3 dependency order and the original human note preserved.
Independent state: six agent events (two creates, one question, two issue updates,
one Epic update), no claims or file changes. The first create's approval remains
inconclusive; do not use that operation to certify human approval. Later explicit
owner approvals and the functional artifacts are separate evidence.

The complete queued request was received at 15:29:38 UTC. The second native turn
finished at 15:30:50 UTC, correctly deciding no further writes were needed.
Compared the full Epic, issue details/plans/questions and agent-event sequence
against the private `planning-before-repeat.json`: identical, including IDs and
versions, not merely equal counts. Functional planning and repeated-request
reuse: PASS. This does not finish every criterion of ticket 43.

The operator then used Playwright and only the disposable owner through the local
web: selected JSON at 15:31:54.018 UTC (question v2), then changed to Other at
15:31:54.398 UTC (v3): a JSON object with greeting and name, name null when omitted.
The issue remained v2. No agent events/plan edits occurred; only the human answer
and its derived summaries changed. A fresh browser login verified the persisted
Other value and versions (exit 0). The initial web driver had completed both
saves but exited 1 during cleanup because of an unused response waiter; this was
an operator test-driver error, not a failed save or product defect. No answers
were replayed to hide that error.

Fresh native CLI conversation `01a086cd-f9d1-7c70-b1c6-dd6c8df02cec` finished
successfully after independently reading the same fixture. It found Other v3,
distinguished it from the recommended text and former single-field JSON option,
identified stale v1 references and missing name field in ticket/Epic plans, and
kept the original Hola decision and unsatisfied dependencies. No mutation or
code test ran. Private result: `changed-answer-query-result.md`; independent
snapshot: `after-changed-answer-query.json`. Changed-answer read-only resume: PASS;
explicit plan reconciliation after a new execution request is still pending.

Removed only the native client's temporary project-trust stanza; the harness
confirmed global config hash restored. The accidental START-HERE editor buffer
is still unsaved (disk unchanged); attempts to focus the isolated editor did not
reliably take focus, so do not send more blind keyboard input. VS Code now asks
to Open `vscode://openai.chatgpt/local/01a086cd-f9d1-7c70-b1c6-dd6c8df02cec` in the
isolated profile. Await the owner's one-time URI confirmation, then explicitly
request planning resume with current answers; do not implement or change approvals.
The same loopback fixture stays running for continuation. No release, pilot or Done.

## Deterministic validation and browser evidence

pnpm validate completed successfully:

- lint and TypeScript passed;
- 71 unit/web tests, 40 real-database integration tests;
- Chromium: seven passed, one intentionally skipped (duplicate mobile dogfood);
- source build succeeded; secret scan passed on 163 files at that checkpoint.

Two simultaneous web editors were tested on desktop and mobile for issues and
Epics: stale save, draft retention, loading current plan/questions, explicit
merge and save. The mobile screenshot was inspected visually. These are real
Chromium/Playwright runs, not use of an unavailable Chrome connector.

## Remaining gates and handoff

Tickets 13 and 34–42 are Ready for Review, not Done. Ticket 43 retains the
native-write/editor acceptance gap; ticket 44 retains the release/pilot gate.
No real answers have been changed for tests. The original personal installation
remains pinned to cc71a64; newer packages were installed only into disposable
fixtures. Do not mistake that initial installation for the final candidate.

Before continuing 44 the owner must confirm project/repository association and
choose a small real improvement. Readiness does not authorize the pilot.

### Credential authorization update — 2026-09-09 06:25 UTC

The owner explicitly approved the new testing credential INCLUDING issues:close.
Created `Codex Issopen pilot (testing)`, identity
`d4162df6-e07a-4f4d-a8fa-93e0646b01cf`, only for Issopen. It expires on
2026-10-09 at 06:25 UTC. MCP get_agent_context verified all 11 requested scopes
and the exact one-project allowlist. An attributed comment on ticket 44 records
the authorization and verifies comments:write. No ticket was closed.

The credential is stored outside Git in homelab's ignored
`.local/secrets/issopen-codex-pilot.env` with mode 0600. The previous identity,
grants and secret file were preserved. No token appears in this document or the
ticket. Default grants for other agents remain unchanged. This authorization
does not alter native client approval settings: the interactive acceptance gate
in 43 and the pilot/repository choice in 44 still remain.
