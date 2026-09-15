---
type: quick
status: complete
ticket: 101
epic: 3
---

# 101 — Optional human assignee

Both live answers v2 confirmed15Sep. One human or unassigned; project editors may
reassign. Reuse99 directory,95 authorization and96 membership versions. Inline GSD;
no delegation. Preserve workspace owner and agent claim as independent concepts.

## 1. Contract and domain

Nullable assignee user ID plus safe historical name snapshot. Existing rows stay
unassigned. Validate current project eligibility, never grant access. On removal,
keep attribution and flag no-access; editors can reassign/unassign. Atomic issue
CAS + full question snapshot + audit event; reject archived/deleted tickets.
Web-only assignment endpoint; retain strict old PATCH/Chrome/MCP input schemas so
existing tokens/installations gain no new mutation permission. Add explicit new
MCP assignment scope/tool only if needed for acceptance, never auto-grant it.
Projection/filtering coherent on REST and MCP paginated reads; no emails/providers.

## 2. UI and validation

Detail selector backed by authorized paginated collaborator search; save/cancel,
409 retains draft and compares fresh state. Cards/detail identify human vs agent.
Board All/Mine/Unassigned/Person filters combine with existing Epic/status/questions.
Negative tests read-only/foreign/removed/archived/deleted, concurrent edits,
pagination/cursor scope, unchanged old callers. Migration and isolated browser
desktop/mobile exercise selection, removal warning and filtering.

## 3. Release

Full gates, backup/restore, exact source/image/GitOps deployment, observe then
production read-only smoke. No assignment of real tickets as testing. Record
evidence in101 and move to review after verified. Continue102/103/105/106/97/107;
external97 mail provider and98 realGoogle pilot do not block independent work.
