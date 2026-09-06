import { describe, expect, it } from "vitest";
import {
  agentTokenFingerprint,
  agentTokenPrefix,
  generateAgentToken,
  hashAgentToken,
  isAgentTokenShape,
  verifyAgentToken,
} from "../../src/server/domain/agents/secrets.js";

describe("agent personal access token secrets", () => {
  it("creates prefixed high-entropy tokens and stable safe fingerprints", () => {
    const first = generateAgentToken();
    const second = generateAgentToken();
    expect(first).toMatch(new RegExp(`^${agentTokenPrefix}[A-Za-z0-9_-]{43}$`));
    expect(first).not.toBe(second);
    expect(isAgentTokenShape(first)).toBe(true);
    expect(agentTokenFingerprint(first)).toMatch(/^[a-f0-9]{16}$/);
    expect(agentTokenFingerprint(first)).toBe(agentTokenFingerprint(first));
  });

  it("stores Argon2id output that verifies only the original token", async () => {
    const token = generateAgentToken();
    const encoded = await hashAgentToken(token);
    expect(encoded).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(encoded).not.toContain(token);
    await expect(verifyAgentToken(encoded, token)).resolves.toBe(true);
    await expect(verifyAgentToken(encoded, generateAgentToken())).resolves.toBe(
      false,
    );
  });
});
