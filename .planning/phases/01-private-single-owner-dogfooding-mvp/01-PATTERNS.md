# Phase 1 Pattern Map

**Mapped:** 2026-08-31

## Closest repository analogues

Issopen has no existing Hono/Better Auth application to copy. Use these
monorepo patterns only at their proven boundaries:

| Issopen concern | Closest analogue | Pattern to reuse | Do not copy |
| --- | --- | --- | --- |
| Local full stack | `apps/baby-monitor/compose.yml` | app + healthy PostgreSQL, named data volume, build target, restart policy | Mailpit, MinIO, weak development secret defaults |
| Production image | `apps/baby-monitor/Dockerfile` | multi-stage dependency/build/runtime image, non-root user, init process, HTTP healthcheck | Next.js-specific standalone layout |
| Quality commands | `apps/baby-monitor/package.json` | explicit lint, typecheck, unit, build, Docker config and Playwright scripts | unpinned dependency ranges and unrelated PWA tooling |
| Responsive acceptance | `apps/baby-monitor/playwright.config.ts` | isolated base URL, desktop/mobile projects, web-server lifecycle | tests that require real family or health data |
| Simple MCP precedent | `apps/digestivo/package.json` and its server | MCP lives beside the application and shares domain data | legacy MCP SDK v1 and unauthenticated/local assumptions |
| App operations | `apps/*/AGENTS.md`, `app.yaml`, `deploy/values.yaml` | code, commands, ports, secret names, health and lifecycle documented together | claiming cutover or ingress before a real image/domain exists |

## Phase-local structure

Keep Issopen as one logical app and one Node package:

```text
apps/issopen/
  src/server/{auth,db,domain,http,mcp}/
  src/web/{components,routes}/
  drizzle/
  tests/{unit,integration,e2e}/
  scripts/
  Dockerfile
  compose.yml
```

This matches the repository's mini-repository rule while avoiding an internal
workspace or `packages/` split before multiple independent artifacts exist.
Product logic must be shared through server services, not duplicated between
REST and MCP handlers.

## Operational conventions

- Bind the container to port `8080`; publish a configurable loopback/local port
  in Compose.
- Make PostgreSQL health a dependency of migration/application startup and use
  a named volume for repeatable restarts.
- Keep `.env.example` safe and complete by variable name; ignore `.env` and all
  generated credentials.
- Run migrations explicitly in the container entrypoint before the non-root
  server starts. A migration failure must stop startup.
- Provide separate `/health/live` and `/health/ready` responses with no account,
  database host or configuration details.
- Keep `app.yaml` exposure disabled and `deploy/values.yaml` non-operational
  until an immutable image and environment configuration exist.
- Integrate the app's static checks into the root validation only after they
  are reproducible from a clean checkout.

## Testing conventions

- Vitest covers pure services and HTTP contracts; PostgreSQL integration tests
  use a dedicated database.
- Playwright owns the real browser flow and at least one mobile viewport.
- Compose validation is syntax-only in the fast root gate; startup and restart
  are phase verification evidence.
- Test fixtures use synthetic names and credentials and never print bearer
  tokens or passwords.

## PATTERNS COMPLETE
