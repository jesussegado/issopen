---
quick_id: 260917-mak
status: complete
ticket: ISSOPEN-116
epic: 8
must_haves:
  truths:
    - One PAT identity can use multiple independently revocable MCP API keys.
    - Every key inherits the identity's current project allowlist and scopes.
    - Secrets are shown once and never returned, logged or persisted in plaintext.
    - Existing credentials survive the additive migration and keep working.
    - PAT bearer authentication remains limited to /mcp, never human REST APIs.
  artifacts:
    - Additive agent credential label/index migration and schema
    - Domain and Owner REST lifecycle for create/list/revoke
    - Agents UI for per-service keys and one-time reveal
    - Integration, web and E2E coverage plus operating documentation
  key_links:
    - AgentService resolves every key to one live agent identity
    - Owner routes scope every credential mutation to the selected workspace
    - MCP recomputes identity permissions on every authenticated request
---

# Multiple MCP API keys per agent identity

## Goal

Replace the one-credential-per-agent limitation with explicit, named MCP API
keys so separate Codex sessions and services do not share a secret. Preserve
the existing identity, permission and workspace boundaries.

## Task 1 — Add the credential lifecycle without widening authorization

**Files:** `drizzle/0032_*.sql`, `drizzle/meta/*`,
`src/server/db/schema.ts`, `src/server/domain/agents/contracts.ts`,
`src/server/domain/agents/service.ts`, `src/server/http/agents.ts`

**Action:** remove the single-credential unique constraint, add a bounded label
and per-agent unique label, migrate existing rows to a stable initial label,
list every credential, create a new one with one-time token reveal and revoke a
single credential with workspace and identity checks. Cap active keys per PAT
identity and reject OAuth/revoked identities.

**Verify:** migration-from-previous-schema and integration tests prove two keys
authenticate as the same agent, single-key revocation isolation, permission
reductions, identity revocation, workspace isolation and no secret/hash output.

**Done:** existing tokens remain valid and independent service keys can be
created and revoked without adding any REST bearer access.

## Task 2 — Expose safe key management in Agents

**Files:** `src/web/types.ts`, `src/web/routes/AgentsRoute.tsx`,
`src/web/styles.css`, `tests/web/agents.test.tsx`, relevant E2E files

**Action:** show all key metadata beneath PAT identities, add a form for label
and expiry, reveal each new token once, add explicit per-key revocation and keep
whole-identity revocation visually distinct. Explain that every service should
receive its own key and that keys authenticate only MCP.

**Verify:** component/E2E tests cover creation, one-time reveal, refresh,
revoking one key and retaining another without leaking a token after dismissal.

**Done:** an Owner can safely connect several MCP consumers from the web UI.

## Task 3 — Validate, document and deploy

**Files:** `README.md`, `AGENTS.md`, `docs/agent-credentials.md`, tests and GSD
artifacts

**Action:** document provisioning, expiry, individual/identity revocation,
rotation and rollback; run full gates and Compose; publish an immutable image
and reconcile GitOps while preserving PostgreSQL and attachment PVCs.

**Verify:** plan must-haves, `pnpm validate`, `pnpm test:compose`, Argo
Synced/Healthy, production API/UI/MCP smoke and old/new key behavior.

**Done:** ISSOPEN-116 links code and evidence, is Ready for Human Review and has
no remaining agent claim.
