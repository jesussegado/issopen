import {
  agentScopeLabels,
  toggleValue,
} from "../../lib/agent-management-model.js";
import type { AgentManagementController } from "../../lib/use-agent-management.js";
import type { Agent } from "../../types.js";
import { Button, StatusBanner } from "../ui.js";

export function AgentAccessForm({
  agent,
  controller,
}: {
  agent: Agent;
  controller: AgentManagementController;
}) {
  if (controller.editTarget?.id !== agent.id) return null;
  return (
    <form className="form-panel form-stack" onSubmit={controller.saveAccess}>
      <StatusBanner>
        Permissions can only be reduced. Create a new grant if this identity
        needs broader access.
      </StatusBanner>
      <fieldset>
        <legend>Retained projects (required)</legend>
        {agent.projects.map((project) => (
          <label className="check-row" key={project.id}>
            <input
              type="checkbox"
              checked={controller.editProjectIds.includes(project.id)}
              onChange={() =>
                controller.setEditProjectIds(
                  toggleValue(controller.editProjectIds, project.id),
                )
              }
            />{" "}
            {project.name}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Retained scopes (required)</legend>
        {agent.scopes.map((scope) => (
          <label className="check-row" key={scope}>
            <input
              type="checkbox"
              checked={controller.editScopes.includes(scope)}
              onChange={() =>
                controller.setEditScopes(
                  toggleValue(controller.editScopes, scope),
                )
              }
            />{" "}
            {agentScopeLabels[scope]}
          </label>
        ))}
      </fieldset>
      <div className="page-actions">
        <Button
          type="submit"
          disabled={
            controller.submitting ||
            controller.editProjectIds.length === 0 ||
            controller.editScopes.length === 0
          }
        >
          {controller.submitting ? "Saving…" : "Save reduced access"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => controller.setEditTarget(null)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
