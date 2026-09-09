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
| Install, discover, remove, rollback, local changes | Seven installer tests, structural validator; native app-server discovery | Passed. One enabled skill discovered. No UI interaction in the editor claimed. |
| Native connection, read-only Epic, pagination | Native app-server MCP read and a fresh CLI model using the skill | Passed for query. Twelve real tickets read; no mutation tools exposed in that read-only run. |
| Repository identity, ambiguity, allowlist | Repository helper tests; MCP integration isolation | Passed at helper/service level. Production project association not filled by inference. |
| Empty Epic, create/update, scopes | MCP integration with real database and separate identities | Passed. Existing scopes are unchanged by enum migration; Epic scopes opt-in. Not a native model write acceptance. |
| Full plans, reuse, GSD derived context | Renderer/context tests and independent forward review | Passed for meaningful invariants. Full native planning/repeated planning still needs write-capable client acceptance. |
| Saved choices and Other, changed answers | Question/context tests; HTTP/domain integration | Passed. Answer versions checked independently of issue version. Native fixture correctly read Other=Hola without re-asking. |
| Next Ready, own claim, tests and review | Selection/checkpoint tests, MCP integration and Chromium dogfood | Passed at component/service/browser level. Fresh native execution is BLOCKED before claim, see below. |
| Conflicts, retries, revocation, lost response | Guards/idempotency integration; retry helper; two-editor Chromium tests | Passed. Draft preserved; explicit comparison/rebase; no silent replay with changed data. |
| Notify-only update and rollback | Five update tests and installer tests | Passed. No auto-update, timeout doesn't block work, version-aware notification. No stable release tag published. |
| New editor UI session and real pilot | Not performed | Pending in 43/44. App-server discovery is not editor UI acceptance. |

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
