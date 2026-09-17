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

Reducing or revoking permissions takes effect on the next MCP request. Generate
the guide again after reducing access so its informational snapshot is current.
Use a different named key for every client; see
[MCP API keys](agent-credentials.md) for rotation and identity-wide revocation.

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
