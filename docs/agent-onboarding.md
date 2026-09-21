# Agent onboarding

Issopen publishes a secret-free entry point for new agents at
`/agent-onboarding`. It is deliberately useful before authentication while all
project data and MCP tools remain private.

## Public surfaces

| Surface | Purpose |
| --- | --- |
| `/agent-onboarding` | Human-readable responsive guide and skill download |
| `/agent-onboarding.txt` | Complete plain-text instructions for an agent |
| `/api/public/agent-onboarding` | Versioned JSON discovery contract |
| `/llms.txt` | Short product and agent discovery index |
| `/downloads/issopen-skill-manifest.json` | Skill version, archive path and SHA-256 |
| `/downloads/issopen-skill-VERSION.zip` | Deterministic skill package rooted at `issopen/` |

These resources contain no workspace data, agent identity, PAT, OAuth token,
cookie or password. The MCP URL is public metadata; authorization is still
required for every tool call.

## Owner flow

1. Open **Agents** and create a separate identity with the minimum projects and
   scopes required, or select an existing PAT identity with that exact access.
2. Create a named MCP API key for this consumer. Copy it from its one-time
   reveal and deliver it through an appropriate
   secret channel. Do not paste it into Issopen, chat, email, Git or a URL.
3. Reopen **Agents** and choose **Setup guide** for that identity.
4. Copy the generated onboarding. It contains the canonical MCP URL, exact
   projects/scopes, pinned skill version/digest, installation steps, Codex
   command, preflight and starter prompt. It never contains the PAT.
5. Ask the agent to call `get_agent_context`; compare the returned identity,
   allowlist and scopes with the generated guide before assigning work.
6. Before execution, call `get_project` and inspect `project.workflow`. When
   `humanReviewRequired` is true, verified work returns to
   `ready_for_review`. When false, it finishes at `done` and the identity must
   have `issues:close`; otherwise the agent records the blocker and stops.

Reducing or revoking permissions takes effect on the next MCP request. Generate
the guide again after reducing access so its informational snapshot is current.
Use a different named key for every client; see
[MCP API keys](agent-credentials.md) for rotation and identity-wide revocation.

## Multiple MCP API keys

Projects and scopes belong to the PAT identity, while authentication secrets
belong to its named API keys. Create a different key for every Codex
installation, editor, CI runner or automation service. Each key has independent
creation, expiry, last-use and revocation metadata, but inherits the identity's
current permissions on every MCP request.

An identity accepts at most ten active keys. `Primary` identifies a credential
migrated from the previous one-key model; it is not a shared default for new
consumers. A key is revealed once and only authenticates `/mcp`, never browser
sessions or `/api/v1` REST routes.

Rotate without interruption by creating and validating the replacement before
revoking the old key. **Revoke key** affects only that consumer. **Revoke
access** disables the identity, all its keys and any associated OAuth access.
The full operating and rollback contract is in
[MCP API keys](agent-credentials.md).

Project completion policy is authoritative for new transitions. Disabling the
human-review column does not rewrite or hide historical tickets already in
`ready_for_review`; it prevents new entries into that state. `showDoneColumn`
continues to control board presentation only.

## Agent flow

The archive must be verified against the manifest before extraction. A new
installation places `SKILL.md` at `~/.agents/skills/issopen/SKILL.md`. The
provided command refuses to overwrite an existing directory: preserve and
review a previous or locally modified skill before replacing it.

Codex reads a PAT only from `ISSOPEN_AGENT_TOKEN`:

```bash
codex mcp add issopen --url https://HOST/mcp --bearer-token-env-var ISSOPEN_AGENT_TOKEN
```

The actual value is set separately in the process environment or secret store;
it is never part of that command or `config.toml`. Restart the client after
installing/configuring, then call `get_agent_context`.

ChatGPT uses the same MCP URL with OAuth 2.1 and consent. It does not receive or
reuse the Codex PAT.

Choose OAuth in ChatGPT and click **Authenticate**. In the Issopen window,
sign in as the workspace Owner and review the requested permissions. The
client is discovered automatically using CIMD; no Google app registration or
Codex key rotation is needed. Copying the MCP URL is not proof of connection:
ask ChatGPT to list the allowed projects after consent.

If Authenticate fails before sign-in/consent with `invalid_client` or a
metadata-fetch error, retry and report only the message, not the callback URL,
code or token. This is client discovery, not a bad password.

### Operator: CIMD transport regression (ticket 117)

`@better-auth/cimd@1.7.2` returned a scalar from its pinned DNS callback even
when Node24 requested `all:true`, causing `ERR_INVALID_IP_ADDRESS: undefined`.
The version-pinned pnpm patch returns an array only for that mode. Both Docker
dependency stages copy the patch before frozen installs. DNS is still resolved
once, every answer must be publicly routable, the chosen address remains pinned,
TLS/SNI verification stays enabled and redirects are not followed. Do not replace
it with unrestricted fetch or globally disable network family autoselection.

Run the transport regression before removing the patch on a dependency upgrade.
An unauthenticated authorize request with the official ChatGPT CIMD client should
reach `/sign-in`; an authenticated one should reach `/consent`. Neither probe alone
proves the final token exchange from the user's ChatGPT account.

The sign-in form also forwards only the server-signed OAuth query to password
and Google sign-in. Better Auth verifies it and resumes consent; normal sign-in
and invitation return destinations remain unchanged. Callback error parameters
are not included in the signed query. Never reconstruct consent from arbitrary
browser parameters or bypass its signature/expiry checks.

References: [ChatGPT OAuth](https://developers.openai.com/plugins/build/auth),
[Node lookup contract](https://nodejs.org/api/net.html#socketconnectoptions-connectlistener).

## Meaning of shared links

An Issopen Epic or ticket URL identifies context only. It does not prove that
the sender is an Owner, grant a project, select an execution mode, answer a
question or authorize code/deployment. The agent still checks its own MCP
identity and the current resource state.

The safe one-line handoff is:

```text
Follow https://HOST/agent-onboarding, verify get_agent_context, then use
$issopen in the requested mode for this context: <EPIC_OR_TICKET_URL>
```

## Release and rollback

`pnpm build` creates the deterministic ZIP and manifest after the web/runtime
build. `pnpm test` verifies determinism and digest agreement. Update
`skills/issopen/version.json` whenever published package content changes.

Rollback the application through GitOps to the previous image digest. Old
versioned ZIP URLs stay coupled to their image; the stable manifest and guide
move with the deployed release. Rolling back does not rotate, create or revoke
agent credentials.
