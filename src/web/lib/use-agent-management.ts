import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { Agent, AgentCredential, AgentScope } from "../types.js";
import {
  type CredentialExpiry,
  defaultAgentScopes,
} from "./agent-management-model.js";
import type { AgentOnboardingInstructions } from "./agent-onboarding.js";
import {
  buildAgentOnboardingInstructions,
  parseAgentSkillManifest,
} from "./agent-onboarding.js";
import { ApiError, apiRequest } from "./api.js";

function messageFor(error: unknown) {
  if (error instanceof ApiError) {
    return error.fields.length
      ? error.fields
      : [{ field: "request", message: error.message }];
  }
  return [
    {
      field: "request",
      message:
        "We couldn't save your changes. Check your connection and try again.",
    },
  ];
}

export function useAgentManagement() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [scopes, setScopes] = useState<AgentScope[]>([...defaultAgentScopes]);
  const [expiresInDays, setExpiresInDays] = useState<CredentialExpiry>("30");
  const [token, setToken] = useState<string | null>(null);
  const [tokenLabel, setTokenLabel] = useState("Primary");
  const [revokeTarget, setRevokeTarget] = useState<Agent | null>(null);
  const [credentialRevokeTarget, setCredentialRevokeTarget] = useState<{
    agent: Agent;
    credential: AgentCredential;
  } | null>(null);
  const [credentialAgentId, setCredentialAgentId] = useState<string | null>(
    null,
  );
  const [credentialLabel, setCredentialLabel] = useState("");
  const [credentialExpiresInDays, setCredentialExpiresInDays] =
    useState<CredentialExpiry>("30");
  const [editTarget, setEditTarget] = useState<Agent | null>(null);
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);
  const [editScopes, setEditScopes] = useState<AgentScope[]>([]);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>(
    [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [onboarding, setOnboarding] = useState<{
    agentId: string;
    instructions: AgentOnboardingInstructions;
  } | null>(null);
  const [onboardingLoadingId, setOnboardingLoadingId] = useState<string | null>(
    null,
  );
  const [onboardingCopied, setOnboardingCopied] = useState<
    "full" | "prompt" | null
  >(null);

  const refresh = useCallback(async () => {
    const response = await apiRequest<{ agents: Agent[] }>("/api/v1/agents");
    setAgents(response.agents);
  }, []);

  useEffect(() => {
    refresh()
      .catch(() =>
        setErrors([
          {
            field: "request",
            message:
              "We couldn't load agents. Check your connection and try again.",
          },
        ]),
      )
      .finally(() => setLoading(false));
  }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors([]);
    setSubmitting(true);
    try {
      const result = await apiRequest<{ agent: Agent; token: string }>(
        "/api/v1/agents",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            description,
            projectIds,
            scopes,
            expiresInDays:
              expiresInDays === "never" ? null : Number(expiresInDays),
          }),
        },
      );
      setTokenLabel("Primary");
      setToken(result.token);
      setShowForm(false);
      await refresh();
    } catch (error) {
      setErrors(messageFor(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function createCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!credentialAgentId) return;
    setErrors([]);
    setSubmitting(true);
    try {
      const result = await apiRequest<{
        credential: AgentCredential;
        token: string;
      }>(`/api/v1/agents/${credentialAgentId}/credentials`, {
        method: "POST",
        body: JSON.stringify({
          label: credentialLabel,
          expiresInDays:
            credentialExpiresInDays === "never"
              ? null
              : Number(credentialExpiresInDays),
        }),
      });
      setTokenLabel(result.credential.label);
      setToken(result.token);
      setCredentialAgentId(null);
      setCredentialLabel("");
      await refresh();
    } catch (error) {
      setErrors(messageFor(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeCredential() {
    if (!credentialRevokeTarget) return;
    setErrors([]);
    try {
      const { agent, credential } = credentialRevokeTarget;
      await apiRequest(
        `/api/v1/agents/${agent.id}/credentials/${credential.id}/revoke`,
        { method: "POST", body: "{}" },
      );
      setCredentialRevokeTarget(null);
      await refresh();
    } catch (error) {
      setErrors(messageFor(error));
    }
  }

  async function revoke(agent: Agent) {
    try {
      await apiRequest(`/api/v1/agents/${agent.id}/revoke`, {
        method: "POST",
        body: "{}",
      });
      setRevokeTarget(null);
      await refresh();
    } catch (error) {
      setErrors(messageFor(error));
    }
  }

  function beginEdit(agent: Agent) {
    setEditTarget(agent);
    setEditProjectIds([...agent.projectIds]);
    setEditScopes([...agent.scopes]);
    setErrors([]);
  }

  async function saveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget) return;
    setErrors([]);
    setSubmitting(true);
    try {
      await apiRequest(`/api/v1/agents/${editTarget.id}/access`, {
        method: "PATCH",
        body: JSON.stringify({
          projectIds: editProjectIds,
          scopes: editScopes,
        }),
      });
      setEditTarget(null);
      await refresh();
    } catch (error) {
      setErrors(messageFor(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function openOnboarding(agent: Agent) {
    setErrors([]);
    setOnboardingCopied(null);
    setOnboardingLoadingId(agent.id);
    try {
      const [config, manifestResponse] = await Promise.all([
        apiRequest<{ resource: string }>("/api/v1/mcp/config"),
        fetch("/downloads/issopen-skill-manifest.json"),
      ]);
      if (!manifestResponse.ok) throw new Error("Skill manifest unavailable");
      const manifest = parseAgentSkillManifest(await manifestResponse.json());
      setOnboarding({
        agentId: agent.id,
        instructions: buildAgentOnboardingInstructions({
          origin: window.location.origin,
          mcpUrl: config.resource,
          agent,
          manifest,
        }),
      });
    } catch {
      setErrors([
        {
          field: "onboarding",
          message:
            "We couldn't prepare this agent's onboarding. Check the connection and published skill manifest, then try again.",
        },
      ]);
    } finally {
      setOnboardingLoadingId(null);
    }
  }

  async function copyOnboarding(kind: "full" | "prompt", value: string) {
    await navigator.clipboard?.writeText(value);
    setOnboardingCopied(kind);
  }

  function finishTokenSetup() {
    setToken(null);
    setTokenLabel("Primary");
  }

  return {
    agents,
    beginEdit,
    copyOnboarding,
    createCredential,
    credentialAgentId,
    credentialExpiresInDays,
    credentialLabel,
    credentialRevokeTarget,
    description,
    editProjectIds,
    editScopes,
    editTarget,
    errors,
    expiresInDays,
    finishTokenSetup,
    loading,
    name,
    onboarding,
    onboardingCopied,
    onboardingLoadingId,
    openOnboarding,
    projectIds,
    revoke,
    revokeCredential,
    revokeTarget,
    saveAccess,
    scopes,
    setCredentialAgentId,
    setCredentialExpiresInDays,
    setCredentialLabel,
    setCredentialRevokeTarget,
    setDescription,
    setEditProjectIds,
    setEditScopes,
    setEditTarget,
    setExpiresInDays,
    setName,
    setOnboarding,
    setProjectIds,
    setRevokeTarget,
    setScopes,
    setShowForm,
    showForm,
    submit,
    submitting,
    token,
    tokenLabel,
  };
}

export type AgentManagementController = ReturnType<typeof useAgentManagement>;
