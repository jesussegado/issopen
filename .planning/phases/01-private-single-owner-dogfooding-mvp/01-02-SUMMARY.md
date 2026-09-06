---
phase: 01-private-single-owner-dogfooding-mvp
plan: 02
subsystem: tracker-domain-api
tags: [drizzle, postgresql, hono, zod, rest, activity-log]

# Dependency graph
requires:
  - phase: 01-01
    provides: Owner session, personal workspace, PostgreSQL migrations, and protected API boundary
provides:
  - Workspace-scoped project and issue persistence with stable readable keys
  - Shared transactional tracker services for REST and future MCP callers
  - Append-only server-attributed activity and independent agent claims
  - Protected owner REST routes for projects, board, issues, code links, activity, and review
affects: [01-03, 01-04, 01-05, web-board, remote-mcp, dogfooding]

# Tech tracking
tech-stack:
  added: []
  patterns: [workspace predicate in every lookup, update-returning issue counter, row-version-event transaction, strict boundary schemas, privacy-safe resource errors]

key-files:
  created: [src/server/domain/tracker.ts, src/server/domain/contracts.ts, src/server/http/tracker.ts, drizzle/0001_next_spyke.sql, tests/integration/tracker.test.ts, tests/integration/http.test.ts]
  modified: [src/server/db/schema.ts, src/server/app.ts, AGENTS.md]

key-decisions:
  - "Project keys are immutable and each issue materializes its readable key at creation."
  - "Per-project issue numbers allocate with one scoped UPDATE RETURNING operation inside the issue transaction."
  - "Activity events are service-append-only and PostgreSQL rejects direct update or delete operations."
  - "REST derives workspace, actor, source, and time from the authenticated owner and never accepts them from JSON."
  - "The human owner column and agent claim column remain independent; agent identity constraints arrive with Plan 01-04."

patterns-established:
  - "Domain-first mutation: REST and MCP call the same TrackerService transaction methods."
  - "Privacy-safe isolation: cross-workspace identifiers resolve to the same 404 as missing resources."
  - "Authoritative response: every successful mutation returns the committed row and version."

requirements-completed: [PROJ-01, PROJ-02, ISSU-01, ISSU-02, ISSU-05, ISSU-07, BOARD-01, ACTV-01, ACTV-02, SECU-04]

# Metrics
duration: 32min
completed: 2026-08-31
---

# Phase 01 Plan 02: Transactional Tracker Domain and REST Summary

**Workspace-isolated projects and stable issues with atomic immutable activity, code-result links, human review, and a strict owner REST API**

## Performance

- **Duration:** 32 min
- **Started:** 2026-08-31T12:03:54Z
- **Completed:** 2026-08-31T12:35:27Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Added immutable project keys, concurrent monotonic per-project issue allocation, five exact workflow states, four priorities, repository context, independent human ownership and agent claim, code-result links, row versions, and append-only activity.
- Implemented one shared transactional domain service which scopes every lookup by workspace and commits each accepted row mutation with its server-derived event.
- Exposed authenticated project, issue, board, activity, code-link, and owner-review REST routes with strict Zod bodies, authoritative responses, forged-audit rejection, and privacy-safe horizontal denials.
- Proved migration behavior, stable keys, concurrent allocation, atomic rollback, event immutability, CRUD/review flows, anonymous denial, and cross-workspace isolation against PostgreSQL 18.

## Task Commits

Each task was committed atomically:

1. **Task 1: Model projects, issues, links and immutable activity** - `a330532` (feat)
2. **Task 2: Expose protected REST contracts** - `281575d` (feat)

**Plan metadata:** committed with this summary (docs)

## Files Created/Modified

- `src/server/db/schema.ts` - Product enums, projects, issues, independent claims, code links, and activity tables with scoped keys and constraints.
- `drizzle/0001_next_spyke.sql` - Versioned PostgreSQL product migration and append-only activity trigger.
- `src/server/domain/contracts.ts` - Shared bounded Zod contracts for keys, URLs, repository context, workflow values, and mutations.
- `src/server/domain/tracker.ts` - Workspace-scoped transactional project, issue, claim, link, activity, and review operations.
- `src/server/http/tracker.ts` - Owner REST router, session-derived mutation context, strict JSON parsing, board projection, and privacy-safe errors.
- `src/server/app.ts` - Tracker router mount and global domain-error mapping inside the protected API boundary.
- `tests/unit/domain.test.ts` - Enum, key, repository-path, URL, and forged-field contract coverage.
- `tests/integration/tracker.test.ts` - PostgreSQL isolation, monotonic allocation, rollback, claim attribution, and append-only verification.
- `tests/integration/http.test.ts` - Anonymous denial, complete REST/review paths, forged audit rejection, and horizontal 404 coverage.
- `AGENTS.md` - Current domain/REST architecture and downstream reuse invariants.

## Decisions Made

- Project keys cannot be edited. Issue keys are materialized from the project key and allocated number so later project or issue edits cannot rewrite identity.
- The project counter increments with `UPDATE ... RETURNING` in the same transaction as issue and activity inserts, serializing concurrent creation without a separate sequence service.
- Activity is immutable at both layers: no update/delete service exists, and a PostgreSQL trigger rejects direct mutation.
- Repository and code-result URLs are bounded HTTP(S) data without credentials. Issopen stores and returns them but has no fetch, clone, preview, Git credential, CI, merge, or deployment path.
- REST always derives the personal workspace and human actor from the owner session. Strict schemas reject client actor, source, timestamp, diff, workspace, or immutable-key fields.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reordered generated composite unique indexes before foreign keys**
- **Found during:** Task 1 migration verification
- **Issue:** Drizzle generated composite foreign keys before the matching composite unique indexes, and PostgreSQL rejected migration `0001` with error `42830`.
- **Fix:** Moved the generated `project(id, workspace_id)` and `issue(id, workspace_id)` unique indexes before the foreign-key statements while retaining the schema snapshot.
- **Files modified:** `drizzle/0001_next_spyke.sql`
- **Verification:** All three integration suites apply both migrations successfully against clean PostgreSQL 18 containers.
- **Committed in:** `a330532`

**2. [Rule 1 - Bug] Mapped domain errors at the mounted application boundary**
- **Found during:** Task 2 HTTP integration tests
- **Issue:** Hono did not preserve the child router's error middleware when its routes were mounted, so validation and scoped not-found errors reached the parent generic handler as 500 responses.
- **Fix:** Kept expected-error mapping reusable and invoked it from the application's global error handler before logging unexpected failures.
- **Files modified:** `src/server/app.ts`, `src/server/http/tracker.ts`
- **Verification:** Invalid bodies return 400, foreign resource IDs return privacy-safe 404, and the HTTP suite passes 12/12.
- **Committed in:** `281575d`

**3. [Rule 2 - Missing Critical] Accepted the approved initial issue status field**
- **Found during:** Task 2 comparison with the mandatory UI contract
- **Issue:** The first domain draft always created issues in Backlog, while the approved create/edit contract includes the same five-value Status control at creation.
- **Fix:** Added an optional strict status input with `backlog` default and persisted it in the create transaction and activity event.
- **Files modified:** `src/server/domain/contracts.ts`, `src/server/domain/tracker.ts`
- **Verification:** HTTP tests create both Backlog and Ready for Review issues and return the authoritative state.
- **Committed in:** `281575d`

**4. [Rule 2 - Missing Critical] Updated the local architecture contract**
- **Found during:** Plan closeout
- **Issue:** The application instructions still said projects and issues were future work, contrary to the repository rule that AGENTS must change with architecture.
- **Fix:** Documented the domain/HTTP boundaries, transaction ownership, isolation rule, and required reuse by future MCP code.
- **Files modified:** `AGENTS.md`
- **Verification:** Documentation matches the committed paths and `make validate` passes.
- **Committed in:** plan metadata commit

---

**Total deviations:** 4 auto-fixed (1 bug, 2 missing critical requirements, 1 blocking issue)
**Impact on plan:** The fixes preserve the approved schema, UI contract, error privacy, migration reproducibility, and repository documentation rules without expanding product scope.

## Issues Encountered

- Drizzle wraps PostgreSQL errors, so trigger tests assert rejection and then prove the persisted state rather than matching only the wrapper's top-level message.
- Helm and Ansible are not installed; the root validation explicitly skipped their optional checks and completed successfully.

## User Setup Required

None - this plan adds no external service, credential, or configuration variable.

## Next Phase Readiness

- Plan 01-03 can build the responsive web board entirely on the protected REST contract and authoritative responses delivered here.
- Plan 01-04 can add persisted agent identities and constraints, then call the same domain methods from MCP without duplicating actor, authorization, activity, or transaction rules.
- No blocker remains.

## Self-Check: PASSED

- All key domain, HTTP, migration, and integration-test files exist.
- Task commits `a330532` and `281575d` are present in repository history.

---
*Phase: 01-private-single-owner-dogfooding-mvp*
*Completed: 2026-08-31*
