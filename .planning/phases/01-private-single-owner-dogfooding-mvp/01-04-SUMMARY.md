---
phase: 01-private-single-owner-dogfooding-mvp
plan: 04
subsystem: auth
tags: [better-auth, oauth-2.1, pkce, cimd, mcp, argon2id, react, postgres]

requires:
  - phase: 01-private-single-owner-dogfooding-mvp-02
    provides: transactional tracker services, actor attribution, and workspace-isolated REST
  - phase: 01-private-single-owner-dogfooding-mvp-03
    provides: authenticated responsive React shell and owner tracker UI
provides:
  - named agent identities with project allowlists and independently enforced scopes
  - one-time Argon2id-hashed PAT credentials with expiry, last-use, and revocation
  - OAuth 2.1 authorization-code PKCE with CIMD and RFC 9728 discovery
  - stateless MCP 2.0 endpoint with eight bounded tracker tools
  - owner Agents, ChatGPT Connect, and OAuth consent surfaces
affects: [01-05-dogfooding, agents, authentication, remote-mcp, authorization]

tech-stack:
  added: ["@node-rs/argon2 2.2.0", "@better-auth/mcp 1.7.2", "@better-auth/cimd 1.7.2", "@modelcontextprotocol/server 2.0.0", "@modelcontextprotocol/hono 2.0.0", "@modelcontextprotocol/client 2.0.0", "jose 6.1.3"]
  patterns: [hashed one-time bearer credentials, scope-plus-project authorization, persistent OAuth agent principal, stateless per-request MCP server]

key-files:
  created: [src/server/domain/agents/service.ts, src/server/domain/agents/secrets.ts, src/server/http/agents.ts, src/server/mcp/handler.ts, src/server/mcp/tools.ts, src/web/routes/AgentsRoute.tsx, src/web/routes/ConnectRoute.tsx, tests/integration/agents.test.ts, tests/integration/mcp.test.ts]
  modified: [src/server/auth.ts, src/server/app.ts, src/server/db/schema.ts, src/server/domain/tracker.ts, src/web/App.tsx, AGENTS.md]

key-decisions:
  - "Keep Better Auth, MCP, and CIMD on the exact 1.7.2 cohort; enable CIMD for current MCP clients while leaving broad dynamic client registration disabled."
  - "Materialize OAuth callers as persistent agent identities and authorize every tool with both token-granted scopes and persisted project rows."
  - "Exclude issues:close from the default PAT and OAuth grants and enforce close permission again in the shared tracker domain."

patterns-established:
  - "Agent authorization pattern: authenticate bearer, resolve a durable principal, require exact scope, then require the target project before invoking shared domain logic."
  - "MCP boundary pattern: create a fresh stateless server per POST with eight fixed Zod-validated tools; issue content is data and never selects operations."

requirements-completed: [AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05, AGNT-06, MCP-01, MCP-02, MCP-03, MCP-06, MCP-07, MCP-10, MCP-11]

duration: 58min
completed: 2026-08-31
---

# Phase 1 Plan 4: Scoped Agent Identities and Remote MCP Summary

**Revocable Argon2id PAT identities and OAuth 2.1 PKCE/CIMD access drive eight stateless MCP tools through the same workspace-isolated tracker domain**

## Performance

- **Duration:** 58 min
- **Started:** 2026-08-31T13:19:01Z
- **Completed:** 2026-08-31T14:17:00Z
- **Tasks:** 2
- **Files modified:** 36

## Accomplishments

- Added named agent identities, explicit scopes, persisted project allowlists, safe credential fingerprints, optional expiry, immediate revocation, last-use tracking, and one-time PAT disclosure backed by Argon2id.
- Added Better Auth MCP and CIMD on the exact `1.7.2` cohort with authorization-code PKCE S256, audience-bound tokens, canonical RFC 9728 discovery, owner consent, and no open dynamic client registration.
- Exposed only `list_projects`, `list_issues`, `get_issue`, `update_issue`, `claim_issue`, `release_issue`, `link_code_result`, and `move_issue` over stateless MCP 2.0, all delegating to the existing tracker services.
- Delivered responsive Agents, Connect ChatGPT, and consent routes with safe token reveal/revoke behavior and escaped server-provided client metadata.
- Proved anonymous challenges, OAuth PKCE, PAT use and revocation, read/write scopes, cross-project denial, prompt-data isolation, and the no-close default against PostgreSQL 18 and the real HTTP/JWKS path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement agent credentials, scopes and allowlists** - `aa10df9` (feat)
2. **Task 2: Add OAuth 2.1/CIMD and stateless MCP tools** - `72d7c10` (feat)

## Files Created/Modified

- `src/server/domain/agents/` - Agent contracts, CSPRNG PAT generation, Argon2id verification, principal resolution, scope enforcement, allowlists, expiry, revocation, and last-use.
- `src/server/http/agents.ts` - Owner-only list/create/revoke REST endpoints that never return stored bearer material.
- `src/server/db/schema.ts` and `drizzle/0002` through `0004` - Agent, credential, OAuth provider, JWKS, consent, and persistent OAuth identity schema.
- `src/server/auth.ts` - Better Auth MCP, JWT, and CIMD authorization server configuration with PKCE S256.
- `src/server/mcp/handler.ts` - PAT-or-OAuth protected stateless POST handler and RFC 9728 challenge behavior.
- `src/server/mcp/tools.ts` - Eight fixed, strict MCP tools over `AgentService` and `TrackerService`.
- `src/web/routes/AgentsRoute.tsx` - Agent creation, exact scopes/project selection, once-only token handoff, last-use, and safe revocation confirmation.
- `src/web/routes/ConnectRoute.tsx` - Canonical MCP URL instructions plus escaped OAuth consent and explicit capabilities.
- `tests/integration/agents.test.ts` and `tests/integration/mcp.test.ts` - PostgreSQL-backed credential, isolation, OAuth PKCE, protocol, and authorization coverage.
- `tests/unit/secret.test.ts`, `tests/web/agents.test.tsx`, and `tests/web/mcp.test.tsx` - Secret-format/redaction and accessible UI coverage.
- `AGENTS.md` - Current agent/MCP architecture, exact dependency cohort, commands, and security invariants.

## Decisions Made

- Kept Better Auth core, MCP, and CIMD at exactly `1.7.2`; the published MCP plugin OpenAPI declaration is narrower than the Better Auth plugin slot, so a documented narrow compile-time cast bridges the version-aligned runtime packages.
- Enabled CIMD with the MCP `2026-07-28` metadata profile and deliberately left broad DCR unavailable; the current connector path does not require an unauthenticated client-registration endpoint.
- Treat each OAuth client as a durable agent identity and persist its workspace project rows. Each request still derives effective scopes from the verified token and checks the target against that allowlist.
- Use a fresh MCP server for each request with JSON responses and reject legacy session transports. `GET` and `DELETE /mcp` return `405` with `Allow: POST`.
- Treat `issues:close` as an independent elevated permission. Neither the default Codex PAT nor the tested ChatGPT consent includes it, and the domain blocks `done` even if a protocol caller attempts the transition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ordered the agent composite key before dependent foreign keys**
- **Found during:** Task 1 migration verification
- **Issue:** The generated migration created composite foreign keys before the referenced unique key, and PostgreSQL rejected it with `42830`.
- **Fix:** Moved the identity composite unique index earlier in the reviewed SQL migration.
- **Files modified:** `drizzle/0002_cute_patriot.sql`
- **Verification:** All five integration files migrate from zero and pass.
- **Committed in:** `aa10df9`

**2. [Rule 3 - Blocking] Generated the exact Better Auth 1.7.2 OAuth schema from the installed runtime**
- **Found during:** Task 2 OAuth schema setup
- **Issue:** The package registry did not publish `@better-auth/cli@1.7.2`, so the normal version-matched CLI generator was unavailable.
- **Fix:** Used Better Auth's installed `getSchema(auth.options)` output as the source and represented its OAuth/JWKS tables in Drizzle before generating reviewed SQL migrations.
- **Files modified:** `src/server/db/schema.ts`, `drizzle/0003_outstanding_rhino.sql`, `drizzle/0004_sparkling_deadpool.sql`
- **Verification:** Authorization code, consent, PKCE exchange, JWT verification, replay rejection, and migrations pass against PostgreSQL 18.
- **Committed in:** `72d7c10`

**3. [Rule 3 - Blocking] Bridged a published MCP plugin type incompatibility**
- **Found during:** Task 2 typecheck
- **Issue:** `@better-auth/mcp@1.7.2` publishes an OpenAPI shape narrower than Better Auth's plugin array accepts even though the runtime cohort is version-aligned.
- **Fix:** Added documented narrow casts at the plugin slot and server-only discovery API boundary without weakening request or domain types.
- **Files modified:** `src/server/auth.ts`, `src/server/app.ts`
- **Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm build`, discovery, and the full OAuth integration pass.
- **Committed in:** `72d7c10`

**4. [Rule 2 - Missing Critical] Updated the application operating guide for the new security boundary**
- **Found during:** Plan closeout
- **Issue:** The local guide still described MCP and agent identities as future work and omitted their exact versions and invariants.
- **Fix:** Recorded the implemented OAuth/PAT/MCP topology, exact version cohort, fixed tools, and independent close authorization.
- **Files modified:** `AGENTS.md`
- **Verification:** The guide now matches installed packages and executable test commands.
- **Committed in:** plan metadata commit

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 missing critical)
**Impact on plan:** Every fix was necessary for a reproducible schema, strict typecheck, or accurate security operations; no product scope was added.

## Issues Encountered

- The first in-process OAuth MCP test could exchange a valid PKCE code but could not verify the token because `requireMcpAuth` retrieves JWKS over HTTP. The integration harness now starts the real Hono listener, proving the production verification path instead of bypassing it.
- A UI clipboard assertion initially configured its mock before `userEvent`, which replaced the property. Reordering the harness setup made the actual copy behavior observable.

## User Setup Required

None - the canonical MCP URL comes from `ISSOPEN_BASE_URL`, and tests use only synthetic credentials and disposable PostgreSQL data. A reachable HTTPS URL is still required when plan 01-05 exercises ChatGPT Work outside local loopback.

## Next Phase Readiness

- Plan 01-05 can create the first issue through ChatGPT, let the scoped Codex identity claim it, link a real commit, return it to Ready for Review, and record human acceptance.
- No implementation blocker remains. Lint, typecheck, build, 17 unit tests, 9 web tests, 19 integration tests, and root `make validate` with 187 tests all pass.

## Self-Check: PASSED

- All key agent, OAuth, MCP, UI, migration, and test files exist.
- Commits `aa10df9` and `72d7c10` exist in repository history.
- No goal-blocking stub or untracked Issopen artifact remains.

---
*Phase: 01-private-single-owner-dogfooding-mvp*
*Completed: 2026-08-31*
