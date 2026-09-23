# Refactoring and internal quality v1

This document is the safety map for Issopen Epic 10. It records the current
boundaries before code moves, links measured hotspots to tracker tickets, and
defines the checks that must remain green throughout the refactor.

Baseline captured on 2026-09-23 from source commit `052357f`. The baseline
passes `pnpm lint`, `pnpm typecheck`, and the fast suite with 195 tests.

## Non-negotiable boundaries

Issopen remains a modular monolith. The dependency direction is:

```text
Web / Chrome / REST / MCP
          |
          v
  domain services and contracts
          |
          v
   Drizzle schema and PostgreSQL
```

- Domain services own business rules, transactions, authorization-relevant
  resource checks, optimistic concurrency, idempotency effects, and activity.
- REST and MCP adapt transport. They must not introduce direct database writes
  or competing versions of domain rules.
- Web and Chrome consume public contracts. They never import server internals.
- `src/shared` contains bounded transport-neutral contracts. It cannot depend
  on an adapter.
- `HumanAccess` remains the source of truth for human workspace/project access.
- Existing REST, MCP and Chrome contracts remain compatible until a separate
  product ticket explicitly versions them.
- A refactor cannot weaken workspace scoping, project allowlists, scopes,
  single-use credentials, audit attribution, CAS/version checks, or retry
  idempotency.

The executable form of the import/write boundaries lives in
`tests/unit/architecture-boundaries.test.ts`.

## Current module map

| Area | Source of truth | Adapters and consumers |
|---|---|---|
| Tracker | `src/server/domain/tracker.ts`, `src/server/domain/contracts.ts` | `src/server/http/tracker.ts`, `src/server/mcp/tools.ts`, capture API, web |
| Human access | `src/server/human-access.ts`, membership/project services | REST session and routers, Chrome account/capture |
| Agents | `src/server/domain/agents/` | MCP handler/tools, agent web routes |
| Invitations | `src/server/invitations.ts`, `src/server/owner-invitations.ts` | invitation routers, auth plugins and web onboarding |
| Persistence | stable `src/server/db/schema.ts` facade over cohesive `src/server/db/schema/` modules, plus `drizzle/` | domain services and bounded read projections |
| Web state | route components plus `src/web/lib/` | browser UI and project live stream |
| Chrome | `extensions/chrome/lib/` and side-panel entrypoints | extension background, OAuth and capture API |

## Measured hotspots and ownership

Line count is a navigation signal, not a quality target. A file is split only
when it contains independent responsibilities or repeated invariants.

| Hotspot | Baseline | Evidence | Owning ticket |
|---|---:|---|---:|
| `src/server/domain/tracker.ts` | 1,856 lines | One service handles projects, Epics, issues, questions, comments, claims, reviews, activity and code links; mutation guards repeat | 126, 127 |
| `src/server/db/schema.ts` | 1,681 lines | More than 70 schema/relation exports across identity, access, tracker, agents and captures | 124 |
| `src/server/invitations.ts` | 1,265 lines | Member invitation lifecycle plus auth redemption | 125 |
| `src/server/owner-invitations.ts` | 779 lines | Owner invitation lifecycle repeats token/email/state primitives | 125 |
| `src/server/http/tracker.ts` | 712 lines | Transport parsing, domain errors, board projections and handlers coexist | 128 |
| `src/server/mcp/tools.ts` | 862 lines | All tools mix schemas, scopes, allowlists, pagination and idempotency | 129 |
| `src/web/routes/IssueDetailRoute.tsx` | 1,526 lines | Snapshot reconciliation and more than thirty state/ref values coexist with all panels | 130, 132 |
| `src/web/routes/BoardRoute.tsx` | 961 lines | Fetch/live state, filters, DnD, cards, columns and Epic overview coexist | 130, 131 |
| `extensions/chrome/entrypoints/sidepanel/Workspace.tsx` | 730 lines | Draft storage, destinations, inline creation, retry and presentation coexist | 133 |
| `src/web/styles.css` | 1,788 lines | Foundation, components, features and responsive rules share one cascade | 135 |
| Large integration/web suites | 1,100–2,380 lines each | Repeated identities, sessions, database setup and tracker factories | 134 |
| Remaining large services/routes | 470–886 lines | Size alone is not sufficient evidence; review after primary extractions | 136 |

Ticket 124 resolved the schema hotspot without changing its public facade: the
largest cohesive module is now access at 529 lines, cross-domain relations are
isolated and documented, and an executable boundary prevents deep imports.

Ticket 125 removes the shared invitation duplication without merging the two
domain flows. `invitation-primitives.ts` owns only the common email, token,
lifetime and lifecycle-state operations; member and Owner services retain
their policies, transactions, errors, summaries and authentication paths.

Ticket 128 centralizes transport-only parsing in
`src/server/http/validation.ts` and maps every `DomainError` through
`src/server/http/errors.ts`. Tracker, agents, invitations, Owner invitations,
ownership, profiles, account and workspace handlers now share the same body,
query and identifier primitives while their domain services continue to own
business validation. An architecture test rejects new router-local
`safeParse`, JSON catch or error-serializer copies, and exact response tests
protect validation fields, malformed JSON and all domain status mappings.

Ticket 134 gives the four largest integration suites explicit fixtures for
their real boundaries: an isolated PostgreSQL lifecycle/reset driver, a test
HTTP runtime and password-member builder, a Streamable HTTP MCP client and a
Chrome OAuth installation driver. Actors, table reset lists, project grants
and scenario inputs remain visible in each suite. The suites still own separate
containers and run safely in parallel; an architecture assertion prevents the
large suites from returning to copied lifecycle SQL. Expected invalid-revision
tests also keep Git stderr captured, so a passing run is quiet.

Ticket 126 moves the tracker mutation invariants to
`src/server/domain/tracker-mutations.ts`. Active issue locks and mutation
predicates now have one workspace/id/tombstone scope; expected versions and
question snapshots share conflict detection; issue version stamps and activity
attribution share one implementation. Transactions, business queries and
operation-specific guards remain explicit. Soft deletion deliberately keeps a
separate tombstone-aware lock so a lost successful response can be retried.

Ticket 127 keeps the public `TrackerService` facade while moving its internal
implementation into five non-importing capabilities: projects/Epics, issues,
discussion, workflow/review and activity. Cross-capability detail assembly stays
visible in the 213-line facade. A structural test prevents sibling capability
imports and REST/MCP bypasses; a mechanical comparison confirmed all 30 moved
operations are unchanged before running the consumer suites.

## Confirmed duplication

- Member and Owner invitations previously implemented email
  normalization/masking, token generation/hash, lifetime and lifecycle state
  independently. Those primitives now have one implementation. PostgreSQL
  unique-violation handling remains local to the only invitation flow that
  currently consumes it; the controller-error seam is handled by ticket 128.
- Tracker mutation invariants are centralized by ticket 126. Capability
  ownership is split by ticket 127 behind the compatible service facade.
- HTTP transport parsing and `DomainError` serialization are centralized by
  ticket 128; the remaining schema validation in services represents business
  rules rather than a competing controller implementation.
- MCP mutations repeat scope/resource checks, idempotency envelopes and
  structured results; list tools repeat cursor/fingerprint/page assembly.
- React routes repeat loading/missing/network/conflict state and protection
  against stale responses.
- Integration suites repeat owner/workspace/project/session construction.

These are targets, not permission to create generic frameworks. An extraction
must name a stable domain or transport concept, have multiple real consumers,
and leave the business rule visible at its call site.

## Characterization coverage

| Protected contract | Existing characterization |
|---|---|
| Human and agent authorization, workspace isolation and project allowlists | `tests/integration/http.test.ts`, `tests/integration/mcp.test.ts`, `tests/integration/extensions.test.ts`, project/member permission suites |
| MCP mutation idempotency and payload mismatch | `tests/integration/mcp.test.ts` |
| Chrome capture/container retry idempotency and private evidence | `tests/integration/extensions.test.ts`, `extensions/chrome/tests/e2e/composer.spec.ts` |
| Transactional audit attribution and immutable history | `tests/integration/tracker.test.ts`, `tests/integration/http.test.ts` |
| Issue/Epic optimistic concurrency and question-version snapshots | tracker/HTTP/MCP integration suites, `tests/web/detail-live.test.tsx`, `tests/e2e/conflicts.spec.ts` |
| Epic archive visibility and mutation rules | tracker/HTTP/MCP integration suites, `tests/e2e/tracker.spec.ts` |
| Board/detail live refresh and stale-response reconciliation | `tests/web/tracker.test.tsx`, `tests/web/detail-live.test.tsx`, board/detail live E2E suites |
| Versioned, owner-scoped Chrome drafts | `extensions/chrome/tests/unit/draft.test.ts`, protocol tests and composer/selectors E2E suites |
| Adapter/domain dependency direction | `tests/unit/architecture-boundaries.test.ts` |
| Independent, reusable integration setup by adapter boundary | `tests/fixtures/integration-database.ts`, `http-driver.ts`, `mcp-driver.ts`, `extension-driver.ts`; enforced for the four large suites by the architecture test |
| SQL schema unchanged by an internal move | `pnpm schema:check` against a temporary copy of committed Drizzle history |

`pnpm test:characterization` runs the focused server, web and Chrome suites
used while moving internal code. It is a fast refactor gate, not a substitute
for the complete validation required before delivery.

## Execution order

Tickets stay small and are completed in this order to avoid moving a file while
another ticket is extracting from it:

| Wave | Tickets | Result |
|---|---|---|
| 0 | 123 | Baseline, boundaries and repeatable gates |
| 1 | 124, 125, 128, 134 | Independent persistence, invitation, HTTP and fixture seams |
| 2 | 126 | Shared tracker transaction invariants, with characterization first |
| 3 | 127 | Tracker capability split behind its compatible facade |
| 4 | 129 | MCP modules reuse the stabilized domain surface |
| 5 | 130 | Shared, concrete web loading/mutation/live primitives |
| 6 | 131, 132 | Board and issue detail decomposition on the shared primitives |
| 7 | 133 | Chrome composer decomposition; may run after wave 1 if files do not overlap |
| 8 | 135 | CSS moves after component class names settle |
| 9 | 136 | Dead-code proof, architecture/docs reconciliation and full closure |

Parallel work is allowed only when declared files do not overlap. Tickets 126
and 127 are strictly sequential; 130 precedes 131/132; 135 follows the React
component moves; 136 is always last.

## Validation protocol

During each extraction:

1. Run the focused test that characterizes the code being moved.
2. Move one responsibility while keeping the old facade/export stable.
3. Re-run `pnpm refactor:check`.
4. Commit the bounded change before starting the next responsibility.
5. Before review, run the normal relevant integration/E2E suites.

Commands:

```bash
# Fast contract and architecture gate
pnpm refactor:check

# Normal fast project suite
pnpm test

# Full server, browser and Chrome gates before closing a cross-cutting ticket
pnpm validate

# Standalone zero-drift schema check; writes only to an OS temporary directory
pnpm schema:check
```

`schema:check` copies `drizzle/` to a fresh temporary directory and runs
`drizzle-kit generate` against that copy. Any added, removed or modified
migration artifact fails the command; the repository is never used as the
generator output.

## Definition of done for every refactor ticket

- Tests fail first or otherwise demonstrate the behavior being protected.
- Runtime/public behavior remains unchanged unless the ticket explicitly says
  otherwise.
- Deleted duplication has no remaining consumer and is proven by search/tests.
- New names describe domain intent rather than implementation mechanics.
- No new dependency or generic abstraction is added without measurable need.
- Tracker evidence records commands, results and the exact commit.
- Work is returned to Ready for Human Review (or the project-configured terminal
  status) with the agent claim released.
