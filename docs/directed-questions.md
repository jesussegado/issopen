# Directed questions and human review — Epic3 ticket102

Both answers v2: optional recipient; any project editor can validate and close.
Recipient is an organizational hint, not an exclusive respondent/reviewer, grant,
workspace owner or ticket assignee. No new designated reviewer, independent-review
requirement, workflow state or reinterpretation of hidden columns. Ticket68 owns
the separate agent-review bypass decision; this increment does not change it.

0024 adds nullable recipient_user_id/restrict FK and bounded recipient_name
snapshot to issue_question, an index and joint-null consistency check. Prior
questions migrate without recipient; existing answers, timestamps, versions,
option/Otro contents and author history remain unchanged. New recipient must be
an eligible project editor because read-only users cannot answer under95. A later
removal/downgrade displays an actionable warning, keeps historical name and answer,
and allows another editor to answer/redirect/clear. It never restores permissions.
Current eligible recipients display their profile name; unavailable ones keep the
assignment-time name rather than revealing later profile edits. Correlated SQL
uses explicit qualified identifiers to preserve outer project/workspace scope.

PUT /api/v1/issues/:issueId/questions/:questionId/recipient is human web-only and
requires trusted Origin, current project edit, expectedVersion for the issue and
complete questionVersions snapshot. Workspace lock coordinates grants, issue row
lock serializes answers/destination changes; archived/deleted tickets reject it.
A real change increments issue and question versions and appends atomic attributed
issue.question_recipient_changed {questionId,recipient:{from,to}}. No-op unchanged.
Assignment and saved answer remain independent; changing recipient does not erase
the original answeredBy/option/text/answeredAt. Full detail response is safe for
that workspace/project and current viewer. UI preserves answer draft, recipient
selection on409 and displays current answers for comparison before saving again.
Question navigation/answer submission pauses only while editing the recipient;
every button is explicit, search Enter does not submit the answer form.

Board/questions REST reads accept questionsFor=mine for unanswered directed
questions, and viewer-specific questionSummary.directedUnanswered. Combine with
existing Epic/human/status/warning filters; no-result filter remains operable.
Detail and cards show personal counters; answering updates them and still advances
to the next unanswered question. MCP reads include recipient fields/question
versions; old ask/update/create input schemas unchanged, no new agent/Chrome
assignment permission. Agents still cannot answer on behalf of humans. Existing
issues:close permission remains required for agent closure. Human read-only users
cannot answer, redirect, review or close; project editors can and are attributed.

103 will emit in-app directed notifications;102 only stores recipients/counts and
the atomic event used by that increment. No email, push, provider or Store action.
Rollback: preserve0024/answers;101 ignores recipients, so prefer forward repair
after use. Full PostgreSQL backups cover the rows/history, no new PVC or service.
Verify upgrade preserving old answers, editor/reader/foreign/multiworkspace,
race409/full snapshots, changed answers, downgrade, other editor response/closure,
and real browser1440/360 selection/drafts/filters. Production smoke read-only:
never answer a real user question or change reviewer grants for testing.
