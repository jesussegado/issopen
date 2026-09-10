---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Epic 5 ticket 64 deployed and Ready for Human Review; checking for newer tickets
last_updated: "2026-09-10T12:39:38Z"
last_activity: 2026-09-10
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
**Current focus:** Epic 5 frontend/usability ticket 64 is delivered and newer owner tickets are being checked; Chrome ticket 33 acceptance remains untouched.

Follow-up 2026-09-10: ticket 64 gives the `+` and `Create ticket in Epic` label
an explicit 8 px gap while retaining its accessible name and destination.
Source 44b1bda, GitOps cfc0474b Synced/Healthy, digest 0964635; pod Ready/0
restarts, public readiness, PostgreSQL and both PVCs verified. All 233 automated
tests plus two expected skips pass across app and Chrome. Fresh backup restored
isolated with 65 issues, 583 events, 10 evidences/receipts and 16 migrations;
all attachment hashes/sizes match. Production Chrome smoke passed. Ticket Ready
for Human Review v6, claim null.

Follow-up 2026-09-10: ticket 62 fixes stale post-success Chrome attachments in
0.5.5 (source f337430 plus formatting-only 3da9fc5); the reproducible ZIP and
checksum passed and the managed profile retained its extension ID. Ticket 63
adds project-scoped authenticated SSE plus focus/online/visibility/30 s
reconciliation (source 65f2720). GitOps db1f864f is Synced/Healthy on digest
8f26ffd; pod Ready/0 restarts, PostgreSQL and both PVCs preserved, readiness
public. Full gates, Compose, 197 homelab checks and isolated backup restore
passed. A live owner SSE stream observed an MCP activity mutation. Both tickets
are Ready for Human Review v6 with no active claim.

Follow-up 2026-09-10: Epic 5 tickets 57–59 simplify compact Epic listings,
add private paste/file images to normal web ticket creation, and keep
`+ Create ticket in Epic` visible for populated Epics. Source b7c48cb, GitOps
c9c46e9e Synced/Healthy, runtime digest bd534bb; pod Ready/0 restarts, PostgreSQL
and both PVCs preserved. 80 unit/web + 53 integration + 8 web E2E (2 expected
skips) + 76 Chrome unit + 12 Chrome E2E, Compose and 197 homelab checks pass.
Fresh backup restored without network with all nine attachment hashes/sizes
matching. Authenticated desktop/mobile production smoke passed without mutation.
MCP links/evidence are present; tickets 57, 58 and 59 are Ready for Human Review
v6, claim null, with no unanswered questions.

Follow-up 2026-09-10: ticket 61 presents `ready_for_review` as Ready for
Human Review and adds independent per-project visibility for that column and
Done. Migration 0015 defaults both flags to true; hiding is board-only and
preserves states, direct links and MCP. Quick 260910-g1z, source 5048f51,
GitOps ddf9d971 Synced/Healthy, digest 09d68e4, pod Ready/0 restarts and both
PVCs unchanged. 79 unit/web + 52 integration + 8 web E2E + 76 extension unit +
12 extension E2E, Compose and 197 homelab checks pass. Full backup restored
isolated with 2 projects, 62 tickets, 540 events and 7 attachments; production
has 16 migrations and both existing projects enabled. UI verified at 1440/360
px without mutation. Ticket Ready for Human Review v6, claim null.

Follow-up 2026-09-10: ticket 60 adds owner-only web deletion with confirmation,
logical tombstone 0014, audit/retention, version guards and hidden reads/evidence.
No Chrome/MCP delete permissions. Quick 260910-fdz, source c8d0d1a, GitOps
543a2f65 Synced/Healthy; pod Ready on master, both PVCs unchanged, public UI
button/cancel tested at 1440/360 px without DELETE. 226 tests + Compose PASS,
197 homelab PASS. Full backup restored isolated; 7 production images intact.
Ticket Ready for Review v6, claim null. No real tickets deleted; extension
untouched. Rollback to older binary would show tombstones: prefer roll-forward.

Follow-up 2026-09-10: ticket 56 styles the success link and stacks final
composer actions at full width with 12px gaps (quick 260910-f5d), source
c76a591 published. Release 0.5.4 passes 220 tests/checksum/reproducibility.
Live Chrome had a new confirmation and one image by delivery: exact new CSS
applied without reload, UI/confirmation/image preserved, three stacked actions
verified. Runtime still 0.5.3; complete 0.5.4 artifact awaits a safe future reload.
Ticket 56 Ready for Review v6, claim null; no backend or personal data changes.

Follow-up 2026-09-10: ticket 54 merges destination search and selection into
one editable combobox for Proyecto and Epic. Quick 260910-euw, source b5795e6
published; 0.5.3 release 219 tests PASS, checksum/reproducibility verified.
Managed Chrome loaded/connected, 2 searchable inputs / 0 duplicate search
fields; filtering/selection/cancel verified. Existing draft and real image
preserved. Ticket 54 Ready for Review v6, claim null; no backend changes.

Follow-up 2026-09-10: ticket 53 fixes native dropdown positioning observed in
managed Chrome 152 Linux (popup outside the browser window). SelectField lists
stay in the panel. Quick 260910-ehq, source fb11c419281c published. Release
0.5.2 passes 218 tests + 197 homelab checks, checksum/reproducibility verified.
Loaded same managed Chrome ID: all four lists and clicks verified in viewport,
connected, existing image/draft preserved. Ticket 53 Ready for Review v6,
claim null. No server, permission changes, clipboard reads or user uploads.

Follow-up 2026-09-10: ticket 52 adds a dismissible information notice and
permanent Account help, quick 260910-e2r, source dbfc597. 215 tests PASS,
ZIP/checksum/reproducibility verified. Managed Chrome 0.5.1 loaded/connected;
dismissal survives reload, Account help accessible, existing image and confirmed
draft preserved. Ticket 52 Ready for Review v6, claim null. No backend/GitOps
changes or clipboard reads/uploads; previous extension 0.5.0 retained.

Follow-up 2026-09-10: source 22b7e89, GitOps 4eb5b1ec Synced/Healthy; 213
tests PASS plus Compose. ZIP/checksum/reproducibility verified. Up to five
private images, native paste/files, local 24 h draft and atomic retry preserved.
Same extension ID/profile, 0.5 connected with maxImages=5. Both PVCs unchanged;
full production backup restored isolated (4 PNGs/4 receipts), post-deploy audit
intact. No personal clipboard reads or images uploaded. Ticket 51 v6 claim null.
Do not downgrade to 0.4.3 with multi-image draft/pending operation.

Follow-up 2026-09-10: ticket 50 moves account details behind the header user
button (quick 260910-cw3), Ready for Review v6, claim null. Release f6aa3e6:
217 tests PASS, two expected skips, ZIP/checksum verified. Chrome 0.4.3 loaded
in the same test profile/extension ID, still connected; account dialog and focus
verified. No capture/draft loss on toggling (isolated UI and real OAuth tests).
Previous 0.4.2 retained; no server/GitOps change or personal acceptance closure.

Follow-up 2026-09-10: ticket 49 explains capture failures with safe cause codes
and recovery steps (quick 260910-cbj), Ready for Review v6, claim null. Clean
release db26d87: 216 tests PASS, two expected skips, ZIP/checksum verified.
Chrome 0.4.2 loaded in the same test profile and still connected; previous 0.4.1
retained for rollback. No server/GitOps change. Parallel creation buttons
724a2da retained. Historical screenshot cause remains unknown.

## Current Position

Phase: 1 (Private Single-Owner Dogfooding MVP) — EXECUTING
Plan: 5 of 5
Status: Executing approved Chrome Epic incrementally
Last activity: 2026-09-09 - Source e5da82f, Chrome 0.4 ZIP, GitOps db767e30 Synced Healthy (docs followup fac0669d). 182 tests PASS + Compose runtime; homelab 197 PASS. Google Chrome 152 production OAuth and all four capture modes verified in technical tickets 45–48 (Done); private images and opaque masks checked. Full production backup restored isolated without network; server and extension rollback verified. MCP reread: 19–32 Ready for Review, 33 In Progress v5 with one acceptance warning, all claims null, 17 original answers unchanged. Remote Forgejo CI run not observed. 43 Done v22; 44 Backlog v5 untouched.

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

- [Quick 260910-f5d]: Highlight success link and vertically stack final composer
  actions. For a CSS-only change while a confirmation is open, apply validated
  stylesheet live rather than discard the in-memory success view by reloading.

- [Quick 260910-euw]: Proyecto/Epic use one editable input-combobox each.
  Search text is transient; only an option confirms an ID. Escape/Tab/outside
  restore the confirmed label. Keep native text editing and in-panel lists.

- [Quick 260910-ehq]: Extension ticket selectors use in-panel HTML lists,
  avoiding the observed out-of-window native popup in Chrome Linux. Preserve
  keyboard access, saved values and pending-operation locks; test real clicks.

- [Quick 260910-e2r]: General information is a dismissible in-panel notice,
  remembered locally and always readable under Account. Preserve operational
  errors and attachment limits. Closing must not alter draft/session.

- [Quick 260910-d89]: Owner explicitly replaces internal captures with external
  PNG/JPEG/WebP paste/uploads, 5 images/8 MiB aggregate/32 MP each. No page access,
  optional clipboardRead on gesture only. User-added images enter the local
  draft; submit is the only upload. API v1 additive, no DB migration; preserve
  legacy pending hashes, permissions and private evidence.

- [Quick 260909-vje]: Chrome 0.4 adds reviewed-only IndexedDB drafts (24 h),
  owner-scoped receipts that survive reconnection, separate human write consent,
  bounded structural DOM, inline project/Epic, PNG normalization and private
  storage. Keep originals/history in RAM. Restore/GC use isolated fixtures and
  recoverable quarantine. See docs/chrome-delivery.md. Deployment, backup restore
  and technical dogfooding verified separately; personal acceptance remains in 33.

- [Quick 260909-tfb]: OAuth human extension audience stays separate from MCP;
  per-installation public clients, PKCE, 30-day absolute lifetime. 0.3 capture
  stays in RAM until explicit PNG download; DOM/upload/storage criteria stay
  pending. Server source and unpacked extension version deploy independently.
- [Quick 260909-r6j]: Owner explicitly prioritizes Chrome Epic before the
  remaining historical sequence; do not mark phases complete. First cut is
  scope + installable local-only foundation. OAuth/capture/submission remain
  in 21–33; `docs/chrome-extension.md` records roadmap differences and answers.
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
- [Quick 260907-wrj]: The approved six-piece aperture, forest `#027067` and
  mint `#6FD9B5` define the web identity; shared Brand and color tokens follow
  `docs/design/0001-brand-identity.md`.
- [Quick 260908-kiy]: The favicon uses a separate opaque white background for
  dark browser tabs; the header logo and touch icon keep their transparent asset.

### Pending Todos

- Epic 4 / ticket 44: project/repository association, selected real improvement,
  then publication and pilot. Owner approved a new Issopen-only testing PAT,
  INCLUDING issues:close; created and MCP-verified on 2026-09-09, expires
  2026-10-09. Stored in ignored homelab .local/secrets/issopen-codex-pilot.env
  (0600). Existing grants, saved human answers and client approval policies
  remain unchanged. Only 43 was closed by explicit owner request.

### Completed Todos

- Epic 4 / ticket 43: Done, version 22, claim null, independently reread via MCP
  at 16:00:02 UTC after the owner requested closure. Native execution/reopen,
  planning/repeat and changed-answer query evidence remains documented; unrun
  plan reconciliation/failure cases are not relabeled PASS. Test harness PID
  2517887 stopped; final report retained in /tmp/issopen-ide-control-MPtIb5.
  Global config restored, fixture disk unchanged. Do not resume this closed
  task automatically; 44 and publication require a separate request.
- `2026-08-30-documentar-mvp-autoprogramable-con-chatgpt`: integrado en
  `PROJECT.md` y `REQUIREMENTS.md`; su roadmap de doce fases quedó superado el
  2026-08-31 al mover el MVP privado completo a la fase 1.

### Completed Quick Tasks

| ID | Description | Date | Commits | Status | Directory |
| --- | --- | --- | --- | --- | --- |
| 260910-f5d | Chrome: enlace de éxito y acciones finales apiladas | 2026-09-10 | `c76a591` | 220 tests PASS; 0.5.4 CSS live, 0.5.3 runtime/confirmation preserved; 56 Ready for Review | [260910-f5d](./quick/260910-f5d-mejorar-enlace-y-apilar-acciones-de-tick/) |
| 260910-euw | Chrome: fusionar búsqueda y selección de Proyecto/Epic | 2026-09-10 | `b5795e6` | 219 tests PASS; 0.5.3 loaded, draft preserved; 54 Ready for Review | [260910-euw](./quick/260910-euw-unificar-busqueda-y-seleccion-de-proyect/) |
| 260910-ehq | Chrome: selectores accesibles dentro del panel | 2026-09-10 | `fb11c41` | 218 tests PASS; 0.5.2 loaded, draft preserved; 53 Ready for Review | [260910-ehq](./quick/260910-ehq-corregir-selectores-chrome-desplazados-f/) |
| 260910-e2r | Chrome: aviso cerrable y ayuda permanente en Cuenta | 2026-09-10 | `dbfc597` | 215 tests PASS; 0.5.1 loaded, draft preserved; 52 Ready for Review | [260910-e2r](./quick/260910-e2r-convertir-informacion-de-chrome-en-aviso/) |
| 260910-d89 | Chrome: pegar/subir varias imágenes al ticket | 2026-09-10 | `4426dc6`, `22b7e89`; GitOps `4eb5b1ec` | 213 tests + Compose PASS; deployed/connected; 51 Ready for Review | [260910-d89](./quick/260910-d89-simplificar-chrome-a-pegar-o-subir-varia/) |
| 260910-cw3 | Chrome: cuenta en diálogo desde el botón de usuario | 2026-09-10 | `f6aa3e6` | 217 tests PASS; 0.4.3 loaded/connected; 50 Ready for Review | [260910-cw3](./quick/260910-cw3-mover-cuenta-de-chrome-al-boton-de-usuar/) |
| 260910-cbj | Chrome: explicar fallos de captura con causa y pasos específicos | 2026-09-10 | `db26d87` | 216 tests PASS; 0.4.2 loaded/connected; 49 Ready for Review | [260910-cbj](./quick/260910-cbj-aclarar-errores-de-captura-chrome-con-ca/) |
| 260910-cbm | Chrome: botones Crear proyecto/Epic arriba del compositor | 2026-09-10 | `724a2da` | 183 tests PASS; 0.4.1 loaded in connected test Chrome; server unchanged | [260910-cbm](./quick/260910-cbm-mover-crear-proyecto-y-crear-epic-arriba/) |
| 260909-vje | Complete Chrome capture-to-ticket, private storage, drafts, release and production verification | 2026-09-09 | Source `e5da82f`; GitOps `db767e30`, docs `fac0669d` | Technical delivery verified; owner acceptance in 33 | [260909-vje](./quick/260909-vje-completar-epic-chrome-dom-adjuntos-priva/) |
| 260909-tfb | Chrome OAuth 21 + capture 23 and local part of editor 25 | 2026-09-09 | Source `2d9b376`, `def5297`; GitOps `5a6b2c2e` | 21/23 verified, Ready for Review; 25 partial | [260909-tfb](./quick/260909-tfb-oauth-humano-y-captura-local-segura-de-l/) |
| 260909-r6j | Chrome Epic: decisiones aprobadas y base MV3/panel lateral, tickets 19–20 | 2026-09-09 | `18658bb`, `1b59442` | Verified; Ready for Review in Issopen | [260909-r6j](./quick/260909-r6j-implementar-ext-01-y-ext-02-del-epic-chr/) |
| 260902-ght | Epics de proyecto, filtro del tablero y detalle de tickets relacionados | 2026-09-02 | `dd2434c`, `70a8a43` | Verified | [260902-ght](./quick/260902-ght-a-adir-epics-de-proyecto-para-agrupar-is/) |
| 260902-mmt | Publicar Epics por GitOps y validar producción | 2026-09-02 | `144ca29`, `2de2c41`, `7f27149` | Verified | [260902-mmt](./quick/260902-mmt-publicar-la-imagen-de-issopen-con-epics-/) |
| 260907-vpo | Seis variantes y refinamiento de seis piezas en verde bosque y menta | 2026-09-07 | `96de32a`, `cfe220d` | Verified | [260907-vpo](./quick/260907-vpo-explorar-seis-variantes-verdes-y-moradas/) |
| 260907-wrj | Aplicar logo, favicon y paleta bosque/menta en toda la web y documentar la decisión | 2026-09-07 | `d206bc6` | Verified | [260907-wrj](./quick/260907-wrj-aplicar-la-identidad-aperture-de-seis-pi/) |
| 260908-ja5 | Desplegar identidad bosque/menta por GitOps y verificar producción | 2026-09-08 | Fuente `2b0bb5a`, GitOps `a1956385` | Verified | [260908-ja5](./quick/260908-ja5-desplegar-la-identidad-bosque-y-menta-de/) |
| 260908-kiy | Añadir fondo blanco al favicon y desplegar la corrección | 2026-09-08 | Fuente `5e2debd`, GitOps `4527b882` | Verified | [260908-kiy](./quick/260908-kiy-a-adir-fondo-blanco-al-favicon-de-issope/) |

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

Last session: 2026-09-10
Stopped at: Chrome new result styles applied live, runtime remains 0.5.3 to preserve an open confirmation with one image. 0.5.4 artifact ready for safe reload later. Backend remains 22b7e89 via GitOps 4eb5b1ec. Ticket 56 Ready for Review v6, claim null. Ticket 33 owner acceptance untouched.
Resume file: ./quick/260910-f5d-mejorar-enlace-y-apilar-acciones-de-tick/SUMMARY.md (derived evidence; reread live tickets/answers)
