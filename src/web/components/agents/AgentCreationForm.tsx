import {
  agentScopeLabels,
  toggleValue,
} from "../../lib/agent-management-model.js";
import type { AgentManagementController } from "../../lib/use-agent-management.js";
import type { Project } from "../../types.js";
import { agentScopes } from "../../types.js";
import { Button, Field, Select, TextArea, TextInput } from "../ui.js";

export function AgentCreationForm({
  controller,
  projects,
}: {
  controller: AgentManagementController;
  projects: Project[];
}) {
  if (!controller.showForm) return null;
  return (
    <form className="form-panel form-stack" onSubmit={controller.submit}>
      <Field label="Name" htmlFor="name" required>
        <TextInput
          id="name"
          required
          maxLength={120}
          value={controller.name}
          onChange={(event) => controller.setName(event.currentTarget.value)}
        />
      </Field>
      <Field label="Description" htmlFor="description">
        <TextArea
          id="description"
          maxLength={2000}
          value={controller.description}
          onChange={(event) =>
            controller.setDescription(event.currentTarget.value)
          }
        />
      </Field>
      <fieldset>
        <legend>Allowed projects (required)</legend>
        {projects.map((project) => (
          <label className="check-row" key={project.id}>
            <input
              type="checkbox"
              checked={controller.projectIds.includes(project.id)}
              onChange={() =>
                controller.setProjectIds(
                  toggleValue(controller.projectIds, project.id),
                )
              }
            />{" "}
            {project.name}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Scopes (required)</legend>
        {agentScopes.map((scope) => (
          <label className="check-row" key={scope}>
            <input
              type="checkbox"
              checked={controller.scopes.includes(scope)}
              onChange={() =>
                controller.setScopes(toggleValue(controller.scopes, scope))
              }
            />{" "}
            {agentScopeLabels[scope]}
            {scope === "issues:close" ? (
              <span className="field-helper">
                Allows this agent to move issues to Done. Human review remains
                the default.
              </span>
            ) : null}
          </label>
        ))}
      </fieldset>
      <Field label="Credential expiry" htmlFor="expires">
        <Select
          id="expires"
          value={controller.expiresInDays}
          onChange={(event) =>
            controller.setExpiresInDays(
              event.currentTarget.value as typeof controller.expiresInDays,
            )
          }
        >
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="never">No expiry</option>
        </Select>
      </Field>
      <div className="page-actions">
        <Button
          type="submit"
          disabled={
            controller.submitting ||
            controller.projectIds.length === 0 ||
            controller.scopes.length === 0
          }
        >
          {controller.submitting ? "Creating…" : "Create agent"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => controller.setShowForm(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
