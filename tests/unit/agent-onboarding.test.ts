import { describe, expect, it } from "vitest";
import {
  createAgentOnboardingDocument,
  createAgentOnboardingText,
  createLlmsText,
} from "../../src/server/agent-onboarding.js";

describe("public agent onboarding contract", () => {
  const baseUrl = "https://issues.example.test";

  it("publishes canonical MCP, skill and documentation URLs without credentials", () => {
    const document = createAgentOnboardingDocument(baseUrl);

    expect(document).toMatchObject({
      schemaVersion: 1,
      guideUrl: "https://issues.example.test/agent-onboarding",
      machineGuideUrl: "https://issues.example.test/agent-onboarding.txt",
      mcp: { url: "https://issues.example.test/mcp", method: "POST" },
      skill: {
        manifestUrl:
          "https://issues.example.test/downloads/issopen-skill-manifest.json",
      },
      credentials: {
        maxActivePerIdentity: 10,
        legacyLabel: "Primary",
      },
    });
    expect(JSON.stringify(document)).not.toMatch(
      /issopen_pat_|password=|authorization:/i,
    );
  });

  it("teaches bootstrap, permission preflight and the human review boundary", () => {
    const onboarding = createAgentOnboardingText(baseUrl);
    const llms = createLlmsText(baseUrl);

    expect(onboarding).toContain("codex mcp add issopen");
    expect(onboarding).toContain("get_agent_context");
    expect(onboarding).toContain("Ready for Human Review");
    expect(onboarding).toContain("context, not authorization");
    expect(onboarding).toContain("ChatGPT uses the same MCP URL through OAuth");
    expect(onboarding).toContain("click Authenticate");
    expect(onboarding).toContain(
      "client discovery failure, not a wrong password",
    );
    expect(createAgentOnboardingDocument(baseUrl).mcp.chatgptSetup).toContain(
      "CIMD",
    );
    expect(llms).toContain("OAuth with automatic CIMD discovery");
    expect(onboarding).toContain("Multiple MCP API keys");
    expect(onboarding).toContain("up to 10 active named keys");
    expect(onboarding).toContain("Revoke key affects one consumer");
    expect(llms).toContain("use one key per consumer");
    expect(llms).toContain("https://issues.example.test/agent-onboarding.txt");
    expect(llms).toContain("https://issues.example.test/mcp");
    expect(`${onboarding}\n${llms}`).not.toMatch(/issopen_pat_[A-Za-z0-9_-]+/);
  });
});
