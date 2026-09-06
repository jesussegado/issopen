---
phase: 01-private-single-owner-dogfooding-mvp
plan: 03
subsystem: ui
tags: [react, vite, tailwind, testing-library, playwright, accessibility]

requires:
  - phase: 01-private-single-owner-dogfooding-mvp-02
    provides: private owner tracker REST API and transactional activity domain
provides:
  - responsive authenticated owner shell and setup forms
  - five-state server-authoritative issue board with native status controls
  - issue detail, code result review, and attributed immutable activity UI
  - desktop, mobile, and keyboard Playwright acceptance harness
affects: [01-04-mcp-agents, 01-05-dogfooding, web, accessibility]

tech-stack:
  added: ["@testing-library/react 16.3.3", "@testing-library/user-event 14.6.6", "@testing-library/jest-dom 7.0.1", "jsdom 30.0.1", "@playwright/test 1.62.1"]
  patterns: [phase-local semantic primitives, server-authoritative mutations, central 401 redirect, native-select workflow]

key-files:
  created: [src/web/components/ui.tsx, src/web/components/Shell.tsx, src/web/routes/BoardRoute.tsx, src/web/routes/IssueDetailRoute.tsx, tests/e2e/tracker.spec.ts, playwright.config.ts]
  modified: [src/web/App.tsx, src/web/styles.css, package.json, AGENTS.md]

key-decisions:
  - "Use native browser controls and a small History API router so the Phase 1 UI adds no component, icon, drag-and-drop, or desktop framework."
  - "Apply every mutation only from the authoritative REST response, retaining focus and announcing accepted state changes."
  - "Run Playwright against an ephemeral PostgreSQL-backed real server at both 1440px and 360px."

patterns-established:
  - "Protected fetch pattern: apiRequest hard-redirects every 401 and private server state is never persisted in browser storage."
  - "Accessible mutation pattern: explicit submit, pending disable, server response, DOM update, focus restoration, then polite live announcement."

requirements-completed: [WEB-01, BOARD-02]

duration: 35min
completed: 2026-08-31
---

# Phase 1 Plan 3: Responsive Owner Tracker Web Summary

**Responsive React tracker UI with a server-authoritative five-state board, human review, attributed activity, and real PostgreSQL-backed desktop/mobile keyboard acceptance**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-31T12:39:34Z
- **Completed:** 2026-08-31T13:14:29Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments

- Delivered the complete owner setup and tracker workflow in the normal browser: private sign-in, workspace, projects, issue forms, board, detail, code links, review, and activity.
- Implemented the fixed five-state board with mobile filtering, native selects, authoritative moves, retained keyboard focus, live announcements, offline mutation blocking, and privacy-safe unavailable states.
- Proved the workflow in Chromium at 1440px and 360px against a real ephemeral PostgreSQL server, including every workflow status, request-changes, acceptance, and horizontal-overflow checks.
- Kept stored content as escaped React text and external code links as explicit navigations without previews or network fetching.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the approved shell and owner setup forms** - `f76f287` (feat)
2. **Task 2: Build board, issue review and activity chronology** - `70bb624` (feat)
3. **Task 2 cleanup: Remove superseded project placeholder** - `f2da54f` (refactor)

## Files Created/Modified

- `src/web/App.tsx` - Authenticated route orchestration over the real Phase 1 APIs.
- `src/web/components/ui.tsx` - Local buttons, fields, native selects, badges, banners, skeletons, and focus helpers.
- `src/web/components/Shell.tsx` - Responsive header, owner menu, desktop sidebar, mobile navigation, and skip link.
- `src/web/routes/PublicRoutes.tsx` - Data-free status, private sign-in, and first-workspace entry.
- `src/web/routes/TrackerForms.tsx` - Workspace, project, and issue create/edit forms plus privacy-safe unavailable handling.
- `src/web/routes/BoardRoute.tsx` - Five ordered board sections, mobile filtering, authoritative movement, focus, and announcements.
- `src/web/routes/IssueDetailRoute.tsx` - Plain-text detail, repository context, code links, human review, and immutable activity chronology.
- `src/web/styles.css` - Approved tokens and responsive 360px, tablet, and desktop layouts without a component library.
- `tests/web/app.test.tsx` and `tests/web/tracker.test.tsx` - Unit/UI behavior, focus, private entry, and stored-XSS regression coverage.
- `playwright.config.ts` and `tests/e2e/` - Desktop/mobile real-server acceptance with PostgreSQL Testcontainers.
- `AGENTS.md` - Implemented web architecture, security state, and current test commands.

## Decisions Made

- Used semantic HTML, native controls, local CSS tokens, and a small History API navigation helper; no shadcn, Radix, icon library, drag-and-drop package, or desktop wrapper was introduced.
- Kept API responses authoritative instead of applying optimistic card movement, so focus and live announcements occur only after persisted mutations.
- Kept all E2E state ephemeral and synthetic: Playwright starts the production build over the real Hono app and a disposable PostgreSQL 18 container.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the missing UI and browser test cohort**
- **Found during:** Task 1 and Task 2 verification
- **Issue:** The greenfield package had Vitest but no DOM assertions, user-event support, jsdom, or Playwright runner.
- **Fix:** Pinned the exact Testing Library, jsdom, and Playwright versions and added isolated scripts/configuration.
- **Files modified:** `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `playwright.config.ts`
- **Verification:** 12 unit/UI tests and 2 Playwright projects pass.
- **Committed in:** `f76f287`, `70bb624`

**2. [Rule 2 - Missing Critical] Updated the application operating guide for the implemented web architecture**
- **Found during:** Task 2 closeout
- **Issue:** The local guide still described only plans 01-01 and 01-02 and omitted the real web and E2E commands.
- **Fix:** Recorded route/component boundaries, authoritative state rules, browser-storage invariant, and test commands.
- **Files modified:** `AGENTS.md`
- **Verification:** The guide names only installed technologies and executable commands.
- **Committed in:** `70bb624`

**3. [Rule 1 - Bug] Removed an obsolete project placeholder after mounting the API-backed board**
- **Found during:** Required pre-summary stub scan
- **Issue:** The unused Task 1 project landing always rendered an empty board state and could be mistaken for an unwired data surface.
- **Fix:** Removed it so the authenticated project route has exactly one implementation: the real board endpoint.
- **Files modified:** `src/web/routes/TrackerForms.tsx`
- **Verification:** `pnpm typecheck` and all 6 focused web tests pass after removal.
- **Committed in:** `f2da54f`

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug)
**Impact on plan:** All fixes were required for reproducible acceptance, current project guidance, or eliminating a misleading stub; no product scope was added.

## Issues Encountered

- Initial strict typechecking exposed forwarded-ref and exact-optional-property mismatches in the local primitives; the primitive contracts were corrected before the first task commit.
- The first Playwright attempt navigated before asynchronous sign-in completion; waiting for the private sign-in surface to disappear removed the race. Both browser projects then passed twice.

## Known Stubs

- Authenticated navigation exposes `Agents` and `Connect ChatGPT`, but their privacy-safe unavailable routes remain intentional until plan `01-04`, which owns those real APIs and surfaces. They do not block the tracker workflow delivered here.

## User Setup Required

None - the browser acceptance server creates synthetic credentials and disposable data automatically.

## Next Phase Readiness

- The real REST-backed owner UI and its shell are ready for plan 01-04 to mount scoped agent access and ChatGPT MCP/OAuth routes.
- No blocker remains; all plan gates, build, lint, typecheck, and root `make validate` pass.

## Self-Check: PASSED

- All key files exist.
- Commits `f76f287`, `70bb624`, and `f2da54f` exist in repository history.
- No goal-blocking stub remains in the WEB-01/BOARD-02 workflow.

---
*Phase: 01-private-single-owner-dogfooding-mvp*
*Completed: 2026-08-31*
