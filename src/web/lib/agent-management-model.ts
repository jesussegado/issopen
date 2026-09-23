import type { AgentCredential, AgentScope } from "../types.js";
import { agentScopes } from "../types.js";

export type CredentialExpiry = "7" | "30" | "90" | "never";

export const defaultAgentScopes = agentScopes.filter(
  (scope) => scope !== "issues:close" && !scope.startsWith("epics:"),
);

export const agentScopeLabels: Record<AgentScope, string> = {
  "issues:read": "Read issues",
  "issues:create": "Create issues",
  "questions:write": "Ask blocking questions",
  "comments:write": "Add progress comments",
  "issues:claim": "Claim or release work",
  "issues:write": "Edit issue fields",
  "code:link": "Link code results",
  "issues:review": "Move work through Ready for Human Review",
  "issues:close": "Close issues",
  "epics:create": "Create Epics (explicit opt-in)",
  "epics:write": "Edit Epics (explicit opt-in)",
};

export function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function dateLabel(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(value),
      )
    : "Never";
}

export function credentialStatus(credential: AgentCredential) {
  if (credential.revokedAt) return "Revoked";
  if (credential.expiresAt && new Date(credential.expiresAt) <= new Date()) {
    return "Expired";
  }
  return "Active";
}
