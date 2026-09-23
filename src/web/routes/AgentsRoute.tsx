import { AgentCard } from "../components/agents/AgentCard.js";
import { AgentCreationForm } from "../components/agents/AgentCreationForm.js";
import { AgentDialogs } from "../components/agents/AgentDialogs.js";
import { TokenReveal } from "../components/agents/TokenReveal.js";
import {
  Button,
  EmptyState,
  ErrorSummary,
  PageHeading,
  Skeleton,
} from "../components/ui.js";
import { useAgentManagement } from "../lib/use-agent-management.js";
import type { Project } from "../types.js";

export function AgentsRoute({ projects }: { projects: Project[] }) {
  const controller = useAgentManagement();

  if (controller.loading) return <Skeleton label="Loading agents…" />;
  if (controller.token) return <TokenReveal controller={controller} />;

  return (
    <div className="reading-column">
      <div className="page-header">
        <PageHeading>Agents</PageHeading>
        <Button type="button" onClick={() => controller.setShowForm(true)}>
          Create agent
        </Button>
      </div>
      <ErrorSummary errors={controller.errors} />
      <AgentDialogs controller={controller} />
      <AgentCreationForm controller={controller} projects={projects} />
      {controller.agents.length === 0 && !controller.showForm ? (
        <EmptyState
          heading="No agents yet"
          body="Create a separate identity before giving a code agent access."
        />
      ) : null}
      <div className="agent-list">
        {controller.agents.map((agent) => (
          <AgentCard agent={agent} controller={controller} key={agent.id} />
        ))}
      </div>
    </div>
  );
}
