import { useEffect, useState } from "react";
import {
  Button,
  PageHeading,
  Skeleton,
  StatusBanner,
} from "../components/ui.js";
import { apiRequest } from "../lib/api.js";

export function ConnectRoute() {
  const [resource, setResource] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    apiRequest<{ resource: string }>("/api/v1/mcp/config")
      .then((response) => setResource(response.resource))
      .catch(() => setError(true));
  }, []);

  if (error)
    return (
      <StatusBanner error>
        We couldn't load the MCP connection details. Try again.
      </StatusBanner>
    );
  if (!resource) return <Skeleton label="Loading MCP connection details…" />;
  return (
    <div className="reading-column">
      <PageHeading>Connect ChatGPT to Issopen</PageHeading>
      {copied ? <StatusBanner>MCP URL copied</StatusBanner> : null}
      <label className="field" htmlFor="mcp-url">
        <span>MCP URL</span>
        <input
          id="mcp-url"
          className="secret-value"
          readOnly
          value={resource}
        />
      </label>
      <Button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(resource);
          setCopied(true);
        }}
      >
        Copy MCP URL
      </Button>
      <ol className="connection-steps">
        <li>Copy the MCP URL above.</li>
        <li>Add it as a personal MCP plugin in ChatGPT Work.</li>
        <li>Authorize access in Issopen.</li>
        <li>Ask ChatGPT to list your private projects.</li>
      </ol>
      <p className="helper-copy">
        Issopen reports a connection only after a successful OAuth authorization
        or tool request.
      </p>
    </div>
  );
}

const scopeLabels: Record<string, string> = {
  "issues:read": "Read issues",
  "issues:create": "Create issues",
  "questions:write": "Ask blocking questions",
  "comments:write": "Add progress comments",
  "issues:claim": "Claim or release work",
  "issues:write": "Edit issue fields",
  "code:link": "Link code results",
  "issues:review": "Move work through Ready for Review",
  "issues:close": "Close issues",
  "extension:read":
    "Leer tus proyectos desde esta instalación de Chrome (sin permisos de agente)",
  "extension:write":
    "Crear proyectos, Epics y tickets con capturas revisadas desde esta instalación de Chrome",
  offline_access: "Stay connected and refresh access until revoked",
};

export function ConsentRoute({
  search,
  workspaceName,
}: {
  search: string;
  workspaceName: string;
}) {
  const params = new URLSearchParams(search);
  const clientId = params.get("client_id") ?? "";
  const requestedScopes = (params.get("scope") ?? "")
    .split(" ")
    .filter((scope) => scope in scopeLabels);
  const [clientName, setClientName] = useState<string | null>(null);
  const [failure, setFailure] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setFailure(true);
      return;
    }
    apiRequest<{ name?: string }>(
      `/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`,
    )
      .then((client) => setClientName(client.name?.trim() || "ChatGPT"))
      .catch(() => setFailure(true));
  }, [clientId]);

  async function decide(accept: boolean) {
    setSubmitting(true);
    setFailure(false);
    try {
      const response = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accept,
          scope: requestedScopes.join(" "),
          oauth_query: search.startsWith("?") ? search.slice(1) : search,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        url?: string;
        redirect_uri?: string;
      } | null;
      const redirect = body?.url ?? body?.redirect_uri;
      if (!response.ok || !redirect) throw new Error("OAuth consent failed");
      window.location.assign(redirect);
    } catch {
      setFailure(true);
      setSubmitting(false);
    }
  }

  return (
    <div className="reading-column">
      <PageHeading>
        {clientName ?? "Cliente OAuth"} wants to access Issopen
      </PageHeading>
      {failure ? (
        <StatusBanner error focus>
          We couldn't authorize this connection. Return to the client and try
          connecting again.
        </StatusBanner>
      ) : null}
      <section className="detail-panel" aria-labelledby="consent-workspace">
        <h2 id="consent-workspace">Workspace</h2>
        <p>{workspaceName}</p>
        <h2>Requested capabilities</h2>
        <ul>
          {requestedScopes.map((scope) => (
            <li key={scope}>{scopeLabels[scope]}</li>
          ))}
        </ul>
      </section>
      <div className="page-actions">
        <Button
          type="button"
          disabled={submitting || failure}
          onClick={() => void decide(true)}
        >
          Allow access
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={submitting}
          onClick={() => void decide(false)}
        >
          Deny access
        </Button>
      </div>
    </div>
  );
}
