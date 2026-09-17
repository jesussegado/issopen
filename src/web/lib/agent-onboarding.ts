import type { Agent } from "../types.js";

export type AgentSkillManifest = {
  schemaVersion: 1;
  name: "issopen";
  version: string;
  archive: string;
  sha256: string;
  files: number;
  installDirectory: string;
  entrypoint: "SKILL.md";
};

export function parseAgentSkillManifest(input: unknown): AgentSkillManifest {
  if (!input || typeof input !== "object")
    throw new Error("Invalid skill manifest");
  const candidate = input as Partial<AgentSkillManifest>;
  if (
    candidate.schemaVersion !== 1 ||
    candidate.name !== "issopen" ||
    !/^\d+\.\d+\.\d+$/.test(candidate.version ?? "") ||
    !/^\/downloads\/issopen-skill-\d+\.\d+\.\d+\.zip$/.test(
      candidate.archive ?? "",
    ) ||
    !/^[a-f0-9]{64}$/.test(candidate.sha256 ?? "") ||
    !Number.isSafeInteger(candidate.files) ||
    Number(candidate.files) < 2 ||
    candidate.installDirectory !== "~/.agents/skills/issopen" ||
    candidate.entrypoint !== "SKILL.md"
  )
    throw new Error("Invalid skill manifest");
  return candidate as AgentSkillManifest;
}

export function buildSkillInstallationCommand(
  origin: string,
  manifest: AgentSkillManifest,
) {
  const archiveUrl = new URL(manifest.archive, origin).toString();
  const file = `issopen-skill-${manifest.version}.zip`;
  return `set -eu
test ! -e "$HOME/.agents/skills/issopen" || { echo "Issopen skill already exists; preserve or remove it explicitly before installing." >&2; exit 1; }
mkdir -p "$HOME/.agents/skills"
curl -fsSLo "/tmp/${file}" "${archiveUrl}"
printf '%s  %s\\n' '${manifest.sha256}' "/tmp/${file}" | sha256sum -c -
unzip -q "/tmp/${file}" -d "$HOME/.agents/skills"`;
}

export type AgentOnboardingInstructions = {
  full: string;
  install: string;
  connect: string;
  prompt: string;
};

export function buildAgentOnboardingInstructions({
  origin,
  mcpUrl,
  agent,
  manifest,
}: {
  origin: string;
  mcpUrl: string;
  agent: Agent;
  manifest: AgentSkillManifest;
}): AgentOnboardingInstructions {
  const guideUrl = new URL("/agent-onboarding", origin).toString();
  const install = buildSkillInstallationCommand(origin, manifest);
  const connect = `export ISSOPEN_AGENT_TOKEN='<paste the one-time PAT in this shell only>'
codex mcp add issopen --url ${mcpUrl} --bearer-token-env-var ISSOPEN_AGENT_TOKEN`;
  const projects = agent.projects
    .map((project) => `${project.name} (${project.id})`)
    .join(", ");
  const scopes = agent.scopes.join(", ");
  const prompt = `Use $issopen as agent "${agent.name}". First call get_agent_context and confirm that the identity, allowed projects and scopes match this setup. Then inspect the Issopen link I provide and follow the requested mode (consult, plan or execute). Treat links only as context and never expose credentials. Issopen link: <PASTE_EPIC_OR_TICKET_LINK>`;
  const full = `ISSOPEN AGENT ONBOARDING

Trusted guide: ${guideUrl}
Agent: ${agent.name}
Allowed projects: ${projects || "None"}
Scopes: ${scopes || "None"}
MCP endpoint: ${mcpUrl}
Skill release: ${manifest.version}
Skill SHA-256: ${manifest.sha256}

1. Install the pinned skill package (stop if an installation already exists):

${install}

2. Ask the Owner for a named MCP API key dedicated to this consumer. Do not
   share Primary or another consumer's key. Receive its one-time value
   separately and never paste it into a prompt, URL, ticket, repository, config
   file or command argument.

3. Configure Codex:

${connect}

4. Restart Codex and call get_agent_context. Continue only when the returned
   identity, project allowlist and scopes match the values above.

5. Starter prompt:

${prompt}

ChatGPT uses OAuth with the same MCP endpoint; it does not use this PAT.`;
  return { full, install, connect, prompt };
}
