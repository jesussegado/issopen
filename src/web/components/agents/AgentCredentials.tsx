import {
  credentialStatus,
  dateLabel,
} from "../../lib/agent-management-model.js";
import type { AgentManagementController } from "../../lib/use-agent-management.js";
import type { Agent } from "../../types.js";
import { Button, Field, Select, TextInput } from "../ui.js";

export function AgentCredentials({
  agent,
  controller,
}: {
  agent: Agent;
  controller: AgentManagementController;
}) {
  if (agent.access.kind !== "pat" || agent.access.revokedAt) return null;
  return (
    <section aria-labelledby={`api-keys-${agent.id}`}>
      <div className="page-header">
        <div>
          <h3 id={`api-keys-${agent.id}`}>MCP API keys</h3>
          <p>
            Use a separate key for every Codex session, MCP client or external
            service. All keys inherit this agent's projects and scopes.
          </p>
        </div>
        {controller.credentialAgentId === agent.id ? null : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              controller.setCredentialAgentId(agent.id);
              controller.setCredentialLabel("");
            }}
          >
            Create API key
          </Button>
        )}
      </div>
      {controller.credentialAgentId === agent.id ? (
        <form
          className="form-panel form-stack"
          onSubmit={controller.createCredential}
        >
          <Field label="Key label" htmlFor={`key-label-${agent.id}`} required>
            <TextInput
              id={`key-label-${agent.id}`}
              required
              maxLength={80}
              placeholder="VS Code laptop"
              value={controller.credentialLabel}
              onChange={(event) =>
                controller.setCredentialLabel(event.currentTarget.value)
              }
            />
          </Field>
          <Field label="Key expiry" htmlFor={`key-expiry-${agent.id}`}>
            <Select
              id={`key-expiry-${agent.id}`}
              value={controller.credentialExpiresInDays}
              onChange={(event) =>
                controller.setCredentialExpiresInDays(
                  event.currentTarget
                    .value as typeof controller.credentialExpiresInDays,
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
            <Button type="submit" disabled={controller.submitting}>
              {controller.submitting ? "Creating…" : "Create and reveal key"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => controller.setCredentialAgentId(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
      <div className="agent-key-list">
        {agent.credentials.map((credential) => {
          const status = credentialStatus(credential);
          return (
            <article className="form-panel" key={credential.id}>
              <div className="page-header">
                <div>
                  <h4>{credential.label}</h4>
                  <p>
                    {status} · Fingerprint {credential.fingerprint}
                  </p>
                </div>
                {status === "Active" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() =>
                      controller.setCredentialRevokeTarget({
                        agent,
                        credential,
                      })
                    }
                  >
                    Revoke key
                  </Button>
                ) : null}
              </div>
              <dl className="metadata-list">
                <div>
                  <dt>Expires</dt>
                  <dd>
                    {credential.expiresAt
                      ? dateLabel(credential.expiresAt)
                      : "No expiry"}
                  </dd>
                </div>
                <div>
                  <dt>Last used</dt>
                  <dd>{dateLabel(credential.lastUsedAt)}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
