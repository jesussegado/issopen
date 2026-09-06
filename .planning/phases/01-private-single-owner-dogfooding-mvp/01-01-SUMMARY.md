---
phase: 01-private-single-owner-dogfooding-mvp
plan: 01
subsystem: foundation
tags: [hono, react, better-auth, drizzle, postgresql, docker-compose]

# Dependency graph
requires: []
provides:
  - Locked single-package Node 24 and React application skeleton
  - Singleton owner bootstrap and recovery with revocable sessions
  - Protected workspace API and private SPA entry flow
  - Persistent PostgreSQL 18 Compose runtime with migration-before-start
affects: [01-02, 01-03, 01-04, 01-05, auth, workspace, compose]

# Tech tracking
tech-stack:
  added: [Node 24.19.0, pnpm 11.22.0, React 19.2.8, Hono 4.13.5, Better Auth 1.7.2, Drizzle ORM 0.45.2, PostgreSQL 18.6, Vite 8.2.2, Tailwind CSS 4.3.3, Vitest 4.1.11]
  patterns: [protected-by-default API, operator-only singleton bootstrap, versioned Drizzle migrations, migration-before-start, non-root multi-stage image]

key-files:
  created: [src/server/app.ts, src/server/auth.ts, src/server/db/schema.ts, scripts/owner.ts, compose.yml, Dockerfile, tests/integration/auth.test.ts, tests/compose/runtime.test.ts]
  modified: [package.json, README.md, AGENTS.md, app.yaml, deploy/values.yaml]

key-decisions:
  - "Owner provisioning stays outside HTTP registration and uses a transaction, singleton constraint, and advisory lock."
  - "Only esbuild may run dependency build scripts; optional native dependency scripts stay disabled."
  - "Local Compose binds HTTP to loopback, while non-development deployments require an HTTPS public base URL."
  - "Kubernetes remains disabled until an immutable image repository and digest are supplied."

patterns-established:
  - "Protected-by-default: only data-free health and status routes are anonymous."
  - "Recovery rotates the password and revokes every active owner session in one transaction."
  - "Runtime secrets are required inputs and are never assigned committed defaults."

requirements-completed: [AUTH-05, WRKS-01, COMM-02]

# Metrics
duration: 52min
completed: 2026-08-31
---

# Phase 01 Plan 01: Production-Shaped Walking Skeleton Summary

**A locked Hono/React application with singleton Better Auth ownership, a protected personal workspace, and a persistent non-root PostgreSQL Compose runtime**

## Performance

- **Duration:** 52 min
- **Started:** 2026-08-31T11:04:42Z
- **Completed:** 2026-08-31T11:56:46Z
- **Tasks:** 3
- **Files modified:** 35

## Accomplishments

- Built the exact-version Node 24, Hono, React, Vite, Tailwind, Drizzle, Better Auth, and PostgreSQL application cohort with reproducible pnpm installation.
- Added operator-only owner bootstrap and recovery, singleton database enforcement, session revocation, origin checks, protected API routing, and workspace create/rename flows.
- Packaged a non-root image and persistent Compose runtime whose automated test proves clean startup, owner creation, workspace persistence across restart, repeat-bootstrap refusal, and secret-safe command output.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the locked single-package Node/React application** - `361bdfb` (feat)
2. **Task 2: Add PostgreSQL migrations, owner auth and workspace** - `dbba7e9` (feat)
3. **Task 3: Package the repeatable Compose runtime** - `6f04106` (feat)

**Plan metadata:** committed with this summary (docs)

## Files Created/Modified

- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` - Exact dependency cohort, reproducible scripts, and dependency build policy.
- `src/server/config.ts` - Secret-safe, environment-aware Zod configuration.
- `src/server/app.ts`, `src/server/auth.ts` - Health/status, Better Auth mount, protected API boundary, origin checks, session and workspace routes.
- `src/server/db/schema.ts`, `drizzle/` - Versioned auth, singleton owner, and personal workspace schema.
- `scripts/owner.ts` - Concurrent-safe bootstrap and session-revoking recovery commands.
- `src/web/` - Minimal private sign-in and personal workspace SPA shell.
- `Dockerfile`, `compose.yml`, `scripts/entrypoint.sh` - Non-root image, PostgreSQL 18 persistence, health dependency, and migration-before-start.
- `tests/unit/auth.test.ts`, `tests/integration/auth.test.ts`, `tests/compose/runtime.test.ts` - Configuration, auth boundary, concurrency, recovery, restart, persistence, and secret-output coverage.
- `README.md`, `AGENTS.md`, `app.yaml`, `deploy/values.yaml` - Implemented runtime contract, safe operator workflow, and explicitly disabled Kubernetes state.

## Decisions Made

- Kept owner creation out of anonymous HTTP registration. The operator command writes through the same Better Auth password model while serializing singleton allocation in PostgreSQL.
- Allowed only esbuild's required pnpm install script. Optional native scripts remain disabled so a frozen install works without broad supply-chain execution permission.
- Used loopback-bound HTTP for local dogfooding and required HTTPS for non-development public base URLs, preserving secure-cookie behavior without pretending local TLS exists.
- Kept Kubernetes deployment disabled because this plan produces a local Compose artifact but no published immutable application image.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Declared an explicit pnpm dependency build policy**
- **Found during:** Task 1 (locked application installation)
- **Issue:** pnpm 11 rejected the frozen install because dependency build scripts had no explicit allow/deny decisions.
- **Fix:** Added a single-package workspace policy which allows esbuild and denies the three unused optional native builds.
- **Files modified:** `pnpm-workspace.yaml`
- **Verification:** `pnpm install --frozen-lockfile`, lint, typecheck, and build pass.
- **Committed in:** `361bdfb`

**2. [Rule 1 - Bug] Made invalid public URL input return validation errors**
- **Found during:** Task 2 (configuration tests)
- **Issue:** A Zod refinement constructed `URL` after an invalid URL and raised `TypeError` instead of an actionable validation error.
- **Fix:** Guarded URL parsing with `URL.canParse` before enforcing the production HTTPS rule.
- **Files modified:** `src/server/config.ts`, `tests/unit/auth.test.ts`
- **Verification:** Unit tests pass with invalid and production-insecure URLs.
- **Committed in:** `dbba7e9`

**3. [Rule 1 - Bug] Recognized wrapped PostgreSQL uniqueness errors**
- **Found during:** Task 2 (workspace integration tests)
- **Issue:** Drizzle wrapped PostgreSQL error `23505` in `cause`, so duplicate workspace creation returned 500 instead of 409.
- **Fix:** Traversed the bounded error cause chain before mapping uniqueness conflicts.
- **Files modified:** `src/server/app.ts`, `tests/integration/auth.test.ts`
- **Verification:** Integration tests assert the duplicate request returns 409.
- **Committed in:** `dbba7e9`

**4. [Rule 3 - Blocking] Corrected Vitest root selection**
- **Found during:** Task 2 (auth verification)
- **Issue:** Vitest inherited Vite's `src/web` root and initially found no server tests.
- **Fix:** Set the test root explicitly and separated unit, integration, and Compose suites.
- **Files modified:** `package.json`
- **Verification:** Unit and integration gates each execute one file and three tests.
- **Committed in:** `dbba7e9`

**5. [Rule 1 - Bug] Prevented compiled tests and shell expansion from falsifying test evidence**
- **Found during:** Task 3 (Compose verification)
- **Issue:** The production TypeScript build emitted tests under `dist`, then an unquoted exclude glob could be expanded by the shell into a positional filter.
- **Fix:** Added a runtime-only build config, clean-before-build, explicit `dist` exclusions, and quoted every test glob.
- **Files modified:** `tsconfig.build.json`, `package.json`, `Dockerfile`
- **Verification:** `dist` contains no tests; unit reports 3/3, integration 3/3, and Compose 1/1.
- **Committed in:** `6f04106`

**6. [Rule 2 - Missing Critical] Updated the application runtime contract**
- **Found during:** Task 3 (runtime packaging)
- **Issue:** The local application rules require README, catalog metadata, deployment values, and AGENTS facts to change together when the runtime becomes real.
- **Fix:** Documented verified commands, ports, named secrets, health paths, persistence and rollback, while leaving the unreleased Kubernetes image and deployment disabled.
- **Files modified:** `README.md`, `AGENTS.md`, `app.yaml`, `deploy/values.yaml`
- **Verification:** Root `make validate` passes and catalog validation recognizes Issopen.
- **Committed in:** `6f04106`

---

**Total deviations:** 6 auto-fixed (3 bugs, 1 missing critical requirement, 2 blocking issues)
**Impact on plan:** Every change was necessary for reproducibility, correct API behavior, trustworthy test evidence, or the repository's application contract. No product scope was added.

## Issues Encountered

- A response-body assertion in the new integration test attempted to clone an already consumed response; the test now reads the body once before asserting. No runtime behavior changed.
- Helm and Ansible are not installed in the environment. Root validation explicitly skipped their optional checks and completed successfully.

## Known Stubs

- `app.yaml:15-16` and `deploy/values.yaml:2-3` intentionally retain the immutable image repository/tag as unset or `TODO`. Kubernetes stays disabled; a future release/deployment plan must publish and pin the image before GitOps exposure.

## User Setup Required

None - Compose provisions PostgreSQL locally. The operator generates local values for the named variables in `.env.example`; no external service or dashboard configuration is required.

## Next Phase Readiness

- The private owner, personal workspace, protected API, SPA shell, database migrations, and repeatable runtime are ready for Plan 01-02's project and issue model.
- No implementation blocker remains. Kubernetes publication and external HTTPS exposure remain intentionally out of scope.

## Self-Check: PASSED

- All key implementation and test files exist.
- Task commits `361bdfb`, `dbba7e9`, and `6f04106` are present in repository history.

---
*Phase: 01-private-single-owner-dogfooding-mvp*
*Completed: 2026-08-31*
