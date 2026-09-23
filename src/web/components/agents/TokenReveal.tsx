import type { AgentManagementController } from "../../lib/use-agent-management.js";
import { Button, PageHeading, StatusBanner } from "../ui.js";

export function TokenReveal({
  controller,
}: {
  controller: AgentManagementController;
}) {
  if (!controller.token) return null;
  return (
    <div className="reading-column">
      <PageHeading>API key: {controller.tokenLabel}</PageHeading>
      <StatusBanner focus>
        Copy this token now. You won't be able to see it again.
      </StatusBanner>
      <label className="field" htmlFor="agent-token">
        <span>Personal access token</span>
        <textarea
          id="agent-token"
          className="secret-value"
          readOnly
          value={controller.token}
          onFocus={(event) => event.currentTarget.select()}
        />
      </label>
      <div className="page-actions">
        <Button
          type="button"
          onClick={() =>
            void navigator.clipboard?.writeText(controller.token ?? "")
          }
        >
          Copy token
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={controller.finishTokenSetup}
        >
          Finish key setup
        </Button>
        <a className="button button-secondary" href="/agent-onboarding">
          Open onboarding guide
        </a>
      </div>
    </div>
  );
}
