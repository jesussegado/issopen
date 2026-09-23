import type { AgentManagementController } from "../../lib/use-agent-management.js";
import { Button } from "../ui.js";

export function AgentDialogs({
  controller,
}: {
  controller: AgentManagementController;
}) {
  const revokeTarget = controller.revokeTarget;
  const credentialRevokeTarget = controller.credentialRevokeTarget;
  return (
    <>
      {revokeTarget ? (
        <div
          className="confirmation-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-title"
        >
          <h2 id="revoke-title">Revoke agent access?</h2>
          <p>
            {revokeTarget.name} will lose access immediately. Existing activity
            will remain. This can't be undone.
          </p>
          <div className="page-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => controller.setRevokeTarget(null)}
            >
              Keep agent access
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void controller.revoke(revokeTarget)}
            >
              Revoke access
            </Button>
          </div>
        </div>
      ) : null}
      {credentialRevokeTarget ? (
        <div
          className="confirmation-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-key-title"
        >
          <h2 id="revoke-key-title">Revoke this API key?</h2>
          <p>
            {credentialRevokeTarget.credential.label} will stop working
            immediately. Other keys for {credentialRevokeTarget.agent.name} will
            continue to work.
          </p>
          <div className="page-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => controller.setCredentialRevokeTarget(null)}
            >
              Keep API key
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void controller.revokeCredential()}
            >
              Revoke API key
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
