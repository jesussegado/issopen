import {
  agentScopeLabels,
  dateLabel,
} from "../../lib/agent-management-model.js";
import type { AgentManagementController } from "../../lib/use-agent-management.js";
import type { Agent } from "../../types.js";
import { Button } from "../ui.js";
import { AgentAccessForm } from "./AgentAccessForm.js";
import { AgentCredentials } from "./AgentCredentials.js";
import { AgentOnboardingPanel } from "./AgentOnboardingPanel.js";

export function AgentCard({
  agent,
  controller,
}: {
  agent: Agent;
  controller: AgentManagementController;
}) {
  return (
    <article className="detail-panel">
      <div className="page-header">
        <div>
          <h2>{agent.name}</h2>
          <p>{agent.description}</p>
        </div>
        {agent.access.revokedAt ? null : (
          <div className="page-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => controller.beginEdit(agent)}
            >
              Edit permissions
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={controller.onboardingLoadingId === agent.id}
              onClick={() => void controller.openOnboarding(agent)}
            >
              {controller.onboardingLoadingId === agent.id
                ? "Preparing…"
                : "Setup guide"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => controller.setRevokeTarget(agent)}
            >
              Revoke access
            </Button>
          </div>
        )}
      </div>
      <AgentOnboardingPanel agent={agent} controller={controller} />
      <AgentAccessForm agent={agent} controller={controller} />
      <AgentCredentials agent={agent} controller={controller} />
      <dl className="metadata-list">
        <div>
          <dt>Access type</dt>
          <dd>{agent.access.kind === "oauth" ? "OAuth" : "PAT"}</dd>
        </div>
        <div>
          <dt>Allowed projects</dt>
          <dd>{agent.projects.map((project) => project.name).join(", ")}</dd>
        </div>
        <div>
          <dt>Scopes</dt>
          <dd>
            {agent.scopes.map((scope) => agentScopeLabels[scope]).join(", ")}
          </dd>
        </div>
        <div>
          <dt>Agent status</dt>
          <dd>{agent.access.revokedAt ? "Revoked" : "Active"}</dd>
        </div>
        {agent.access.kind === "oauth" ? (
          <div>
            <dt>Expiry</dt>
            <dd>
              {agent.access.expiresAt
                ? dateLabel(agent.access.expiresAt)
                : "Managed by OAuth"}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Last used</dt>
          <dd>{dateLabel(agent.access.lastUsedAt)}</dd>
        </div>
      </dl>
    </article>
  );
}
