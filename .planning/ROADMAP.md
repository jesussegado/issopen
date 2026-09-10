# Roadmap: Issopen

## Overview

Issopen se entrega mediante nueve fases secuenciales. La fase 1 ya no es una
foundation horizontal: es el primer producto privado realmente utilizable y
dogfoodable. Un único owner levanta Issopen con Docker Compose, usa una web HTML
responsive para gestionar tickets, conecta ChatGPT mediante Remote MCP
autenticado y concede una identidad con token separado a un agente de código
externo. El gate exige gobernar una mejora real de Issopen hasta revisión humana.

Las fases siguientes amplían ese bucle probado. Primero incorporan identidad
humana y colaboración, luego profundidad del tracker y control de concurrencia;
después llegan almacenamiento visual, captura Chromium y auditorías. La
portabilidad amplia, el hardening de release y Cloud Free permanecen al final.
Issopen sólo conserva tickets, permisos, actividad y referencias: no edita
código, ejecuta CI, hace merge ni despliega.

## Phases

**Execution model:** secuencial; cada fase depende de la anterior y no comienza
hasta que su gate y sus criterios de éxito sean verificables.

- [ ] **Phase 1: Private Single-Owner Dogfooding MVP** - One owner can run Issopen, govern tickets through the web and ChatGPT, and review work returned by a separately authenticated code agent.
- [ ] **Phase 2: Human Identity and Collaboration** - People can join an isolated workspace and coordinate through portable authentication, roles, comments, and notifications.
- [ ] **Phase 3: Tracker Depth and Agent Concurrency** - The proven loop gains archive, labels, credential changes, and deterministic concurrent writes.
- [ ] **Phase 4: Private Visual Storage** - Attachments remain private, authorized, quota-consistent, and usable through MCP without durable exposure.
- [ ] **Phase 5: Safe Chromium Capture Core** - Users can inspect, minimize, and redact visual evidence locally before any submission.
- [ ] **Phase 6: Reliable Capture Submission and Activation** - Users can annotate, resume, submit, and confirm visual issues without duplicates.
- [ ] **Phase 7: Mixed Audit Epics** - People and scoped agents can combine visual and technical findings into deterministic, accessible audits.
- [ ] **Phase 8: Community Portability and Release Recovery** - Operators can install, configure, upgrade, back up, restore, and verify the complete open product.
- [ ] **Phase 9: Cloud Free Public Beta** - Cloud Free runs the same product with measured limits, safe operations, and portable data.

## Phase Details

### Phase 1: Private Single-Owner Dogfooding MVP
**Goal**: One owner can run a private Issopen and use it with ChatGPT and a separately authenticated external code agent to deliver a real Issopen improvement for human review.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-05, WRKS-01, WEB-01, PROJ-01, PROJ-02, ISSU-01, ISSU-02, ISSU-05, ISSU-07, BOARD-01, BOARD-02, ACTV-01, ACTV-02, AGNT-01, AGNT-02, AGNT-03, AGNT-04, AGNT-05, AGNT-06, MCP-01, MCP-02, MCP-03, MCP-06, MCP-07, MCP-09, MCP-10, MCP-11, DOGF-01, COMM-02, SECU-04
**Success Criteria** (what must be TRUE):
  1. An operator can use one documented Docker Compose procedure to start or resume a private Issopen with PostgreSQL persistence, bootstrap exactly one owner, open its responsive web interface from a normal desktop or mobile browser, and find no anonymous tracker or MCP access.
  2. The owner can create a project with lightweight repository context, create and prioritize issues, move them through the five fixed semantic states, and see each accepted mutation in a minimal server-attributed activity chronology.
  3. The owner can add Issopen as a personal ChatGPT plugin, complete the required authenticated flow, and ask ChatGPT to list, inspect, and update only the private project's tickets.
  4. The owner can create and revoke a separate, hashed token for a named code-agent identity; that agent can claim an issue, update permitted fields, link a branch, commit, or pull request, and move it to Ready for Human Review (`ready_for_review`) without replacing the human owner or gaining implicit close permission.
  5. Using Issopen's own board, ChatGPT prioritizes a real Issopen improvement, the selected external code agent returns its repository result, and the owner reviews and accepts or rejects it while Issopen never edits code, runs CI, merges, or deploys.
**Plans**: 5 plans

Plans:
- [x] 01-01 — Runnable Compose/PostgreSQL skeleton, singleton owner auth and personal workspace.
- [x] 01-02 — Transactional project, issue, board, code-result and activity domain/API.
- [x] 01-03 — Responsive, keyboard-accessible owner web workflow.
- [x] 01-04 — Scoped agent identities plus OAuth/PAT Remote MCP.
- [ ] 01-05 — Dogfooding, complete quality gates, truthful operations docs and real ChatGPT checkpoint.
**UI hint**: yes

### Phase 2: Human Identity and Collaboration
**Goal**: People can securely join an isolated workspace and coordinate review without sharing the bootstrap owner or agent credentials.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, WRKS-02, WRKS-03, WRKS-04, ISSU-06, NOTF-01, NOTF-02, SECU-01, SECU-02
**Success Criteria** (what must be TRUE):
  1. A person can sign in with GitHub OAuth or a one-use email magic link, safely link both methods to one account, inspect sessions, sign out, and revoke other sessions.
  2. An owner or admin can invite, inspect, and revoke collaborators; invitees can accept or reject, and owner/admin/member permissions are enforced by the server.
  3. Humans and authorized agents can comment with clear authorship, while members receive linked invitation, mention, assignment, and Ready for Human Review notifications that they can read or mute.
  4. Identifier substitution and role escalation cannot expose or mutate another workspace, project, membership, agent identity, or file capability.
  5. Authentication and MCP credentials validate origin, audience, expiration, and revocation without appearing in persisted URLs, errors, or logs.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Tracker Depth and Agent Concurrency
**Goal**: The private and collaborative tracker remains manageable as its history, metadata, and concurrent agent activity grow.
**Depends on**: Phase 2
**Requirements**: PROJ-03, ISSU-03, ISSU-08, AGNT-07, MCP-08
**Success Criteria** (what must be TRUE):
  1. Members can use reusable project labels on issues without changing stable issue identities or semantic states.
  2. An admin can archive and restore a project, and a member can archive and restore an issue, without losing history, references, relationships, comments, or attachments already present.
  3. Reducing an agent's scopes, removing a project, or revoking its credential affects new requests immediately while preserving attributed history.
  4. Retried or concurrent MCP writes use idempotency keys and expected resource versions so they neither duplicate work nor silently overwrite a newer change.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Private Visual Storage
**Goal**: Users and authorized agents can attach and retrieve evidence without exposing private objects or corrupting storage quotas.
**Depends on**: Phase 3
**Requirements**: FILE-01, FILE-02, FILE-03, MCP-04
**Success Criteria** (what must be TRUE):
  1. A user can attach a valid file to an issue, while invalid type, size, content, or integrity is rejected before association.
  2. An authorized user can open an attachment through short-lived access; expired links and links used from another workspace cannot retrieve it.
  3. Completed uploads and deletions settle quota consistently, while cancelled, incomplete, and orphaned uploads release reservations and are cleaned up.
  4. An authorized MCP client receives only temporary attachment references scoped to the permitted resource, never durable private images embedded in protocol responses or logs.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Safe Chromium Capture Core
**Goal**: Users can inspect and minimize visual context locally so sensitive or omitted data never leaves the browser.
**Depends on**: Phase 4
**Requirements**: CAPT-01, CAPT-02, CAPT-03, CAPT-04, CAPT-05, CAPT-06, CAPT-10, SECU-03
**Success Criteria** (what must be TRUE):
  1. A reproducible, versioned Manifest V3 extension installs on Chrome, Edge, and Brave and can inspect or capture a page only after an explicit user gesture with its minimal permissions explained.
  2. A user can capture the visible viewport or a free crop and optionally include reviewed URL, viewport, browser, scroll, element, selector, bounded text, and sanitized DOM context.
  3. Before submission, the user sees the exact image and fields Issopen would receive, can omit each context group, and can destructively hide pixels so no sensitive value or recoverable original image reaches the server.
  4. Oversized, deceptive, active, SSRF-capable, or excessively complex URL, HTML, DOM, and image inputs fail safely without executing content or exposing private data.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Reliable Capture Submission and Activation
**Goal**: Users can turn reviewed visual evidence into a confirmed issue despite interruption, without losing work or creating duplicates.
**Depends on**: Phase 5
**Requirements**: ONBD-01, CAPT-07, CAPT-08, CAPT-09
**Success Criteria** (what must be TRUE):
  1. Before submission, a user can add rectangles, arrows, freehand marks, and text to a capture without changing the inspected page.
  2. An unsent draft survives locally, and retry after a network failure resumes the attempt without repeating the capture or creating a duplicate issue.
  3. A successful submission shows the destination project, stable issue key, and link, and the user can immediately open the issue with its reviewed evidence attached.
  4. A user can resume or dismiss an onboarding checklist whose project, issue, capture, and MCP steps complete only from real system facts.
**Plans**: TBD
**UI hint**: yes

### Phase 7: Mixed Audit Epics
**Goal**: People and scoped agents can aggregate visual and technical findings into a live audit without implying automated certification.
**Depends on**: Phase 6
**Requirements**: ISSU-04, MCP-05, AUDT-01, AUDT-02, AUDT-03, AUDT-04, AUDT-05, AUDT-06, AUDT-07, ACCS-01
**Success Criteria** (what must be TRUE):
  1. A person can create an audit epic with project, objective, scope, owner, and the defined visual, UX, flow, code, SEO, security, and compliance categories.
  2. Human, extension, and agent-created issues can be created, linked, unlinked, searched, and filtered as findings while retaining origin, author, claim, references, and activity.
  3. A properly scoped agent can read an audit and create or link a finding through MCP without gaining access beyond its project allowlist.
  4. The audit displays deterministic counts and progress derived from issue state; only an authorized human can complete or reopen it, and the interface never presents completion as certification.
  5. Registration, project and issue creation, Kanban, capture review, audit, and agent administration work with keyboard navigation, visible focus, accessible names, and WCAG 2.2 AA contrast.
**Plans**: TBD
**UI hint**: yes

### Phase 8: Community Portability and Release Recovery
**Goal**: Operators can independently install, configure, upgrade, restore, and verify the complete open Issopen product across the supported Community envelope.
**Depends on**: Phase 7
**Requirements**: COMM-01, COMM-03, COMM-04, COMM-05, COMM-06, QUAL-01
**Success Criteria** (what must be TRUE):
  1. An operator can obtain the complete v1 source and release artifacts under the legally approved license and run capture, audits, ChatGPT MCP, and external-agent work without calling a proprietary Issopen Cloud service.
  2. A supported Community installation can use documented PostgreSQL, S3-compatible storage, SMTP, and OAuth configuration, exposes health/readiness/version, and rejects bad configuration with actionable diagnostics.
  3. An operator can apply explicit migrations when upgrading from the previous supported release and follow the documented rollback path whenever the migration permits it.
  4. An operator can back up and jointly restore database and object storage, then verify attachment and activity integrity by completing the core loop on the restored instance.
  5. Automated release tests prove capture → issue → MCP claim → code result → human review and the principal authorization and privacy denials.
**Plans**: TBD

### Phase 9: Cloud Free Public Beta
**Goal**: Users can rely on a permanent Cloud Free service with Community parity, transparent capacity policy, and safe hosted operations.
**Depends on**: Phase 8
**Requirements**: CLOD-01, CLOD-02, CLOD-03, CLOD-04, CLOD-05, CLOD-06, CLOD-07, CLOD-08, OPER-01, OPER-02
**Success Criteria** (what must be TRUE):
  1. A Cloud Free user can complete the same project, capture, audit, ChatGPT MCP, external-agent work, and human review loop using the same public artifacts, migrations, and contracts as Community.
  2. Owners and admins can see current usage, measurement period, and centrally configured limits before exhaustion; published Free limits are backed by measured operational costs, and paid plans change only capacity, retention, operation, or support.
  3. Reaching a capacity limit blocks only related growth while preserving reads, downloads, text comments, archival, deletion, and a visible workspace export and deletion-request path.
  4. Hosted tenant isolation, rate and abuse controls, backups, recovery checks, and monitoring protect one workspace from another without weakening Community authorization guarantees.
  5. Web, extension, and MCP errors carry a correlatable request identifier and remain actionable without secrets or cross-tenant data; metrics and logs expose auth, MCP, capture, file, quota, and restore health without private content by default.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Private Single-Owner Dogfooding MVP | 0/TBD | Not started | - |
| 2. Human Identity and Collaboration | 0/TBD | Not started | - |
| 3. Tracker Depth and Agent Concurrency | 0/TBD | Not started | - |
| 4. Private Visual Storage | 0/TBD | Not started | - |
| 5. Safe Chromium Capture Core | 0/TBD | Not started | - |
| 6. Reliable Capture Submission and Activation | 0/TBD | Not started | - |
| 7. Mixed Audit Epics | 0/TBD | Not started | - |
| 8. Community Portability and Release Recovery | 0/TBD | Not started | - |
| 9. Cloud Free Public Beta | 0/TBD | Not started | - |
