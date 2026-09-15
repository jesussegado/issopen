---
type: quick
status: planned
ticket: 103
epic: 3
---

# 103 — Directed in-app collaboration notifications

Live ticket/answers v2 reread15Sep: in-app only, directed activity only. Inline
GSD execution, no delegation. No email, watchers, push or implicit grants.

## 1. Persistent authorized inbox

Personal workspace-scoped records tied to immutable activity events. Emit inside
the source transaction, deduplicate event/recipient, suppress self-notification,
revalidate project eligibility at creation and every list/count/read. Never return
foreign or lost-access content. Assigned tasks and directed unanswered questions
become obsolete when reassigned/answered; keep event audit. Stable pagination,
read/unread counts and own-only idempotent read markers, context change isolation.

## 2. Mentions and directed review

Select eligible project people via99 directory, attach IDs to plain-text comments;
no raw HTML or arbitrary usernames/emails, no invitation/access changes. Bound
mentions and reject ineligible targets. Web comment client request ID deduplicates
network retries atomically, rejects reused key with different content. Existing
MCP/Chrome contracts stay strict. Notify assigned human on request for review,
without granting exclusive review rights or changing ticket68 policy.

## 3. Verify and deliver

Read/edit/Owner/foreign scope, removed membership, other-workspace grants, self,
replay/races, answer/reassignment obsolescence, pagination and read state. Browser
1440/360 plus unit/integration, old comments/migration, complete regression gates,
backup/restore and immutable GitOps rollout. Production read-only smoke; no test
messages to real people. Review only after observed delivery. Continue105/106/97/
107 while97 provider and98 realGoogle pilot questions remain genuinely external.
