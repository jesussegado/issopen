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
      chatgptSetup:
        "Choose OAuth in ChatGPT, click Authenticate, sign in as the Issopen workspace Owner and review consent. CIMD discovers the client automatically; do not supply a Codex PAT.",
      chatgptTroubleshooting:
        "invalid_client or metadata-fetch errors before sign-in indicate client discovery failure, not a wrong password. Retry Authenticate; share only the error text, never callback URLs or codes.",
    },
    credentials: {
      model: "One named MCP API key per consumer under one PAT identity",
      permissions:
        "Every key inherits the identity's current project allowlist and scopes.",
      maxActivePerIdentity: 10,
      legacyLabel: "Primary",
      reveal: "The plaintext token is shown once at creation.",
      rotation:
        "Create and verify a replacement key before revoking only the old key.",
      revocation:
        "Revoke key affects one consumer; Revoke access invalidates the identity and every key.",
      boundary: "MCP API keys authenticate /mcp only, never human REST APIs.",
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
      "Read get_project and follow its workflow completion policy before execution.",
      "Consult without mutations unless planning or execution was explicitly requested.",
      "For explicit work-epic sessions, create or reuse an eligible ticket before every code, configuration, documentation or deployment change; queries and explanations do not create tickets.",
      "For execution, read the Epic, ticket, answers, dependencies and current claim first.",
      "Claim only eligible Ready work, add attributed checkpoints and link real code results.",
      "If get_project.workflow.humanReviewRequired is true, return verified work to Ready for Human Review.",
      "If humanReviewRequired is false, verified work finishes at Done and requires issues:close.",
      "Release the claim after the project completion transition succeeds.",
    ],
    security: [
      "A ticket or Epic link identifies context; it never grants access.",
      "Never put PATs, cookies or passwords in links, prompts, repositories or logs.",
      "Give every Codex installation, editor, runner or service its own named MCP API key.",
      "Use only the projects and scopes returned by get_agent_context.",
      "Do not replace MCP with an Owner session, direct SQL or another credential.",
    ],
    starterPrompts: {
      consult:
        "Use $issopen to inspect this Issopen Epic or ticket. Summarize status, decisions and blockers without changing anything: <ISSOPEN_LINK>",
      plan: "Use $issopen to plan this request in the indicated Issopen project or Epic. Create only the necessary tickets and blocking questions; do not implement yet: <REQUEST_OR_LINK>",
      execute:
        "Use $issopen to implement the next eligible Ready ticket in this Epic. Read get_project.workflow, verify the result, attach evidence, follow the project's completion status and release the claim: <ISSOPEN_EPIC_LINK>",
      workEpic:
        "Use $issopen in work-epic mode for this explicit Epic. Reconcile missing tickets first, execute only eligible Ready work, keep every actionable change ticket-first and continue until no eligible work remains or a safe stop condition applies: <ISSOPEN_EPIC_LINK>",
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
4. Ask the Issopen Owner to create a named MCP API key under the intended PAT
   identity. Use one key per Codex installation, editor, runner or service.
5. Copy its one-time value only into that consumer's secret store or environment
   variable ISSOPEN_AGENT_TOKEN.
6. Configure Codex with:

   codex mcp add issopen --url ${document.mcp.url} --bearer-token-env-var ISSOPEN_AGENT_TOKEN

7. Restart the client so it discovers the skill and environment, then call
   get_agent_context. Confirm the returned identity, project allowlist and scopes.

ChatGPT uses the same MCP URL through OAuth and does not use the Codex PAT.
${document.mcp.chatgptSetup}
${document.mcp.chatgptTroubleshooting}

## Multiple MCP API keys

A PAT identity can have up to 10 active named keys. The identity owns projects
and scopes; every key inherits those live permissions. Each key separately
records its label, expiry, last use and revocation state. A migrated legacy key
is labelled Primary; do not reuse it for new consumers.

For rotation, create and verify the replacement first, then revoke only the old
key. Revoke key affects one consumer. Revoke access invalidates the identity and
all its keys. MCP API keys authenticate only /mcp and never the human REST API.

## Operating modes

- Consult: read-only summary. Do not create, claim or update work.
- Plan: create or refine only the requested tickets and blocking questions.
- Execute: call get_project, claim an eligible Ready ticket, implement and verify
  it, add checkpoints and code links, then follow project.workflow and release.
- Work Epic: for an explicitly selected Epic, reconcile missing outcomes and
  require an eligible ticket before every code, configuration, documentation or
  deployment change. Queries, explanations and reads do not create tickets.
  If MCP is unavailable, stop the mutation with a secret-free checkpoint.
- When humanReviewRequired is true, completion is Ready for Human Review.
- When humanReviewRequired is false, completion is Done and requires issues:close.
  Without that scope, leave an attributed blocker and do not claim completion.

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
get_project before execution. Its workflow says whether verified work returns
to Ready for Human Review or finishes at Done; Done always requires issues:close.
Treat ticket/Epic links as context rather than authorization. Secrets never
belong in URLs, prompts, tickets, repositories or logs. PAT identities support
several named MCP API keys; use one key per consumer and rotate it independently.
An explicit work-epic session is ticket-first for code, configuration,
documentation and deployment, but does not create backlog items for queries.
ChatGPT instead uses OAuth with automatic CIMD discovery: click Authenticate,
sign in as an Issopen workspace Owner and review consent. See agent onboarding
for authentication troubleshooting; never share callback URLs, codes or tokens.
`;
}
