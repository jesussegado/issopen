# MCP API keys

Each PAT agent identity can have several named API keys. This lets every Codex
session, editor and automation service use its own secret without duplicating
the identity's project allowlist or scopes.

## Security contract

- Keys authenticate only `POST /mcp`. They do not authorize `/api/v1` REST
  routes, browser sessions or administrative actions.
- Every key resolves to one `agent_identity`; effective scopes and allowed
  projects are read from PostgreSQL on every MCP request.
- The token is revealed exactly once. PostgreSQL stores its Argon2id hash and a
  non-secret fingerprint, never the plaintext token.
- Labels are unique within an identity, case-insensitively. An identity can
  have at most ten active, unexpired keys.
- Expiry and last-use timestamps belong to each key. Revocation takes effect on
  the next request and does not erase historical attribution.
- OAuth identities do not use these keys. ChatGPT continues to authenticate
  through OAuth 2.1.

## Provision a service

1. Sign in as the workspace Owner and open **Agents**.
2. Create or select a PAT identity with the minimum projects and scopes.
3. Under **MCP API keys**, choose **Create API key**.
4. Use a recognizable label such as `VS Code laptop`, `CI runner` or
   `Codex audit session`, and choose an expiry.
5. Copy the one-time value into that client's secret store. Do not put it in a
   repository, ticket, URL, command argument or Issopen onboarding text.
6. Configure the client to read the value from `ISSOPEN_AGENT_TOKEN`, restart
   it and verify `get_agent_context` before assigning work.

Use one key per consumer. Sharing a key makes its `last used` timestamp and
revocation blast radius ambiguous.

## Rotation and revocation

For rotation, create the replacement key first, configure and verify the
consumer, then revoke only the old key. Other keys remain usable. **Revoke
access** is intentionally different: it disables the whole identity and all of
its keys immediately.

Expired and revoked rows remain as safe metadata so an Owner can understand
which integration existed. Their secrets cannot be recovered or reactivated;
create a new key instead.

## Migration and rollback

Migration `0032` labels every pre-existing credential `Primary`, removes the
one-key uniqueness constraint and adds the case-insensitive identity/label
constraint. It never rewrites `token_hash`, `fingerprint`, expiry or last-use,
so an existing MCP token keeps working after rollout.

Before rollback, revoke any keys created after the rollout and retain at most
one credential per PAT identity. Rolling back application code without first
restoring that invariant is unsupported because the previous schema accepts
only one row per identity. A normal GitOps rollout must preserve both the
PostgreSQL and attachment PVCs.
