# Issopen

Issopen is a private, self-hostable issue tracker for people and external code
agents. Phase 1 starts with a single owner, a responsive web interface and one
PostgreSQL database. Issopen records work and review; it does not edit a
repository, run CI, merge or deploy code.

## Current scope

The local Phase 1 implementation includes:

- one Node.js 24/Hono process serving the React SPA, private REST API, Better
  Auth authorization server and stateless Remote MCP endpoint;
- one private owner, one personal workspace, projects, five-state issues,
  attributed append-only activity, code-result links and human review;
- lightweight project Epics that group related tickets, expose derived progress
  and status counts, and filter the board without changing issue workflow;
- blocking questions with recommendations, bounded choices, an editable
  `Other` answer, answer counters and a warning-only board filter; unresolved
  blocking questions prevent the ticket from entering Ready for Review;
- named agent identities with explicit project allowlists and scopes;
- one-time Argon2id-hashed, expiring and revocable PATs for code agents;
- OAuth 2.1 authorization code with PKCE S256, CIMD and RFC 9728 discovery for
  ChatGPT Work;
- PostgreSQL 18 persistence and privacy-safe `/health/live` and
  `/health/ready` responses.

S3, SMTP, social login and multiple human users are not part of this runtime.
The same image is deployed through Argo CD with PostgreSQL on the always-on K3s
master and an Ingress for `issopen.serviciosegado.com`. Issopen stores backlog
and result references; it has no Git credentials or capability to edit a
repository, run CI, merge or deploy code.

## Chrome extension (pilot 0.4)

The `extensions/chrome` workspace contains an installable MV3 side panel built
with WXT, React and TypeScript. It checks the active page locally after an
explicit toolbar action and links the human account through OAuth PKCE, with
individual revocation in `/extensions`. Version 0.4 adds bounded viewport,
full-page, crop and element screenshots, sanitized structural DOM, irreversible
redaction, inline project/Epic creation and ticket submission with private PNG
evidence. One reviewed 24-hour draft survives reload/reconnection, and manual
idempotent retry avoids duplicates. See [delivery and operation](docs/chrome-delivery.md).
Existing read-only connections must reconnect to consent to creation.

Run `pnpm extension:build`, then load `extensions/chrome/.output/chrome-mv3`
unpacked in `chrome://extensions`. See the
[installation and test guide](extensions/chrome/README.md) and the
[approved Epic scope](docs/chrome-extension.md). `pnpm extension:validate`
checks this artifact; the root `pnpm validate` includes it too.

## Architecture and data flow

La identidad visual aprobada usa el icono de apertura de seis piezas y la
paleta verde bosque/menta. La [decisión de diseño](docs/design/0001-brand-identity.md)
documenta el logo, favicon, tokens, semántica y contraste. Los estilos viven en
`src/web/styles.css` y el componente de marca en `src/web/components/Brand.tsx`.

```text
browser owner ── session cookie ──> Hono /api/v1 ─┐
ChatGPT ── OAuth 2.1 PKCE ────────> POST /mcp     ├─> shared tracker domain
Codex ── scoped Issopen PAT ──────> POST /mcp     ┘          │
                                                            v
                                                      PostgreSQL 18
```

`src/server/domain/` is the sole mutation boundary. REST derives the human
actor from the owner session; MCP derives a separate agent actor from a
verified OAuth token or PAT. Every agent tool checks both an exact scope and a
persisted project allowlist before it invokes that domain. Every mutable MCP
tool additionally runs its domain mutation and idempotency record in one
PostgreSQL transaction.

## Epics and ticket grouping

An Epic is a lightweight container within exactly one project. It has a title
and description; progress, total tickets and counts for all five states are
always derived from its current issues. A ticket can belong to zero or one
Epic, and can be associated, moved to another Epic in the same project or
returned to **No Epic** from the create/edit issue form.

Epics and issues are displayed as `number-name` (for example,
`1-Chrome extension`), without brackets. Internal project prefixes and issue keys are not shown
in the web UI, including activity references, forms and accessibility labels.
New projects created from the web receive an automatically generated internal
key; existing keys, UUID links and API/MCP contracts remain unchanged. User-written
descriptions and comments are not rewritten. Epic numbers
start at 1 independently in each project, are assigned atomically by the server
and stay unchanged when the title is edited. REST and MCP return `number` and
the unmodified `title`; UUID URLs and ticket associations remain unchanged.
Migration `0011_epic_numbers` numbers existing Epics by creation date, then ID
to break ties, and advances each project's counter past its existing Epics.

Open **Manage Epics** from a project board to create an Epic or inspect its
related tickets. The board's **Show Epic** selector supports all tickets, only
unassigned tickets or one selected Epic. The selected Epic is stored in the
URL, so the filtered board can be bookmarked and the Epic detail can link back
to it. Compact Epic lists omit descriptions; the detail retains the description
and offers creation of another related ticket while the Epic is active. Epic
detail provides status counts, completion progress and direct links to every
related ticket.

An Epic can be archived after an explicit confirmation and restored from its
detail. Archiving is reversible: it preserves the Epic number, content,
progress and ticket associations. Archived Epics disappear from active board,
web and Chrome selectors, but their direct pages and related tickets remain
readable. **Manage Epics** exposes them through **Show archived**. Existing
tickets may keep moving through the workflow or leave an archived Epic; new
tickets cannot join one until it is restored. See
[Epic archiving](docs/epic-archiving.md) for API, MCP and rollback details.

The normal create-issue form can also paste or select up to five private PNG,
JPEG, or WebP images (8 MiB total). The browser prepares previews and the server
validates, strips metadata, and stores the PNG evidence atomically with an
idempotent issue creation. See [Epic 5 frontend delivery](docs/epic-5-frontend.md).

REST exposes `GET/POST /api/v1/projects/:projectId/epics` and
`GET/PATCH /api/v1/epics/:epicId`. Project issue lists and boards accept
`epicId=<uuid>` or `epicId=unassigned`; issue create/update accepts a nullable
`epicId`. PostgreSQL enforces the workspace/project relationship with a
composite foreign key, while the domain records Epic creation, edits and issue
association changes in append-only activity. Epic lists accept
`archived=active|archived|all` and default to active. `PATCH` accepts the
version-guarded `archived` boolean. There is intentionally no Epic hierarchy,
owner, due date or destructive delete operation in this MVP.

## Prerequisites

- Docker with Docker Compose v2
- Node.js `>=24 <25`
- pnpm `11.22.0` through Corepack for host-side development

All application and JavaScript package versions are exact. The Compose images
are pinned by tag and multi-platform digest.

## Start the private instance

Create a local configuration file with owner-only permissions. The commands
write generated values directly to `.env`; they do not print them:

```bash
umask 077
cp .env.example .env
sed -i "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" .env
sed -i "s/^BETTER_AUTH_SECRET=$/BETTER_AUTH_SECRET=$(openssl rand -hex 32)/" .env
docker compose up --build --wait
```

Open `http://localhost:8080/status`. Override `ISSOPEN_PORT` and
`ISSOPEN_BASE_URL` together when port 8080 is unavailable. Compose binds the web
port to loopback and does not publish PostgreSQL.

### Bootstrap the owner

The owner command accepts credentials only through short-lived process
environment variables. The values are inherited by `docker compose exec`; they
are not included in its command arguments or output.

```bash
read -r -p "Owner email: " ISSOPEN_OWNER_EMAIL
read -r -s -p "Owner password: " ISSOPEN_OWNER_PASSWORD
printf '\n'
export ISSOPEN_OWNER_EMAIL ISSOPEN_OWNER_PASSWORD
docker compose exec -T -e ISSOPEN_OWNER_EMAIL -e ISSOPEN_OWNER_PASSWORD app \
  node dist/runtime/scripts/owner.js bootstrap
unset ISSOPEN_OWNER_EMAIL ISSOPEN_OWNER_PASSWORD
```

The password must contain 12–128 characters. Re-running bootstrap for the same
email is a no-op; a different second owner is refused. There is no anonymous
browser or HTTP bootstrap route.

Sign in at `http://localhost:8080/sign-in`, then create the personal workspace.

### Recover the owner

Recovery rotates the password and immediately revokes all active owner
sessions:

```bash
read -r -p "Owner email: " ISSOPEN_OWNER_EMAIL
read -r -s -p "New owner password: " ISSOPEN_OWNER_PASSWORD
printf '\n'
export ISSOPEN_OWNER_EMAIL ISSOPEN_OWNER_PASSWORD
docker compose exec -T -e ISSOPEN_OWNER_EMAIL -e ISSOPEN_OWNER_PASSWORD app \
  node dist/runtime/scripts/owner.js recover
unset ISSOPEN_OWNER_EMAIL ISSOPEN_OWNER_PASSWORD
```

The command intentionally does not reveal whether an arbitrary email exists.

## Agent and MCP operation

Open **Agents** in the authenticated web UI to create a separate Codex
identity. Select at least one project and the minimum scopes it needs. The
default scopes allow read, creation, blocking questions, claim/release, field
updates, progress comments, code links and return to Ready for Review;
`issues:close` is
intentionally off. Copy the PAT from the
one-time screen into the external agent's secret store, never a repository
file or command argument. Revocation is immediate and existing activity keeps
the agent attribution.

An active identity has an **Edit permissions** action. It can retain a strict
subset of its current projects and scopes; it cannot expand an existing grant.
The reduced allowlist is read from PostgreSQL on the next MCP request, including
requests made by an already-open client. Create a separate grant when broader
access is required. The Agents page shows PAT or OAuth type, expiry, last use
and revoked state without returning a PAT, token hash, OAuth token or cookie.

**Revoke access** is identity-wide and immediate. For PAT agents it revokes the
credential and identity. For OAuth agents it also revokes stored access and
refresh tokens and removes consent, while append-only issue activity keeps the
original agent ID and display-name snapshot. OAuth clients may request
`offline_access` so refresh remains possible only until the owner revokes the
grant.

Remote MCP is served only at `POST /mcp`; `GET` and `DELETE` return `405`. The
fixed tool set is:

- `list_projects`, `list_issues`, `list_activity`, `get_issue` —
  `issues:read`;
- `create_issue` — `issues:create`, always creates in Backlog, requires an
  allowed project and may assign an Epic from that same project;
- `ask_question` — `questions:write`; adds a recommendation, 2–6 options and
  the implicit `Other` answer to an allowed issue. Agents cannot answer;
- `add_comment` — `comments:write`; appends an attributed progress, checkpoint
  or blocker comment to an allowed issue;
- `claim_issue`, `release_issue` — `issues:claim`;
- `update_issue` — `issues:write`; can assign or clear a same-project Epic;
- `link_code_result` — `code:link`;
- `move_issue` — `issues:review`, plus `issues:close` only for `Done`.

The three list tools use response schema version `1`, return at most 50 items
by default and accept `limit` from 1 through 100. Their `page.nextCursor` is an
opaque keyset cursor; send it back only to the same tool with the same filters.
Changing a filter or reusing a cursor from another tool is rejected. Project
pages are ordered by creation time, key and ID; issue pages by project ID,
number and ID; activity pages by creation time and ID. `list_issues` accepts
`projectId`, `epicId`, `status`, `priority` and `claim` (`any`, `claimed`,
`unclaimed` or `mine`). `get_issue` includes the current Epic when the ticket
is grouped. All queries validate the Epic against the authenticated project
allowlist before cursoring.

List responses are deliberately compact: projects omit descriptions and
repository configuration, issues omit descriptions, and activity omits the
unbounded `changes` payload. Use `get_issue` for the authorized detailed issue
package. Existing clients may keep calling `list_projects` or `list_issues`
with `{}`; they now receive the first bounded page and must follow
`page.nextCursor` when `page.hasMore` is true.

Every mutable tool requires an `idempotencyKey` (1–128 characters using
letters, numbers, `.`, `_`, `:`, or `-`). Reuse the same key only for an exact
retry of the same logical tool call: for 24 hours Issopen returns the original
response without repeating the mutation or its activity event. The key is
scoped to workspace, agent identity and tool; reusing it with a different
normalized payload returns a conflict. Concurrent identical calls are
serialized in PostgreSQL. Stored records contain only the payload hash and the
product response—never OAuth tokens, PATs or request headers.

Comments are append-only and returned as part of `get_issue`. Their author,
origin and timestamp are derived by the server. The web renders their body as
plain untrusted text; the first version has no edit, delete, mention or
notification behavior.

The **Connect ChatGPT** page displays the canonical MCP URL derived from
`ISSOPEN_BASE_URL`. A real ChatGPT Work connection additionally requires an
operator-approved, reachable HTTPS origin. After adding its `/mcp` URL as a
personal connector, sign in as the owner, review the displayed scopes and
approve or deny consent. Issopen does not claim that connection is validated
until ChatGPT has completed OAuth and invoked a tool. Do not create DNS,
Cloudflare records or tunnels merely to satisfy this step without explicit
operator authorization.

## Deterministic dogfood

The dogfood command creates or reuses project `ISS` and one real improvement
ticket, then drives it through owner prioritization, a separate scoped Codex
claim, update, code-result link, Ready for Review, request changes and final
owner acceptance. It talks only to Issopen REST and MCP. It never reads or
writes a Git checkout, starts CI, merges or deploys anything.

Supply the existing owner credential and a real non-secret branch, commit or
pull-request URL only through the command process:

```bash
read -r -p "Owner email: " ISSOPEN_OWNER_EMAIL
read -r -s -p "Owner password: " ISSOPEN_OWNER_PASSWORD
printf '\n'
read -r -p "Code result URL: " ISSOPEN_DOGFOOD_CODE_URL
ISSOPEN_BASE_URL=${ISSOPEN_BASE_URL:-http://localhost:8080}
export ISSOPEN_BASE_URL ISSOPEN_OWNER_EMAIL ISSOPEN_OWNER_PASSWORD \
  ISSOPEN_DOGFOOD_CODE_URL
pnpm dogfood
unset ISSOPEN_OWNER_EMAIL ISSOPEN_OWNER_PASSWORD ISSOPEN_DOGFOOD_CODE_URL
```

Set `ISSOPEN_DOGFOOD_CODE_TYPE` to `branch`, `commit` (the default) or
`pull_request` when needed. The PAT exists only in process memory, is revoked
at the end, and is never printed. A successful repeat returns the same
completed issue without duplicating work.

## Operate and restart

```bash
docker compose ps
curl --fail --silent http://localhost:8080/health/ready
docker compose restart app
docker compose stop
docker compose start
```

The named volume `issopen_postgres` keeps owner, workspace and session data
across ordinary stop/start and container recreation. `docker compose down`
keeps the volume; adding `--volumes` permanently removes local Issopen data and
is not part of the normal procedure.

Migrations run before the server on every container start. A failed migration
stops startup instead of serving against an unknown schema.

## Production GitOps deployment

The production contract lives in `../../homelab/apps/issopen/`. Argo CD
discovers its `deploy/argocd.yaml` and renders `deploy/manifests`. The
application and PostgreSQL singleton are pinned to the observed always-on
master `debian13-torre-nya`. The public path is Cloudflare DNS → Caddy → the
existing restricted SSH tunnel → Traefik → Service → Issopen. Kubernetes does
not terminate public TLS.

The application image verified on 2026-09-08 is immutable. The current desired
revision is recorded in `../../homelab/apps/issopen/app.yaml` and must be
compared with Argo CD when checking a later release:

```text
registry.serviciosegado.com/issopen:favicon-white-5e2debd@sha256:e94cd0b09ee2d961584ceb7b30151c3c5f621f4dd8486815498fcf1af2e66902
```

The forest and mint identity was deployed on 2026-09-08 from source
`2b0bb5a78b0e6847a3e1a694225db4371b86c671`, through GitOps commit
`a1956385752a38bc8261ee9b4d6d5b27bfa7d299`. See the
[release verification](.planning/quick/260908-ja5-desplegar-la-identidad-bosque-y-menta-de/260908-ja5-SUMMARY.md).
The white-background favicon correction (`5e2debd`, GitOps `4527b882`) is the
image shown above. It includes the plain ticket/Epic labels from `aa52179` and
preserves the transparent header logo and touch icon. See its
[production verification](.planning/quick/260908-kiy-a-adir-fondo-blanco-al-favicon-de-issope/260908-kiy-SUMMARY.md).

Three Secrets exist outside Git in namespace `issopen`:

- `issopen-env` supplies `BETTER_AUTH_SECRET` and, when Google login is
  enabled, `GOOGLE_CLIENT_ID` plus `GOOGLE_CLIENT_SECRET`;
- `issopen-postgres-env` supplies `POSTGRES_PASSWORD` to both processes;
- `registry-serviciosegado` supplies the private registry pull credential.

The recoverable local source for the first two is the ignored, mode-`0600`
file `.local/secrets/issopen-production.env` at the monorepo root. Create it
without printing values, then provision the missing infrastructure Secrets and
reconcile `issopen-env` when the Google pair is present:

```bash
umask 077
secret_file=../../.local/secrets/issopen-production.env
test ! -e "$secret_file"
mkdir -p "$(dirname "$secret_file")"
{
  printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'BETTER_AUTH_SECRET=%s\n' "$(openssl rand -hex 32)"
  printf 'GOOGLE_CLIENT_ID=\n'
  printf 'GOOGLE_CLIENT_SECRET=\n'
} >"$secret_file"
chmod 600 "$secret_file"
KUBECONFIG=../../.local/secrets/kubeconfig-home.yaml \
  scripts/provision-production-secrets.sh
```

The provisioner refuses a missing or permissive source and never prints values.
It leaves an existing `issopen-env` unchanged when Google is omitted; when the
Google pair is present it reconciles that Secret so credentials can be enabled
or rotated. PostgreSQL and registry Secrets remain create-only. Preserve the
source file in the operator's approved secret backup before rotating or
rebuilding the namespace.

Read-only production checks from the monorepo root are:

```bash
KUBECONFIG=.local/secrets/kubeconfig-home.yaml \
  kubectl -n argocd get application issopen
KUBECONFIG=.local/secrets/kubeconfig-home.yaml \
  kubectl -n issopen get deploy,statefulset,pod,svc,ingress,pvc,endpointslice
curl --fail --silent https://issopen.serviciosegado.com/health/ready
```

The PostgreSQL claim is `local-path`, requests 5 GiB and uses StatefulSet PVC
retention `Retain` for deletion and scale-down. It is intentionally tied to
the always-on master and is not highly available. Phase 1 has no scheduled DB
backup/restore automation; do not treat this validation instance as a durable
release until that later operational gate is complete.

## Host-side development and validation

Use synthetic test credentials only; no real ChatGPT, Git, Cloudflare or owner
credential is required.

```bash
corepack pnpm@11.22.0 install --frozen-lockfile
pnpm validate
```

`pnpm validate` runs lint, typecheck, unit/UI tests, PostgreSQL integration,
the production build, desktop/mobile Playwright acceptance, the deterministic
dogfood and a repository-content secret scan.

Compose configuration requires the two generated values in `.env`:

```bash
docker compose config --quiet
pnpm test:compose
```

From the monorepo root, also run:

```bash
make validate
```

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | yes | Local PostgreSQL credential; generated into ignored `.env` |
| `BETTER_AUTH_SECRET` | yes | Session signing secret, at least 32 characters |
| `GOOGLE_CLIENT_ID` | pair | Google OIDC web client ID; set with `GOOGLE_CLIENT_SECRET` |
| `GOOGLE_CLIENT_SECRET` | pair | Server-only Google OIDC secret; never expose to web/extension |
| `POSTGRES_USER` | no | Local database user; default `issopen` |
| `POSTGRES_DB` | no | Local database name; default `issopen` |
| `ISSOPEN_PORT` | no | Loopback host port; default `8080` |
| `ISSOPEN_BASE_URL` | no | Exact browser origin; default `http://localhost:8080` |
| `ISSOPEN_TRUSTED_ORIGINS` | no | Additional comma-separated exact origins |
| `NODE_ENV` | no | `development` for local HTTP; production requires HTTPS |
| `ISSOPEN_OWNER_EMAIL` | command only | Owner bootstrap/recovery email |
| `ISSOPEN_OWNER_PASSWORD` | command only | Owner bootstrap/recovery password |
| `ISSOPEN_OWNER_NAME` | command only | Optional display name; default `Owner` |
| `ISSOPEN_DOGFOOD_CODE_URL` | command only | Existing non-secret branch, commit or PR URL linked by dogfood |
| `ISSOPEN_DOGFOOD_CODE_TYPE` | no | `branch`, `commit` or `pull_request`; default `commit` |

Never commit `.env`, the ignored production Secret source, owner credentials,
cookies, tokens, connection strings or command output containing them.
Google setup, exact callbacks, verification and rollback are documented in
[Google OpenID Connect](docs/google-oauth.md).

## Local rollback and reset

- To roll back application code, check out or revert the desired repository
  revision and rebuild the local image with `docker compose up --build --wait`.
- Database migrations are forward-only in this MVP. There is no documented
  production restore procedure yet, so do not claim a database rollback.
- `docker compose down` removes containers and the network but keeps the named
  PostgreSQL volume. `docker compose down --volumes` is a destructive local
  reset and permanently deletes the instance data; it is never part of normal
  rollback.
- Owner recovery rotates the credential and revokes sessions; agent recovery
  is revocation followed by creation of a new identity/PAT.

## Production rollback

- Revert the GitOps application commit on Forgejo `main` to stop or restore the
  workload declaratively; never delete the PVC as rollback.
- Restore the previous application digest in `deployment.yaml` for a binary
  rollback. Database migrations are forward-only, so a binary rollback is
  valid only while that revision remains schema-compatible.
- After `0011_epic_numbers`, do not roll back to a binary that inserts Epics
  without a number: the new column is required. Keep the numbering support in
  a forward fix, or plan a separately approved database restore. Take a private
  PostgreSQL backup before promoting this migration.
- Migration `0016_milky_songbird` is additive and leaves existing Epics active.
  A binary older than Epic archiving ignores `archived_at` and would display
  archived Epics as active again. Restore archived Epics before such a rollback
  or prefer a forward fix; never remove the column as an application rollback.
- Caddy and Cloudflare roll back separately. Remove the exact Caddy host block
  with the edge playbook; use only the mode-`0600` JSON created by the
  Cloudflare helper for an explicitly authorized DNS rollback.
- The retained local-path claim preserves data across StatefulSet replacement,
  but it is not a database backup.

## Current limitations

- On 2026-08-31 the GitOps application was `Synced/Healthy`, both workloads were
  Ready on `debian13-torre-nya`, public DNS resolved to the existing edge, and
  Let's Encrypt TLS, readiness, OAuth discovery and the unauthenticated MCP
  challenge were verified at `https://issopen.serviciosegado.com`.
- Real ChatGPT Work acceptance is still pending. Phase 1 cannot close until the
  owner completes OAuth, invokes a tool and verifies revocation from ChatGPT.
- Owner bootstrap has completed. Recovery remains an interactive operator
  action, and no owner password may be stored in Git or Kubernetes.
- The Phase 1 backup/restore, upgrade, multi-user and public release procedures
  are intentionally not yet implemented.
