---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed quick task 260902-mmt
last_updated: "2026-09-02T16:31:57+02:00"
last_activity: 2026-09-02
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 5
  completed_plans: 4
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-30)

**Core value:** Convertir una intención humana en trabajo estructurado y seguro que ChatGPT y agentes de código externos puedan entender, ejecutar y devolver a revisión dentro de un único flujo trazable.
**Current focus:** Phase 1 — Private Single-Owner Dogfooding MVP

## Current Position

Phase: 1 (Private Single-Owner Dogfooding MVP) — EXECUTING
Plan: 5 of 5
Status: Ready to execute
Last activity: 2026-09-02 - Completed quick task 260902-mmt: publish and validate Epics in production

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 01 P01 | 52min | 3 tasks | 35 files |
| Phase 01 P02 | 32min | 2 tasks | 15 files |
| Phase 01 P03 | 35min | 2 tasks | 22 files |
| Phase 01 P04 | 58min | 2 tasks | 36 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. Current roadmap-level structure:

- [Roadmap]: Nine sequential phases start with the complete private dogfooding loop; no parallel phase execution.
- [Phase 1]: The first usable MVP is Docker Compose → responsive web tracker → authenticated ChatGPT MCP → separately authenticated external code agent → human review.
- [Deferral]: Collaboration, visual storage/capture, audits, broad Community compatibility, release hardening, and Cloud follow only after the Phase 1 loop works.
- [Boundary]: Issopen governs backlog, permissions, activity, status, and code-result references; repository edits, CI, merge, and deployment remain external and human-controlled.
- [Release]: Community and Cloud share product capabilities and artifacts; Cloud differentiates by capacity and operation.
- [Phase 01]: Owner provisioning stays outside HTTP registration and uses a transaction, singleton constraint, and advisory lock.
- [Phase 01]: Only esbuild may run dependency build scripts; optional native dependency scripts stay disabled.
- [Phase 01]: Local Compose binds HTTP to loopback, while non-development deployments require an HTTPS public base URL.
- [Phase 01]: Kubernetes remains disabled until an immutable image repository and digest are supplied.
- [Phase 01]: Project keys are immutable and each issue materializes its readable key at creation.
- [Phase 01]: Per-project issue numbers allocate atomically with a scoped UPDATE RETURNING operation.
- [Phase 01]: Activity is append-only in the service and protected from direct update or delete by PostgreSQL.
- [Phase 01]: REST derives workspace, actor, source, and time from the authenticated owner session.
- [Phase 01]: Use native browser controls and a small History API router without a component or desktop framework.
- [Phase 01]: Apply UI mutations only from authoritative REST responses before focus restoration and announcements.
- [Phase 01]: Run browser acceptance against ephemeral PostgreSQL at 1440px and 360px.
- [Phase 01]: Keep Better Auth, MCP and CIMD on exact 1.7.2; use CIMD while broad dynamic registration stays disabled.
- [Phase 01]: Resolve every agent request through verified token scopes and a persisted project allowlist.
- [Phase 01]: Keep issues:close independent and absent from default Codex and ChatGPT grants.
- [Quick 260902-ght]: An issue belongs to zero or one lightweight Epic from
  the same project/workspace; Epic progress is derived from issue states and
  grouping reuses existing issue scopes.

### Pending Todos

None.

### Completed Todos

- `2026-08-30-documentar-mvp-autoprogramable-con-chatgpt`: integrado en
  `PROJECT.md` y `REQUIREMENTS.md`; su roadmap de doce fases quedó superado el
  2026-08-31 al mover el MVP privado completo a la fase 1.

### Completed Quick Tasks

| ID | Description | Date | Commits | Status | Directory |
| --- | --- | --- | --- | --- | --- |
| 260902-ght | Epics de proyecto, filtro del tablero y detalle de tickets relacionados | 2026-09-02 | `dd2434c`, `70a8a43` | Verified | [260902-ght](./quick/260902-ght-a-adir-epics-de-proyecto-para-agrupar-is/) |
| 260902-mmt | Publicar Epics por GitOps y validar producción | 2026-09-02 | `144ca29`, `2de2c41`, `7f27149` | Verified | [260902-mmt](./quick/260902-mmt-publicar-la-imagen-de-issopen-con-epics-/) |

### Blockers/Concerns

- Phase 1 uses an operator-only singleton bootstrap and recovery that revokes
  sessions; no anonymous owner-creation route is allowed.

- Phase 1 needs a reachable HTTPS URL and the minimum OAuth client flow that ChatGPT Work actually accepts; broad client compatibility is explicitly deferred.
- Codex is the selected dogfood code agent. It receives a one-time, hashed and
  revocable PAT with a project allowlist and no default close scope; repository
  credentials remain outside Issopen.

- The previous `01-DISCUSS-CHECKPOINT.json` describes the superseded portability-first phase and must not be resumed as the current scope.
- The DOM privacy contract, audit semantics, legal license, and Cloud limits require evidence in Phases 5, 7, 8, and 9 respectively.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-31T14:22:59.915Z
Stopped at: Completed 01-04-PLAN.md
Resume file: None
