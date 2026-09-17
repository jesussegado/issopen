---
status: verifying
trigger: "el error que da es al hacer authenticate"
created: 2026-09-17T20:27:00Z
updated: 2026-09-17T20:36:00Z
---

## Symptoms

Expected: Authenticate opens Issopen login/consent and connects ChatGPT MCP.
Actual: user cannot complete Authenticate; production reproduction returns400
invalid_client, Failed to fetch metadata document. First occurrence unknown.
Reproduction: authorize with ChatGPT's public CIMD client ID, callback, PKCE S256
and canonical /mcp resource. No user secret needed to reproduce.

## Current Focus

hypothesis: confirmed dependency lookup-shape mismatch, plus missing signed
OAuth context on web sign-in. No separate debugger: continuing inline under
the skill's no-automatic-spawn fallback, with symptoms already supplied/reproduced.
next_action: complete gates and GitOps release, then production authorize smoke.
tdd_checkpoint: transport test failed on scalar vs array before patch; eight
transport tests and signed-login/CIMD token-exchange regression now pass.

## Evidence

- Public discovery200 and anonymous MCP401 with valid OAuth challenge.
- Pod native fetch to ChatGPT metadata200, CIMD transport throws
  ERR_INVALID_IP_ADDRESS undefined at its lookup callback.
- Node24 requests all:true; package1.7.2 callback always returns scalar/family.
- Patched frozen dependency returns [pinnedAddress] only for all:true. Actual
  ChatGPT metadata fetch200 locally after patch.
- SignInRoute previously omitted oauth_query and always navigated to board.
- Synthetic CIMD client (metadata transport mocked) reaches signed login,
  consent, issuer-bound callback, private_key_jwt/PKCE exchange and MCP read.
- Eight transport tests preserve public-only addresses, pinning, HTTPS, no
  redirects, TLS defaults and abort propagation; web tests cover both login methods.

## Eliminated

- Wrong password/session: first error reproduced anonymously before login.
- Network outage: same pod fetches metadata successfully with native fetch.
- Missing DCR: CIMD intentionally advertised; no public DCR is required.

## Resolution

root_cause: dependency incompatibility plus lost login continuation.
fix: version-pinned pnpm patch packaged in both Docker stages; web sends signed
query to backend and follows successful server continuation; onboarding aligned.
verification: local regressions pass; full gates/deployment pending.
scope: ticket117, no database migration or credential/permission changes.
tooling: gsd-sdk is not installed in this shell; STATE/config and the debug
record are maintained directly as the documented fallback, without rerunning
initialization or spawning agents.
