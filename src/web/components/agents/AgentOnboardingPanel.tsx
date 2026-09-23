import type { AgentManagementController } from "../../lib/use-agent-management.js";
import type { Agent } from "../../types.js";
import { Button, StatusBanner } from "../ui.js";

export function AgentOnboardingPanel({
  agent,
  controller,
}: {
  agent: Agent;
  controller: AgentManagementController;
}) {
  if (controller.onboarding?.agentId !== agent.id) return null;
  const { instructions } = controller.onboarding;
  return (
    <section
      className="agent-onboarding-panel"
      aria-labelledby={`agent-onboarding-${agent.id}`}
    >
      <div className="page-header">
        <div>
          <h3 id={`agent-onboarding-${agent.id}`}>Onboard {agent.name}</h3>
          <p>
            These instructions contain projects and scopes, but never the PAT.
            Deliver the one-time token separately.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => controller.setOnboarding(null)}
        >
          Close guide
        </Button>
      </div>
      {controller.onboardingCopied ? (
        <StatusBanner>
          {controller.onboardingCopied === "full"
            ? "Onboarding instructions copied"
            : "Starter prompt copied"}
        </StatusBanner>
      ) : null}
      <div className="page-actions">
        <Button
          type="button"
          onClick={() =>
            void controller.copyOnboarding("full", instructions.full)
          }
        >
          Copy full onboarding
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            void controller.copyOnboarding("prompt", instructions.prompt)
          }
        >
          Copy starter prompt
        </Button>
        <a
          className="button button-secondary"
          href="/agent-onboarding"
          target="_blank"
          rel="noreferrer"
        >
          Open public guide
        </a>
      </div>
      <pre>{instructions.full}</pre>
    </section>
  );
}
