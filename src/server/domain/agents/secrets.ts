import { createHash, randomBytes } from "node:crypto";
import type { Algorithm, Version } from "@node-rs/argon2";
import { hash, verify } from "@node-rs/argon2";

export const agentTokenPrefix = "issopen_pat_";

const argonPolicy = {
  algorithm: 2 as Algorithm,
  version: 1 as Version,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export function generateAgentToken() {
  return `${agentTokenPrefix}${randomBytes(32).toString("base64url")}`;
}

export function agentTokenFingerprint(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

export function hashAgentToken(token: string) {
  return hash(token, argonPolicy);
}

export function verifyAgentToken(hashValue: string, token: string) {
  return verify(hashValue, token);
}

export function isAgentTokenShape(token: string) {
  return (
    token.startsWith(agentTokenPrefix) &&
    token.length === agentTokenPrefix.length + 43 &&
    /^[A-Za-z0-9_-]+$/.test(token.slice(agentTokenPrefix.length))
  );
}
