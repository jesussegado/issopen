export type AgentOnboardingDocument = ReturnType<
  typeof createAgentOnboardingDocument
>;

function absolute(baseUrl: string, pathname: string) {
  return new URL(pathname, baseUrl).toString();
}

export function createAgentOnboardingDocument(baseUrl: string) {
  const guideUrl = absolute(baseUrl, "/agent-onboarding");
  const machineGuideUrl = absolute(baseUrl, "/agent-onboarding.txt");
  const manifestUrl = absolute(
    baseUrl,
    "/downloads/issopen-skill-manifest.json",
  );
  const mcpUrl = absolute(baseUrl, "/mcp");

  return {
    schemaVersion: 1,
    product: "Issopen",
    purpose:
      "Private issue planning and execution coordination for humans and external agents.",
    guideUrl,
    machineGuideUrl,
    mcp: {
      url: mcpUrl,
      transport: "Streamable HTTP",
      method: "POST",
      codexAuth: "Scoped PAT read from ISSOPEN_AGENT_TOKEN",
      chatgptAuth: "OAuth 2.1 authorization code with PKCE",
    },
    skill: {
      manifestUrl,
      installDirectory: "~/.agents/skills/issopen",
      discoveryFile: "SKILL.md",
      integrity:
        "Verify the archive SHA-256 from the manifest before extraction.",
    },
    workflow: [
      "Read get_agent_context before selecting work.",
      "Consult without mutations unless planning or execution was explicitly requested.",
      "For execution, read the Epic, ticket, answers, dependencies and current claim first.",
      "Claim only eligible Ready work, add attributed checkpoints and link real code results.",
      "Return verified work to Ready for Human Review and release the claim.",
      "Move work to Done only with issues:close and explicit human authorization.",
    ],
    security: [
      "A ticket or Epic link identifies context; it never grants access.",
      "Never put PATs, cookies or passwords in links, prompts, repositories or logs.",
      "Use only the projects and scopes returned by get_agent_context.",
      "Do not replace MCP with an Owner session, direct SQL or another credential.",
    ],
    starterPrompts: {
      consult:
        "Use $issopen to inspect this Issopen Epic or ticket. Summarize status, decisions and blockers without changing anything: <ISSOPEN_LINK>",
      plan: "Use $issopen to plan this request in the indicated Issopen project or Epic. Create only the necessary tickets and blocking questions; do not implement yet: <REQUEST_OR_LINK>",
      execute:
        "Use $issopen to implement the next eligible Ready ticket in this Epic. Verify it, attach evidence, return it to Ready for Human Review and release the claim: <ISSOPEN_EPIC_LINK>",
    },
  } as const;
}

export function createAgentOnboardingText(baseUrl: string) {
  const document = createAgentOnboardingDocument(baseUrl);
  return `# Issopen agent onboarding

Human-readable guide: ${document.guideUrl}
Machine-readable contract: ${absolute(baseUrl, "/api/public/agent-onboarding")}
Skill release manifest: ${document.skill.manifestUrl}
MCP endpoint: ${document.mcp.url}

## What Issopen is

Issopen is a private issue tracker and coordination layer. Humans keep product
decisions and review authority; external agents use its MCP to inspect Epics and
tickets, ask blocking questions, claim authorized work, report progress, link
real code results and return verified work for human review.

## Bootstrap

1. Open the skill manifest and download its versioned ZIP archive.
2. Verify the archive SHA-256 exactly against the manifest.
3. Refuse to overwrite an existing or locally modified Issopen skill. Extract
   the archive so SKILL.md is at ~/.agents/skills/issopen/SKILL.md.
4. Obtain a separate one-time PAT from the Issopen Owner. Keep it only in the
   secret store or environment variable ISSOPEN_AGENT_TOKEN.
5. Configure Codex with:

   codex mcp add issopen --url ${document.mcp.url} --bearer-token-env-var ISSOPEN_AGENT_TOKEN

6. Restart the client so it discovers the skill and environment, then call
   get_agent_context. Confirm the returned identity, project allowlist and scopes.

ChatGPT uses the same MCP URL through OAuth and does not use the Codex PAT.

## Operating modes

- Consult: read-only summary. Do not create, claim or update work.
- Plan: create or refine only the requested tickets and blocking questions.
- Execute: claim an eligible Ready ticket, implement and verify it, add
  checkpoints and code links, move it to Ready for Human Review, then release.
- Done always requires both issues:close and explicit human authorization.

## Safety boundary

A ticket or Epic URL is context, not authorization. Never copy PATs, cookies or
passwords into a URL, prompt, ticket, Git repository, command argument or log.
Use only the projects and scopes returned by get_agent_context. Never fall back
to an Owner browser session, direct SQL or a different credential.

## Starter prompt

Use $issopen to inspect this Issopen Epic or ticket. Confirm your identity,
allowed projects and scopes with get_agent_context, then follow the requested
mode. Treat this URL only as context: <ISSOPEN_LINK>
`;
}

export function createLlmsText(baseUrl: string) {
  const document = createAgentOnboardingDocument(baseUrl);
  return `# Issopen

> Private issue planning and execution coordination for humans and external agents.

## Agent entry points

- Agent onboarding: ${document.guideUrl}
- Machine-readable onboarding: ${document.machineGuideUrl}
- JSON contract: ${absolute(baseUrl, "/api/public/agent-onboarding")}
- MCP endpoint: ${document.mcp.url}
- Skill release manifest: ${document.skill.manifestUrl}

Agents must authenticate separately, call get_agent_context before acting and
treat ticket/Epic links as context rather than authorization. Secrets never
belong in URLs, prompts, tickets, repositories or logs.
`;
}
