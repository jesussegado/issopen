# Project Research Summary

**Project:** Issopen  
**Domain:** issue tracker visual open source para personas y agentes de programación externos  
**Researched:** 2026-08-23  
**Confidence:** HIGH en la dirección de producto y los límites arquitectónicos; MEDIUM-HIGH en integraciones jóvenes y decisiones operativas aún sin datos

## Executive Summary

Issopen no debe competir como un gestor de proyectos generalista ni presentarse
como “BugHerd con MCP”. El acceso MCP de lectura y escritura ya aparece en
BugHerd, Marker.io, Userback y Plane; la ventaja defendible es el **bucle
completo y estrecho**: una persona revisa y captura un problema visual, Issopen
lo convierte en un paquete de contexto minimizado, un agente externo con
identidad y permisos propios lo reclama y actualiza, y una persona revisa el
resultado trazado. El segundo diferencial es un epic de auditoría que agrega
hallazgos humanos y agenticos sin convertir Issopen en un scanner o runtime de
agentes. Esta conclusión cambia el posicionamiento inicial: MCP es una capacidad
imprescindible, pero privacidad, gobierno del agente, atribución y revisión
humana son el producto ([FEATURES.md](./FEATURES.md),
[BugHerd MCP](https://bugherd.com/feature/mcp),
[Marker.io MCP](https://help.marker.io/en/articles/14034657-mcp-integration-model-context-protocol),
[Plane AI](https://plane.so/ai)).

La implementación recomendada es un **monolito modular TypeScript sobre Node.js
24 LTS**. Un único backend Hono sirve una SPA React/Vite y expone REST,
autenticación y Remote MCP; una extensión WXT/Manifest V3 es el único artefacto
cliente separado. PostgreSQL conserva todo el estado transaccional y un puerto
S3 almacena adjuntos privados. Esto descarta Next.js y Supabase como plataforma:
no aportan una ventaja al flujo autenticado y crearían dos modelos de servidor o
una dependencia de Auth/Storage/RLS propietarios. Supabase sólo podría usarse
como PostgreSQL gestionado detrás de `DATABASE_URL`. Cloud y Community deben
ejecutar el mismo binario, migraciones y contratos desde el primer corte, aunque
el empaquetado y soporte de release lleguen al final ([STACK.md](./STACK.md),
[Hono en Node.js](https://hono.dev/docs/getting-started/nodejs),
[PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)).

El riesgo decisivo no está en el Kanban, sino en la cadena página no confiable →
captura privada → tenant → agente externo → escritura. Por eso no existe un MVP
válido sin aislamiento de workspace, preview y redacción local, DOM reconstruido
por allowlist, objetos privados, identidad agentica, scopes y project allowlist,
operaciones tipadas e idempotentes y actividad inmutable en la misma transacción.
OAuth 2.1/discovery del perfil MCP vigente debe formar parte de la integración
pública; un PAT con hash puede coexistir para automatización controlada, pero no
sustituye el flujo estándar. La compatibilidad real debe probarse con al menos
Codex y Claude Code antes de anunciarla ([ARCHITECTURE.md](./ARCHITECTURE.md),
[PITFALLS.md](./PITFALLS.md),
[MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)).

## Decisions Produced by the Research

### Adopted Recommendations

| Area | Adopted decision | Requirement / roadmap effect |
|---|---|---|
| Product wedge | Optimize for safe visual capture → scoped external-agent work → attributable human review | Activation is completion of this loop, not signup, capture count or MCP connection |
| Web/backend | React SPA + Vite served by one Hono/Node deployable; no Next.js | One authorization and server model for web, extension and MCP |
| Data/platform | PostgreSQL + versioned SQL migrations; private S3-compatible storage; Better Auth; SMTP/OAuth standards | No direct Supabase Auth, Storage, RLS, Edge Functions or `supabase-js` dependency |
| Architecture | Modular monolith with ports/adapters and one application-command layer | REST and MCP cannot implement separate business rules; no microservices or broker in v1 |
| Repository layout | Start with `apps/server`, `apps/web`, `apps/extension` and only the demonstrably shared `packages/contracts` | Resolves the research-file conflict in favor of avoiding speculative `db`, `domain`, `auth`, `mcp`, `ui` and `shared` packages; server modules stay internal until a second consumer exists |
| Agent model | `AgentIdentity`, delegation, grant, scopes, project allowlist and autonomy bounds are v1 records | Moves explicit agents out of “future/Business” and before the first MCP write |
| MCP | One Streamable HTTP endpoint; small typed read/write tools; OAuth discovery/PKCE for public compatibility; PAT optional | Read and write ship in one thesis-validating phase; no arbitrary patch/delete tool |
| Human control | Human owner/reviewer is distinct from an agent claim; agent normally finishes at Ready for Review; Done needs separate permission | Makes review an enforceable state and not a convention in prompts |
| Portability | Same artifacts, migrations, contracts and extension for Cloud and Community from foundation | Self-hosting is an architectural seam from phase 0, not a phase-12 rewrite |
| Open product | Follow current `PROJECT.md`: all product capability is open; Cloud sells capacity and operation | Resolves the brief's “open-core” language against the newer source of truth; no Cloud-only feature modules |
| Cloud Free | Preserve the complete loop and meter capacity; keep existing data readable/exportable/deletable at limits | Discards speculative public quotas until representative cost telemetry exists |

### Unresolved Decisions

These are genuine planning inputs, not permission to invent defaults:

| Decision | Why unresolved | Latest safe decision point |
|---|---|---|
| AGPLv3 boundary, notices, DCO/CLA and Cloud corresponding-source mechanics | Requires legal review; research only confirms the stated AGPL intent | Decide license before a public source/release claim; complete mechanics before Community/Public Cloud release |
| Exact MCP client/spec compatibility envelope | Protocol and SDK are current but client support is an integration fact | Spike before planning the MCP phase; publish a tested client/spec/auth matrix at release |
| Better Auth MCP/CIMD fitness | Version 1.7 and MCP SDK v2 are recent security-sensitive integrations | Prove login, consent, refresh, revocation, scopes, audience and migrations in foundation/MCP spike |
| DOM allowlist, selector quality and URL-query policy | Utility versus privacy varies across React/Vue/static sites, iframes, shadow DOM and canvas | Define with hostile/PII fixtures before extension implementation |
| Supported raster formats and byte/pixel/dimension limits | Requires representative captures and processor measurements | Fix before private-upload acceptance; expand formats only with new threat tests |
| Cloud retention, deletion and numerical quotas | Sustainable values need observed storage, egress, backup and MCP/API distributions | Measure from first uploads; publish only after a beta cohort |
| SeaweedFS operational role | Good portable Compose default, not evidence of production HA | Contract-test it for Community; allow an external S3 provider for serious production |
| Minimum Chromium version and store disclosures | Depends on actual APIs and current store policy | Pin/test during extension release planning |
| Audit categories and completion semantics | Fixed categories are a product hypothesis, not a compliance taxonomy | Validate with maintainers before the audit phase |

### Implementation-Time Version Pinning

Technology families are adopted now; exact versions are **reference baselines,
not durable planning decisions**. At the start of foundation, recheck official
releases, install and test a compatible cohort, then pin every direct dependency
exactly plus the lockfile and OCI image digests. The researched baseline is
Node `24.19.0`, pnpm `11.22.0`, TypeScript `6.0.3`, React `19.2.8`, Vite
`8.2.2`, Hono `4.13.3`, PostgreSQL `18.6`, Drizzle ORM `0.45.2`, WXT `0.21.4`,
Better Auth `1.7.1` and MCP SDK `2.0.0`. Cohorts for React, Vite, Better Auth,
MCP, Drizzle, AWS SDK, Vitest and OpenTelemetry must move together and pass
their contract suites. Re-evaluate TypeScript only at `7.1+` and Node 26 only
after it reaches LTS ([Node release policy](https://nodejs.org/en/about/previous-releases),
[TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/),
[STACK.md — pinning policy](./STACK.md#política-de-pinning-para-la-implementación)).

## How Research Changes `init-project.md`

`init-project.md` remains useful as the origin brief, but these researched
conclusions supersede its technical and phase hypotheses:

| Brief hypothesis | Research conclusion | Resolution |
|---|---|---|
| Next.js web plus Hono API | The authenticated SPA has no SSR/SEO requirement, while extension and MCP already require Hono | Adopt React/Vite served by Hono; remove Next.js from requirements |
| Supabase PostgreSQL/Auth/Storage, with self-host finalized after SaaS | Provider APIs would make Community a later rewrite and split authorization | Use ordinary PostgreSQL, Better Auth, S3 and SMTP/OAuth ports from the first runnable slice; Supabase may only supply managed PostgreSQL through the standard contract |
| MCP itself is the differentiator | Major visual trackers and Plane already expose MCP | Treat MCP as table stakes; differentiate on safe agent-ready evidence, independently governed agents, attribution, review and mixed audit epics |
| PAT-only MVP; OAuth later | PAT is useful for controlled automation, but current Remote MCP interoperability expects protected-resource discovery, PKCE, audience/resource binding and scopes | Include standards-based OAuth in the complete MCP phase; keep PAT as an optional compatibility path |
| Agent identity and advanced permissions are future/Business | Attribution and least privilege cannot be met by a human PAT plus a client-supplied name | Add `AgentIdentity` and scoped grants before any MCP write, in Community and Cloud Free |
| MCP read and write are separate phases | Read-only proves connectivity, not the product thesis, and separate logic invites drift | Ship a minimal read/write loop in one phase using shared commands and policy |
| Repository context is phase 10 | Repository URL/default branch/subpath and explicit result links are cheap, required agent context | Include them in the manual tracker slice; keep GitHub App/webhooks deferred |
| Self-hosting is finalized near release | Provider seams added late are expensive and unreliable | Exercise generic PostgreSQL/S3 and the same image/migrations continuously; do release docs, upgrade and restore later |
| Exact Free quotas are plausible initial configuration | Costs of images, egress, backups and MCP traffic are unknown | Build a central usage ledger and graceful limits; do not publish exact quotas before measurement |
| Open-core and Business-only governance/agent controls | Current `PROJECT.md` requires all product capability to be open | Cloud monetizes capacity and operation; core agent governance, privacy and audits are not paywalled |
| Thirteen mostly horizontal phases | Security dependencies require fewer vertical proofs | Use the dependency-driven ten-phase structure below |

## Key Findings

### Recommended Stack

The stack should maximize one deployable, standard protocols and self-host
portability. The detailed version evidence lives in [STACK.md](./STACK.md).

**Core technologies:**

- **Node.js 24 LTS + TypeScript:** one ESM runtime for server, builds,
  migrations and tests; production stays on an LTS line
  ([Node.js releases](https://nodejs.org/en/about/previous-releases)).
- **React + Vite:** authenticated SPA and shared React runtime for extension UI;
  static output avoids a second server/caching model
  ([React versions](https://react.dev/versions), [Vite releases](https://vite.dev/blog)).
- **Hono:** one Node process serving REST `/api/v1`, auth/OAuth, `/mcp` and the
  SPA; domain modules do not import Hono types
  ([Hono Web Standards](https://hono.dev/docs/concepts/web-standard)).
- **Zod + OpenAPI 3.1:** validate every HTTP/MCP/environment boundary; shared
  schemas are a monorepo optimization while OpenAPI remains the external REST
  contract ([Hono Zod OpenAPI](https://hono.dev/examples/zod-openapi)).
- **PostgreSQL + Drizzle:** authoritative transactional store with composite
  tenant constraints, forced RLS, reviewed/versioned SQL migrations and real
  PostgreSQL integration tests
  ([PostgreSQL versioning](https://www.postgresql.org/support/versioning/),
  [Drizzle migrations](https://orm.drizzle.team/docs/migrations)).
- **Better Auth + SMTP/GitHub OAuth:** portable human sessions and MCP OAuth
  integration; business authorization remains in Issopen policy, not the auth
  library ([Better Auth installation](https://better-auth.com/docs/installation),
  [Better Auth MCP](https://better-auth.com/docs/plugins/mcp)).
- **MCP SDK v2 + Streamable HTTP:** one stateless endpoint with protocol
  negotiation, OAuth discovery and real-client conformance tests
  ([MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)).
- **WXT + Chromium Manifest V3:** extension built around `activeTab`,
  `scripting`, `storage` and `identity`, never persistent `<all_urls>`
  ([WXT releases](https://github.com/wxt-dev/wxt/releases),
  [Chrome `activeTab`](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)).
- **Private S3-compatible storage:** upload-intent/finalization protocol and
  short-lived authorized reads; SeaweedFS is the proposed Compose default, not
  a domain dependency
  ([AWS presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html),
  [SeaweedFS releases](https://github.com/seaweedfs/seaweedfs/releases)).
- **Vitest, Playwright and Testcontainers:** unit/domain tests, packaged MV3
  browser flows, and integration against real PostgreSQL/S3; never substitute
  SQLite for persistence/security tests
  ([Vitest 4](https://vitest.dev/blog/vitest-4),
  [Playwright extension testing](https://playwright.dev/docs/next/chrome-extensions)).
- **Pino + optional OTLP:** JSON logs always work without a SaaS; backend traces
  and metrics are opt-in. Product activity remains persistent domain data
  ([OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)).

**Explicit exclusions:** Next.js, Supabase application SDKs, MinIO Community,
MCP SDK v1/legacy SSE as the canonical path, Hono RPC as the only external
contract, SQLite persistence tests, public buckets, mandatory SaaS telemetry,
microservices, queues and Kubernetes inside the product.

### Expected Features

The complete feature analysis and competitor evidence live in
[FEATURES.md](./FEATURES.md).

**Must have (table stakes):**

- Low-friction GitHub OAuth/email magic-link onboarding, a personal workspace,
  invitations and owner/admin/member roles.
- Projects with stable keys and never-recycled issue IDs, lightweight repository
  context and archive behavior.
- A responsive, accessible Kanban with five stable semantic states, issue detail,
  Markdown, priority, labels, comments/activity, filters/search and minimal
  actionable notifications.
- Private attachments with validated upload, authorized short-lived download,
  quota reservation and cleanup.
- A signed Chromium MV3 extension plus reproducible unpacked build.
- Visible-viewport or crop capture with URL/viewport/browser metadata, optional
  bounded element context, exact preflight preview, destructive redaction,
  omission controls, focused annotations and retryable unsent drafts.
- One standards-compatible Remote MCP endpoint with bounded list/get tools and
  explicit create/claim/comment/update/link-result/transition operations.
- Named, revocable and optionally expiring agent grants with project allowlist,
  separate sensitive scopes, last-use visibility and server-derived attribution.
- Separate human ownership and agent claim, Ready for Review as the normal agent
  endpoint and explicit close permission for Done.
- Reproducible Community install/migration/upgrade/backup/restore and Cloud
  tenant isolation, usage visibility, graceful limits and deletion/export path.

**Should have (competitive differentiators):**

- One agent-ready issue DTO combining reviewed screenshot metadata, minimized
  DOM/element context, repository context, activity and result links.
- Privacy preview/redaction and DOM minimization in Community and Cloud Free.
- Independently governed agent identity rather than actions collapsed into the
  token owner's name.
- Human owner plus time-bounded agent claimant.
- Mixed audit epics with fixed initial categories, human/agent findings and a
  deterministic live summary derived from ordinary issues.
- Complete open vertical-loop parity between Community and Cloud Free.
- Capacity-paid Cloud where money buys managed resources and operation, not
  closed product behavior.

**Defer (v2+):**

- GitHub App, webhooks and automatic branch/PR/state synchronization.
- Anonymous/public capture, guest feedback portals, surveys, voting and roadmap.
- Full-page scrolling capture, console/network collection, video or session replay.
- Exportable audit reports, recurring audits, audit templates and arbitrary
  issue hierarchies.
- Saved views, bulk edit, rich workflow/custom-field automation, Slack/digests
  and importers.
- Firefox/Safari, native mobile/desktop, billing UI, SSO/SCIM and enterprise controls.
- Hosted agents, model proxying, repository cloning/indexing, source credentials,
  automatic code changes or deployments.

**Anti-features:** Jira/Linear/Plane parity, raw/full DOM capture, public media,
passive surveillance, arbitrary MCP patch/delete/bulk tools, silent inherited
agent access, agent close-by-default, AI auto-triage, product-feature paywalls,
unlimited-forever quotas, closed Cloud modules and app-owned Kubernetes.

### Architecture Approach

Use a modular monolith with ports and adapters. Web, extension and MCP are
untrusted delivery adapters into the same typed commands/queries and policy
layer. PostgreSQL stores current state, command receipts, quota reservations and
append-only domain activity; private S3 stores opaque objects. Auth verifies
identity, while the Issopen policy layer intersects membership/role, grant
scopes, project allowlist, autonomy, tenant and entitlement on every request.
RLS and composite tenant foreign keys add database defense in depth. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for full boundaries.

```text
React SPA ───────┐
Chromium/WXT ────┼── HTTPS ──> Hono adapters ──> application commands/policy
MCP clients ─────┘                                   │
                                                     ├── PostgreSQL
                                                     └── private S3 port
```

Every mutation uses one invariant pipeline:

```text
parse contract
  -> authenticate and build immutable actor context
  -> authorize tenant/project/action and enforce quota/rate
  -> transaction: check version + mutate + append activity + save receipt
  -> bounded transport response
```

The main data flows are likewise capability-scoped:

1. **Manual issue:** allocate a stable project number under lock, persist the
   issue and one human activity event atomically.
2. **Visual capture:** explicit gesture → local selection/capture → exact trusted
   preview and destructive redaction → authorized upload intent/reservation →
   private direct upload → server verification → atomic visual-issue finalization.
3. **MCP action:** OAuth/PAT verifies a server-owned `AgentIdentity` and live
   grant → shared command enforces project/scope/autonomy/version → mutation,
   idempotency receipt and attributed activity commit together.
4. **Audit epic:** ordinary authorized issues reference one scoped epic/category;
   progress is derived from issue semantics rather than duplicated counters.
5. **Community/Cloud:** one release and schema use interchangeable PostgreSQL,
   S3, identity and mail adapters; entitlements alter capacity, not capability.

### Critical Pitfalls and Prevention

The full release-gate analysis is in [PITFALLS.md](./PITFALLS.md).

1. **Screenshot/DOM exfiltration** — construct bounded structured context rather
   than cleaning raw HTML; keep raster, crop, masking and exact payload preview
   local; strip URL query/fragment by default; upload only flattened output.
2. **Cross-tenant IDOR/BOLA** — derive actor/tenant server-side; scope every
   repository call; enforce composite tenant keys and forced RLS; generate a
   two-tenant negative matrix for every REST/MCP resource
   ([OWASP BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)).
3. **Overpowered/leaked agents and prompt injection** — separate agent identity,
   project allowlist and fine scopes; label issue/DOM/image content as untrusted;
   expose no fetch/shell/patch/delete tool; bound consequences in server policy,
   not prompts
   ([OWASP Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/),
   [OWASP Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)).
4. **Duplicate/destructive writes and races** — typed commands, separate close
   scope, operation IDs, optimistic versions and atomic claim/lease rules;
   normal agent completion is Ready for Review.
5. **Private-media capability leak/SSRF** — opaque Issopen attachment IDs only;
   authorize before signing; verify bytes, signatures, pixels and types; never
   fetch repository/page/result URLs server-side
   ([OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html),
   [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)).
6. **Forged/incomplete activity** — server derives actor/time/outcome and appends
   a bounded immutable fact in the same transaction; never claim cryptographic
   non-repudiation or adopt event sourcing for v1.
7. **MCP auth/transport drift** — pin a tested protocol matrix, validate Origin,
   audience, discovery, scopes and revocation, and run clean-profile tests through
   a normal proxy against every advertised client.
8. **Cloud cost amplification** — atomic quota reservation/settlement, byte/pixel/
   page/request limits, no inlined images in MCP, lifecycle cleanup and
   per-workspace cost telemetry before public numerical promises
   ([OWASP Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)).
9. **Nominal self-hosting/open source** — same artifacts and contract suite,
   network-denied Community E2E, clean install, N-1 upgrade and full DB+object
   restore; legal/license gate before release.
10. **Accessibility retrofits and scope sprawl** — keyboard alternatives to
    drag/drawing and WCAG 2.2 AA criteria start with each UI slice; every phase
    must advance the core loop or close a named gate
    ([WCAG 2.2](https://www.w3.org/TR/WCAG22/)).

## Implications for Roadmap

The roadmap should use ten dependency-driven phases (0–9), replacing the
brief's thirteen mostly horizontal phases. Phase 5 is the first valid internal
product-thesis proof; Phase 7 completes the intended v1 product surface; Phases
8–9 make the open and hosted promises credible.

### Phase 0: Decisions and Portable Foundation

**Rationale:** Pin the deployable shape and investigate young auth/protocol
dependencies before data and client contracts harden.  
**Delivers:** exact tested dependency cohort; pnpm workspace; `server`, `web`,
`extension`, and `contracts`; Hono health/static skeleton; React/Vite build;
WXT package build; PostgreSQL/S3-configurable Compose; reviewed migration
command; CI; secret-safe configuration validation; preliminary license decision.  
**Addresses:** reproducible development, one deployable, Community portability.  
**Avoids:** Next.js/Supabase drift, speculative packages, unpinned young SDKs,
Cloud-only foundations.  
**Gate:** clean install/build/test with no Issopen-owned external service.  
**Research flag:** recheck all version cohorts; spike Better Auth + MCP SDK v2,
OAuth discovery/consent/revocation and current client compatibility.

### Phase 1: Identity and Tenant Isolation

**Rationale:** Every later object, attachment and MCP tool inherits this trust
boundary.  
**Delivers:** GitHub OAuth and magic link, sessions/logout, personal workspace,
membership foundation, server-derived actor context, separate migration/runtime
DB roles, composite tenant constraints and forced RLS.  
**Addresses:** table-stakes login/onboarding and workspace isolation.  
**Avoids:** client-selected tenant, IDOR/BOLA, table-owner RLS bypass and Cloud/
Community identity divergence.  
**Gate:** two authenticated users cannot cross workspaces through any identifier
substitution, and an unscoped runtime-role query is denied.  
**Research flag:** standard pattern after the Phase 0 auth spike; skip a separate
research phase if that spike resolves provider migration/session behavior.

### Phase 2: Manual Tracker and Transactional Attribution

**Rationale:** Capture and MCP must reuse a stable issue aggregate rather than
inventing their own write paths.  
**Delivers:** projects, repository URL/default branch/subpath, stable issue IDs,
five semantic statuses with renameable display columns, board/detail, manual
create/edit, comments, result links, versions, operation receipts and atomic
append-only activity. Keyboard/status-menu movement is included with drag/drop.  
**Addresses:** useful tracker table stakes and repository context originally
deferred to brief Phase 10.  
**Avoids:** renamed columns breaking agents, duplicate writes, stale overwrite,
forged activity and inaccessible drag-only interaction.  
**Gate:** persistent human create/move/comment/review with exactly one attributable
event per accepted mutation and deterministic conflict behavior.  
**Research flag:** established patterns; skip research-phase.

### Phase 3: Private Visual Storage

**Rationale:** The extension cannot safely exist before the server has a tested
private-media contract.  
**Delivers:** upload intents, atomic byte reservations, direct private S3 upload,
finalization with actual type/size/pixel verification, opaque object IDs,
authorized short-lived reads, manual web attachment, orphan cleanup and initial
usage telemetry.  
**Addresses:** private attachments and the capacity model.  
**Avoids:** public URLs, quota races, MIME spoofing, pixel bombs, SSRF and lost
objects.  
**Gate:** cross-tenant access, enumeration, replay, mismatched bytes/types and
concurrent quota overshoot all fail safely.  
**Research flag:** standard S3 security pattern; research only the chosen
SeaweedFS/Cloud compatibility and raster-processing limits.

### Phase 4: Safe Chromium Visual Capture

**Rationale:** Privacy is part of capture, not a hardening phase after screenshots
have already left the browser.  
**Delivers:** MV3 `activeTab`/`scripting` permission model, PKCE extension auth,
visible viewport and crop, bounded element picker, allowlist DOM context, URL
minimization, trusted exact preview, destructive masking, reliable local draft,
idempotent issue submission and initial focused annotation.  
**Addresses:** safe visual evidence, element context and reporter control.  
**Avoids:** `<all_urls>`, page-triggered upload, token leakage, raw DOM, form
values, overlay-only redaction and service-worker state loss.  
**Gate:** canary/hostile-page tests prove removed fields and pixels never cross
the network; Chrome, Edge and Brave complete the explicit-gesture flow.  
**Research flag:** required—prototype sanitizer/selector/redaction against
iframes, shadow DOM, canvas, contenteditable and multiple DPR/zoom values.

### Phase 5: Complete Scoped Agent Loop

**Rationale:** Read-only MCP validates a transport, not Issopen's thesis; read
and write belong together after tracker, media, policy and attribution exist.  
**Delivers:** one current Streamable HTTP endpoint; protected-resource discovery,
OAuth 2.1/PKCE and consent; optional hashed PAT; `AgentIdentity`, delegated grant,
project allowlist and fine scopes; bounded list/get/media access; explicit create,
claim/release, comment, update supported fields, link result and transition;
human owner versus agent claim; Ready for Review; close step-up/permission;
version/idempotency and activity.  
**Addresses:** safe MCP read/write, separately governed agents and the complete
activation loop.  
**Avoids:** PAT-owner attribution, broad inherited access, prompt-controlled
authorization, arbitrary patch/delete, token passthrough, duplicate calls and
transport-specific business logic.  
**Gate:** Codex and Claude Code authorize through a real proxy; one agent reads a
visual issue, claims it, posts progress/result, moves it to review and a human
closes it; wrong audience/project/scope and revoked credentials fail immediately.  
**Research flag:** required immediately before planning—current spec revision,
CIMD/pre-registration, scope step-up, target-client compatibility and legacy
compatibility envelope.

### Phase 6: Collaboration and Capture Completeness

**Rationale:** Polish the tracker/capture workflow after the core loop reveals
which interactions need depth.  
**Delivers:** invitations and simple human roles, priorities/labels, filters and
search, mentions, minimal notification inbox/email, onboarding checklist,
annotation set, selector improvements, conflict recovery and accessible critical
flows.  
**Addresses:** remaining table stakes without introducing general PM scope.  
**Avoids:** notification rules engine, custom roles/workflows, annotation-only
reporting and inaccessible pointer-only behavior.  
**Gate:** a collaborator can discover, understand and review a visual issue
without gaining unauthorized media access; keyboard-only core flow passes.  
**Research flag:** established product patterns; UI design/UX validation is more
valuable than a broad technical research phase.

### Phase 7: Mixed Audit Epics

**Rationale:** Audit aggregation depends on stable issues, actors, scopes and the
full human-agent loop; introducing it earlier duplicates or distorts those models.  
**Delivers:** first-class audit scope/goal/owner/categories, human and scoped-agent
finding creation/linking, actor/source views, computed progress and deterministic
versioned internal summary.  
**Addresses:** Issopen's second meaningful differentiator.  
**Avoids:** scanners, hosted agents, certifications, arbitrary hierarchies,
templates, scheduling and PDF/report scope.  
**Gate:** one audit mixes visual and code/SEO/security/compliance findings without
broadening a grant; progress always derives from issue semantic state.  
**Research flag:** required product research with real maintainers to validate
categories, scope language and completion semantics.

### Phase 8: Community Release and Distribution Parity

**Rationale:** Portability has been exercised since Phase 0; this phase turns it
into a supportable release contract rather than adding a second product.  
**Delivers:** single pinned OCI image, extension artifact/unpacked instructions,
Compose with replaceable PostgreSQL/S3/SMTP/OAuth, explicit migrations, config
docs, health checks, optional telemetry, cleanup/retention commands, release
process, clean install, N-1 upgrade, rollback expectations, DB+bucket backup/
restore, source/license/contribution/security mechanics.  
**Addresses:** credible self-hosting and all-open-source promise.  
**Avoids:** Cloud-only capture/MCP, `latest` tags, startup automigrations,
unrestorable attachments and nominal AGPL claims.  
**Gate:** network-denied Community instance completes the core loop after clean
install, upgrade and restore with attachment/activity integrity.  
**Research flag:** legal review and deployment-specific backup/upgrade research
required; ordinary Compose mechanics are standard.

### Phase 9: Cloud Free Public Beta

**Rationale:** Public operation requires measured limits, parity evidence and
current browser/MCP distribution checks, not speculative quotas.  
**Delivers:** central plan policy and usage page, atomic/graceful capacity limits,
rate/abuse controls, per-tenant cost telemetry, backups/recovery evidence,
deletion/export path, structured monitoring, current MCP client matrix, Chrome
Web Store submission/disclosures, privacy copy and WCAG 2.2 AA critical-flow
evidence. Paid plans alter capacity/support only.  
**Addresses:** permanent Cloud Free and capacity-paid operations.  
**Avoids:** data hostage behavior, noisy-neighbor bills, arbitrary quotas,
unreviewed extension permissions and unsupported compatibility claims.  
**Gate:** same release passes Community and Cloud contract suites; quota
exhaustion preserves reads/export/deletion; provider costs reconcile to tenant
usage; advertised clients and store artifact pass release checks.  
**Research flag:** required—unit economics, current MCP/browser policies,
retention/privacy and operational objectives.

### Phase Ordering Rationale

```text
portable foundation
  -> identity + tenant invariant
  -> issue state + atomic attribution
  -> private media capability
  -> locally reviewed browser capture
  -> scoped agent read/write + human review
  -> collaboration polish
  -> audit aggregation
  -> Community parity/recovery
  -> measured Cloud operation
```

- Private attachments precede extension capture because privacy cannot be added
  after a public or unauthorizable object model ships.
- The actor/event model precedes MCP write because agent attribution cannot be
  reconstructed accurately afterward.
- Repository metadata moves into the tracker slice because it is cheap and
  required in the first agent-ready issue.
- MCP read and write merge because the smallest product proof includes an agent
  changing the issue and a person reviewing it.
- Audit epics follow the loop because they aggregate ordinary issues and actors;
  they are not a parallel tracker.
- Community portability starts in foundation while release hardening remains
  late; this prevents lock-in without front-loading every deployment topology.
- Cloud quotas follow real upload/call telemetry, while hard safety caps and
  atomic reservations ship with the first media/API surfaces.

### MVP and Release Gates

| Boundary | Blocking evidence |
|---|---|
| First authenticated object | Cross-tenant denial and constrained runtime DB role |
| First issue write | Semantic state, expected-version/idempotency policy and atomic activity |
| First attachment | Private key, actual-content verification, authorized read, bounds and orphan cleanup |
| First extension capture | Explicit gesture, exact local preview, flattened redaction and hostile-DOM leak corpus |
| First MCP read/write | Agent identity/grant, per-tool scopes/project allowlist, prompt-injection consequence limits, real-client transport/auth matrix |
| Internal thesis MVP | Person captures reviewed issue → named external agent reads/updates → person reviews result |
| Community release | Same artifacts, clean install, N-1 upgrade, offline core-loop and DB+object restore |
| Public Cloud/Store | Measured/graceful limits, current MCP OAuth matrix, store disclosure review, accessibility audit and recovery evidence |

### Research Flags

Phases requiring targeted research during planning:

- **Phase 0:** current version cohort and Better Auth/MCP/OAuth feasibility spike.
- **Phase 3:** SeaweedFS/provider S3 contract and safe raster limits only.
- **Phase 4:** DOM/selectors/redaction/browser privacy behavior.
- **Phase 5:** current MCP protocol, OAuth and supported-client interoperability.
- **Phase 7:** user research on audit taxonomy and value.
- **Phase 8:** AGPL/legal mechanics and chosen backup/upgrade topology.
- **Phase 9:** Cloud economics, retention/privacy, store policy and release-time
  client matrix.

Phases with established patterns where `$gsd-research-phase` can normally be
skipped:

- **Phase 1:** sessions, tenant authorization and PostgreSQL RLS, provided the
  auth-library spike is already closed.
- **Phase 2:** CRUD tracker, optimistic concurrency and transactional activity.
- **Phase 6:** invitations, filters, notifications and accessibility implementation;
  use UI-specific design/validation instead of ecosystem research.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH for architecture; MEDIUM-HIGH for exact integrations | Official runtime/framework/database sources support the families; Better Auth MCP, SDK v2, WXT 0.x and SeaweedFS operations need spikes |
| Features | HIGH for table stakes; MEDIUM for differentiation | Competitor and issue-tracker capabilities are first-party; agent-identity and audit opportunity are reasoned market inferences requiring interviews |
| Architecture | HIGH for boundaries; MEDIUM for MCP client envelope | Trust boundaries, PostgreSQL, Chrome and OAuth requirements use primary specs; actual target clients must be exercised |
| Pitfalls | HIGH for security/privacy; MEDIUM for business/community | OWASP, Chrome, MCP and WCAG directly support technical gates; unit economics, license application and operational thresholds need evidence |

**Overall confidence:** MEDIUM-HIGH. The product wedge, modular-monolith shape,
security order and portability strategy are strong enough to drive requirements
and roadmap creation. Confidence is intentionally lower where a live client,
legal decision, user behavior or provider invoice is the only valid evidence.

### Gaps to Address

- **No validated users yet:** run interviews and instrument the whole-loop
  activation metric; do not treat signups or MCP connections as validation.
- **Agent-governance differentiation is inferred:** test whether maintainers
  understand and value named identities, project allowlists and separate human
  ownership before making comparative claims.
- **Audit semantics are hypothetical:** validate the five starting categories
  and non-certification language with real audit workflows.
- **MCP ecosystem is moving:** recheck the current spec and stable Codex/Claude
  behavior both at phase planning and release; do not advertise untested clients.
- **Capture privacy contract is unproven:** create a representative hostile/PII
  fixture corpus before freezing requirements for DOM, URL and redaction.
- **Cloud limits and retention are unknown:** record actual bytes, egress, image
  work, API/MCP requests, email, logs and backup overhead before setting numbers.
- **Legal model is pending:** AGPLv3 is a target, not an approved final license.
- **Operational self-host envelope is unknown:** define supported architectures,
  upgrade window and recovery objectives after the concrete deployment is tested.

## Sources

### Internal Research Inputs

- [STACK.md](./STACK.md) — stack, versions, portability and pinning policy.
- [FEATURES.md](./FEATURES.md) — competitors, table stakes, differentiators,
  anti-features and recommended v1 cut.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — components, trust boundaries, data flows,
  authorization model and dependency-driven build order.
- [PITFALLS.md](./PITFALLS.md) — release gates, adversarial validation and
  product/operation failure modes.
- [PROJECT.md](../PROJECT.md) — current product scope and higher-precedence
  constraints.
- [`init-project.md`](../../init-project.md) — original brief and superseded
  technical/roadmap hypotheses.

### Primary External Sources (HIGH confidence)

- [MCP 2026-07-28 authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization),
  [transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
  and [security considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)
  — Remote MCP transport, OAuth discovery, scopes and audience controls.
- [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728.html) and
  [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html) — protected-resource
  metadata and resource-bound OAuth tokens.
- [Chrome extension documentation](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
  and [Chrome Web Store user-data policy](https://developer.chrome.com/docs/webstore/user_data)
  — permissions, capture and disclosure boundaries.
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) —
  default-deny and owner/`BYPASSRLS` caveats.
- [OWASP API Security](https://owasp.org/www-project-api-security/),
  [File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html),
  [SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
  and [LLM risks](https://genai.owasp.org/llm-top-10/) — tenant, media, resource
  and agent-risk controls.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — accessible web/extension interaction.

### Primary Product Sources (capabilities HIGH; opportunity inference MEDIUM)

- [BugHerd features](https://bugherd.com/features) and
  [MCP](https://bugherd.com/feature/mcp).
- [Marker.io features](https://marker.io/features) and
  [MCP](https://help.marker.io/en/articles/14034657-mcp-integration-model-context-protocol).
- [Userback features](https://userback.io/features/),
  [MCP](https://userback.io/feature/mcp-integration/) and
  [pricing](https://userback.io/pricing/).
- [Plane open source](https://plane.so/open-source),
  [Plane AI](https://plane.so/ai) and
  [canonical repository](https://github.com/makeplane/plane).

---
*Research completed: 2026-08-23*  
*Ready for roadmap: yes*
