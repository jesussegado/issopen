# Phase 1 Research — Private Single-Owner Dogfooding MVP

**Researched:** 2026-08-31  
**Scope:** implementation guidance for the Phase 1 vertical MVP only

## Recommendation

Build one Node.js/TypeScript deployable that serves a React/Vite SPA, a Hono
REST API, Better Auth endpoints and a stateless Streamable HTTP MCP endpoint.
Persist product, session and OAuth data in the same PostgreSQL instance through
versioned Drizzle migrations. Docker Compose is the supported Phase 1 runtime.

This keeps the first release small without weakening the product boundary:
browser sessions, ChatGPT OAuth credentials and code-agent PATs remain separate
identities; every accepted tracker mutation and its server-derived activity
event commit in one database transaction.

## Verified implementation cohort

The dependency cohort was rechecked against the public package registries and
official product documentation before planning:

- Node.js 24 LTS, ESM and TypeScript 6.
- React 19 with Vite 8 and phase-local Tailwind CSS 4 tokens.
- Hono 4.13.5 on `@hono/node-server`.
- Better Auth 1.7.2 for the owner session and OAuth authorization server.
- MCP TypeScript packages 2.0.0 with stateless Streamable HTTP transport.
- PostgreSQL 18 with Drizzle ORM and explicit SQL migrations.
- Vitest for unit/integration tests and Playwright for the browser acceptance
  path. No drag-and-drop, component registry or desktop wrapper is needed.

Exact compatible package versions must be locked by the package manager. If a
Better Auth or MCP integration package has a different release cadence, its
peer dependency range must be verified during installation and kept in the
same lockfile.

## Vertical architecture

```text
browser -> /auth/* (owner session) ----+
browser -> /api/v1/* ------------------+--> Hono application --> PostgreSQL
ChatGPT -> OAuth discovery + /mcp -----+
Codex  -> Bearer PAT + /mcp -----------+
```

Use a single application package with these responsibilities:

- `src/server/auth`: Better Auth configuration, owner-only bootstrap guards,
  browser-session resolution and OAuth resource metadata.
- `src/server/domain`: workspace, project, issue, agent and activity services.
  Domain operations accept an authenticated server actor, never actor fields
  from a request.
- `src/server/http`: status/auth pages, REST routes, validation and privacy-safe
  error mapping.
- `src/server/mcp`: tools that call the same domain services as REST after
  resolving either an OAuth access token or a hashed agent PAT.
- `src/web`: responsive React routes and the local primitives approved in
  `01-UI-SPEC.md`.
- `drizzle`: immutable SQL migrations and schema snapshot.
- `scripts`: idempotent bootstrap/recovery commands that never print secrets.

Do not introduce microservices, queues, Redis, S3, SMTP, social login, extension
code or a shared design-system package in this phase.

## Data and authorization model

The minimum product schema contains:

- exactly one `owner` account enforced by a singleton bootstrap lock;
- one personal `workspace` created after first sign-in;
- `projects` with an immutable uppercase key and optional Git context;
- monotonic per-project issue counters and stable issue keys;
- `issues` with owner and agent claim represented independently;
- immutable `activity_events` whose actor, source and timestamp are supplied by
  the server;
- `code_links` limited to branch, commit and pull-request URLs;
- `agent_identities`, a project allowlist and explicit scopes;
- `agent_credentials` containing only a keyed password hash/fingerprint,
  expiry, revocation and last-use metadata;
- Better Auth session and OAuth tables in the same database.

All project/issue lookups are scoped in the service query, not filtered only in
the UI. Agent requests require both the named scope and membership of the
target project in the allowlist. `Done` additionally requires `issues:close`;
the default Codex grant deliberately omits it.

Use a transaction for the domain row, its version increment and activity
event. Activity summaries are produced from a bounded allowlist of changed
fields. A request body cannot supply `actor`, `source`, `createdAt`, workspace,
or an activity summary.

## Owner bootstrap and recovery

The supported bootstrap is an operator command invoked inside the application
container with owner email and password provided through an interactive prompt
or short-lived process environment. It is idempotent only for the already
bootstrapped owner and refuses to create a second account. The command acquires
a database singleton/advisory lock before checking and creating the owner.

Recovery is a separate operator command that rotates the password and revokes
all active owner sessions. Neither path is exposed as an anonymous HTTP route.
The web uses a secure, HTTP-only, same-site session cookie; production mode
requires HTTPS and a configured trusted origin.

## Remote MCP and ChatGPT

Expose one stateless `/mcp` resource. OAuth 2.1 discovery/resource metadata,
authorization-code flow and PKCE `S256` serve human-authorized ChatGPT access.
Dynamic client metadata/registration is accepted only according to the current
ChatGPT Developer Mode contract, with validated redirect URIs and exact
resource/audience binding. OAuth consent requires an owner browser session and
shows the requested scopes as escaped text.

PAT authentication is an additional path for the external code agent. Tokens
are high-entropy, shown once, never returned again and compared through a
non-reversible hash. Revocation and expiry are checked on every request.

The Phase 1 tool surface is deliberately narrow:

- `list_projects`, `list_issues`, `get_issue`;
- `update_issue` for explicitly allowed fields;
- `claim_issue`, `release_issue`;
- `link_code_result`;
- `move_issue` with a separate close permission.

Tool handlers parse Zod inputs, resolve all IDs inside the authenticated
allowlist and call a predetermined domain operation. Ticket text is output
data only: it cannot select a tool, add a scope or override a project.

ChatGPT's real connection cannot be proven only in a local test suite. Its
final acceptance is an external checkpoint requiring an operator-authorized,
remote HTTPS URL. The implementation must be complete and testable locally,
but planning must not invent a hostname, DNS record or Cloudflare credential.

## Threat model (ASVS L1 baseline)

| Threat | Required mitigation and verification |
| --- | --- |
| Anonymous tracker/MCP access | Deny protected REST and MCP without a valid session/OAuth token/PAT; integration tests cover every boundary. |
| Second-owner race | Database singleton lock/constraint; concurrent bootstrap test leaves exactly one owner. |
| Horizontal project access | Scope project/issue queries in SQL and test disallowed IDs as indistinguishable unavailable resources. |
| PAT disclosure | Generate with CSPRNG, store only a password hash, redact headers/logs and assert later responses never contain the token. |
| OAuth code interception/replay | Require PKCE S256, exact redirect matching, short-lived one-time code, resource/audience and expiry checks. |
| Scope escalation from issue text | Fixed tool dispatch and schemas; server ignores/rejects actor, scope, project override and nested instruction fields. |
| Forged activity | Build actor/source/time/change summary from authenticated context and committed mutation; reject client audit fields. |
| Agent closes work implicitly | Default token lacks close scope and transition to `Done` returns forbidden without it. |
| CSRF/session theft | Same-site HTTP-only secure cookies in HTTPS mode, trusted-origin checks and explicit sign-out/session revocation. |
| Malicious external URLs | Store as bounded plain data; never fetch or preview repository/code URLs; escape them in UI. |

No Phase 1 plan may leave a HIGH threat without a concrete mitigation and
automated verification.

## Validation Architecture

### Test layers

- **Unit:** enum transitions, project keys, issue counters, scope matrix, PAT
  parsing/hashing, redaction and activity summaries.
- **Database integration:** migrations against PostgreSQL, owner singleton,
  transaction atomicity, project allowlists, stable issue keys, revocation and
  concurrent version checks.
- **HTTP integration:** anonymous denial, sign-in/session, protected REST,
  consent/discovery metadata and MCP requests for OAuth/PAT actors.
- **UI component/route:** form errors, preserved input, accessible names,
  status changes, one-time PAT reveal and review actions.
- **Browser acceptance:** bootstrap -> sign-in -> workspace -> project -> issue
  -> board -> create Codex identity -> review result. Run at desktop and mobile
  widths with keyboard-only status movement.
- **Protocol acceptance:** initialize MCP, list/read/update/claim/link/move using
  a scoped test token; assert `Done` is forbidden without close scope.
- **External checkpoint:** use an HTTPS deployment with ChatGPT Work Developer
  Mode, authorize via OAuth/PKCE, list and update the dogfood project, then
  revoke access. This requires operator input and is not replaceable by mocks.

### Required commands

The implementation must provide reproducible commands for install, lint,
typecheck, unit/integration tests, browser tests, production build, migrations,
owner bootstrap/recovery and Compose start/status/stop. CI-oriented tests must
not need real ChatGPT, Git credentials, Cloudflare or a public hostname.

### Gate evidence

- Clean Compose startup and restart preserve PostgreSQL data.
- Health/readiness returns no infrastructure or account data.
- Automated tests prove all Phase 1 authorization and activity invariants.
- Accessibility checks cover labels, focus, keyboard flow and both responsive
  board compositions.
- A seeded dogfood scenario demonstrates the full human/agent review loop.
- The ChatGPT checkpoint records the endpoint used and result without storing
  OAuth tokens, authorization codes or owner credentials in Git.

## Sources

- Better Auth documentation: https://www.better-auth.com/docs
- Better Auth OAuth provider plugin: https://www.better-auth.com/docs/plugins/oauth-provider
- Model Context Protocol authorization: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- OpenAI Developer Mode and MCP: https://platform.openai.com/docs/guides/developer-mode
- Hono Node.js documentation: https://hono.dev/docs/getting-started/nodejs
- Drizzle PostgreSQL documentation: https://orm.drizzle.team/docs/get-started-postgresql

## RESEARCH COMPLETE
