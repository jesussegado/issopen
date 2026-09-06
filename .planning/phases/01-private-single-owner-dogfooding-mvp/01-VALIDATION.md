# Phase 1 Validation Strategy

**Phase:** 01 — Private Single-Owner Dogfooding MVP  
**Status:** planned

## Acceptance matrix

| Boundary | Automated evidence | Manual/external evidence |
| --- | --- | --- |
| Compose/bootstrap | Clean start, idempotent restart, PostgreSQL persistence and concurrent singleton tests | Operator confirms URL and owner bootstrap without secrets in output |
| Private web/API | Anonymous denial and authenticated CRUD integration tests | Keyboard and mobile-width browser walkthrough |
| Tracker/activity | Project, issue, state, review and transaction tests | Owner verifies useful chronology in dogfood issue |
| Agent identity | Hash-only storage, allowlist, scope, expiry, last-use and revocation tests | One-time token copy/revoke walkthrough |
| MCP | Protocol initialize/tool tests over PAT and test OAuth access token | Codex uses a separate credential on the dogfood issue |
| ChatGPT OAuth | Discovery, consent, PKCE, audience, expiry and replay tests | ChatGPT Work connects to an operator-approved HTTPS endpoint |
| Security | Negative authorization suite and log/response secret scans | Review confirms no hostname, token or credential entered in Git |

## Fast feedback

Run on each implementation task:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Run once the complete vertical slice exists:

```bash
pnpm build
pnpm test:integration
pnpm test:e2e
docker compose config --quiet
```

Run from the monorepo root before closing the phase:

```bash
make validate
```

## Test data and isolation

- Unit tests use deterministic factories and never persist secrets.
- PostgreSQL integration tests use a dedicated database and reset only their
  own schema between runs.
- Authentication tests use synthetic owner/OAuth/PAT credentials supplied by
  the test process, never the operator's local credentials.
- Browser tests run against a seeded private instance and cover desktop and
  mobile viewports.
- External ChatGPT evidence contains identifiers and outcomes only; access
  tokens, codes, verifier values and cookies are excluded.

## Security gates

The phase is blocked if any HIGH threat in `01-RESEARCH.md` lacks both a server
mitigation and a negative test. In particular, completion requires proof that:

1. anonymous callers cannot read tracker or MCP data;
2. a second owner cannot be bootstrapped;
3. an agent cannot infer or mutate a project outside its allowlist;
4. the default Codex token cannot move an issue to `Done`;
5. request bodies cannot forge activity actor, source, time or summaries;
6. PAT and OAuth secrets do not appear in storage, URLs, logs or later API
   responses.

## External checkpoint

The only non-automatable Phase 1 gate is the real ChatGPT Work connection. It
must wait for the operator to supply and authorize a reachable HTTPS URL.
Failure or absence of that external endpoint does not justify inventing DNS or
mutating Cloudflare; it must be reported explicitly as the remaining gate.
