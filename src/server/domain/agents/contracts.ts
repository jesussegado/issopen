import { z } from "zod";
import { agentScopeValues } from "../../db/schema.js";

export const agentScopeSchema = z.enum(agentScopeValues);
export type AgentScope = z.infer<typeof agentScopeSchema>;

export const defaultCodexScopes = [
  "issues:read",
  "issues:create",
  "questions:write",
  "comments:write",
  "issues:claim",
  "issues:write",
  "code:link",
  "issues:review",
] as const satisfies readonly AgentScope[];

const uniqueValues = <T>(values: T[]) => new Set(values).size === values.length;

export const createAgentSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2_000).default(""),
    projectIds: z
      .array(z.uuid())
      .min(1)
      .max(100)
      .refine(uniqueValues, "Projects must be unique"),
    scopes: z
      .array(agentScopeSchema)
      .min(1)
      .max(agentScopeValues.length)
      .refine(uniqueValues, "Scopes must be unique")
      .default([...defaultCodexScopes]),
    expiresInDays: z
      .union([z.literal(7), z.literal(30), z.literal(90), z.null()])
      .default(30),
  })
  .strict();

export type CreateAgentInput = z.input<typeof createAgentSchema>;

export const createAgentCredentialSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    expiresInDays: z
      .union([z.literal(7), z.literal(30), z.literal(90), z.null()])
      .default(30),
  })
  .strict();

export type CreateAgentCredentialInput = z.input<
  typeof createAgentCredentialSchema
>;

export const updateAgentAccessSchema = z
  .object({
    projectIds: z
      .array(z.uuid())
      .min(1)
      .max(100)
      .refine(uniqueValues, "Projects must be unique"),
    scopes: z
      .array(agentScopeSchema)
      .min(1)
      .max(agentScopeValues.length)
      .refine(uniqueValues, "Scopes must be unique"),
  })
  .strict();

export type UpdateAgentAccessInput = z.input<typeof updateAgentAccessSchema>;

export type AgentPrincipal = {
  workspaceId: string;
  agent: { id: string; name: string };
  scopes: ReadonlySet<AgentScope>;
  projectIds: ReadonlySet<string>;
};
