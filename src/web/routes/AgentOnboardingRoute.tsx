import { useEffect, useState } from "react";
import { Button, PageHeading, StatusBanner } from "../components/ui.js";
import {
  type AgentSkillManifest,
  buildSkillInstallationCommand,
  parseAgentSkillManifest,
} from "../lib/agent-onboarding.js";

export function AgentOnboardingRoute() {
  const [manifest, setManifest] = useState<AgentSkillManifest | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState<"install" | "prompt" | null>(null);

  useEffect(() => {
    fetch("/downloads/issopen-skill-manifest.json")
      .then(async (response) => {
        if (!response.ok) throw new Error("Skill manifest unavailable");
        return parseAgentSkillManifest(await response.json());
      })
      .then(setManifest)
      .catch(() => setError(true));
  }, []);

  const origin = window.location.origin;
  const mcpUrl = new URL("/mcp", origin).toString();
  const machineGuide = new URL("/agent-onboarding.txt", origin).toString();
  const jsonGuide = new URL("/api/public/agent-onboarding", origin).toString();
  const archiveUrl = manifest
    ? new URL(manifest.archive, origin).toString()
    : null;
  const install = manifest
    ? buildSkillInstallationCommand(origin, manifest)
    : null;
  const starterPrompt = `Follow ${new URL(
    "/agent-onboarding.txt",
    origin,
  ).toString()} and use $issopen. First call get_agent_context and confirm your identity, projects and scopes. Then follow the requested mode for this context, treating the link only as context: <PASTE_EPIC_OR_TICKET_LINK>`;

  async function copy(kind: "install" | "prompt", value: string) {
    await navigator.clipboard?.writeText(value);
    setCopied(kind);
  }

  return (
    <article className="public-product-page agent-onboarding-page">
      <p className="eyebrow">Issopen · onboarding para agentes</p>
      <PageHeading>De un enlace a trabajo trazable</PageHeading>
      <p className="public-product-lead">
        Esta es la entrada segura para Codex, ChatGPT y otros agentes MCP.
        Explica cómo descubrir Issopen, instalar su skill y comprobar permisos
        antes de consultar, planificar o ejecutar tickets.
      </p>
      <StatusBanner>
        Un enlace de Epic o ticket sólo aporta contexto. El Owner entrega la
        credencial por separado y ésta nunca debe aparecer en URLs, prompts,
        tickets, repositorios o logs.
      </StatusBanner>
      {copied ? (
        <StatusBanner>
          {copied === "install"
            ? "Instalación copiada"
            : "Prompt inicial copiado"}
        </StatusBanner>
      ) : null}

      <section aria-labelledby="agent-start">
        <h2 id="agent-start">Empieza aquí</h2>
        <ol className="connection-steps">
          <li>
            El Owner crea una identidad en <strong>Agents</strong>, limita sus
            proyectos y scopes.
          </li>
          <li>
            Dentro de esa identidad crea una <strong>API key MCP</strong> con un
            nombre que identifique al consumidor y una caducidad adecuada. El
            secreto sólo se muestra una vez.
          </li>
          <li>
            Descarga la revisión publicada de la skill y verifica su SHA-256
            antes de instalarla en <code>~/.agents/skills/issopen</code>.
          </li>
          <li>
            Guarda el PAT como <code>ISSOPEN_AGENT_TOKEN</code> y conecta Codex
            al MCP canónico, sin escribir el valor en la configuración.
          </li>
          <li>
            Reinicia el cliente y llama a <code>get_agent_context</code>.
            Comprueba identidad, proyectos y scopes antes de actuar.
          </li>
        </ol>
        {error ? (
          <StatusBanner error>
            No se pudo cargar el manifiesto de la skill. La guía de texto sigue
            disponible, pero no instales el paquete sin verificar su digest.
          </StatusBanner>
        ) : manifest && archiveUrl ? (
          <div className="onboarding-release">
            <p>
              <strong>Skill publicada:</strong> {manifest.version} ·{" "}
              {manifest.files} ficheros
            </p>
            <p className="mono">SHA-256: {manifest.sha256}</p>
            <div className="page-actions">
              <a className="button button-primary" href={archiveUrl} download>
                Descargar skill {manifest.version}
              </a>
              <a
                className="button button-secondary"
                href="/downloads/issopen-skill-manifest.json"
              >
                Ver manifiesto
              </a>
            </div>
            {install ? (
              <>
                <h3>Instalación verificable</h3>
                <pre>{install}</pre>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void copy("install", install)}
                >
                  Copiar instalación
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <p aria-live="polite">Cargando revisión de la skill…</p>
        )}
      </section>

      <section aria-labelledby="agent-connect">
        <h2 id="agent-connect">
          Codex y ChatGPT se conectan de forma distinta
        </h2>
        <div className="public-feature-grid onboarding-methods">
          <div>
            <h3>Codex</h3>
            <p>
              Usa una API key MCP nombrada, revocable y acotada, leída desde la
              variable <code>ISSOPEN_AGENT_TOKEN</code>. El endpoint es:
            </p>
            <p className="mono">{mcpUrl}</p>
          </div>
          <div>
            <h3>ChatGPT</h3>
            <p>
              Usa el mismo endpoint mediante OAuth 2.1 y consentimiento. No
              reutiliza el PAT de Codex ni una contraseña de usuario.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="agent-keys">
        <h2 id="agent-keys">Una identidad, una clave por consumidor</h2>
        <p>
          La identidad define los proyectos y scopes. Sus API keys son secretos
          independientes para cada instalación de Codex, editor, runner o
          servicio: todas heredan los permisos actuales de la identidad, pero
          cada una conserva su propio nombre, caducidad, último uso y estado de
          revocación.
        </p>
        <ol className="connection-steps">
          <li>
            En <strong>Agents</strong>, abre una identidad PAT y pulsa
            <strong> Create API key</strong>. Usa una etiqueta reconocible como
            <code> VS Code portátil</code> o <code>CI producción</code>.
          </li>
          <li>
            Copia el token durante el revelado único y guárdalo en el almacén de
            secretos del consumidor como <code>ISSOPEN_AGENT_TOKEN</code>.
          </li>
          <li>
            Reinicia el cliente y valida <code>get_agent_context</code>. La
            identidad, los proyectos y los scopes deben coincidir con lo
            esperado antes de trabajar.
          </li>
          <li>
            Para rotar, crea y valida primero la clave nueva; después revoca
            sólo la anterior. Las demás claves continúan funcionando.
          </li>
        </ol>
        <StatusBanner>
          Una identidad admite hasta 10 claves activas.{" "}
          <strong>Revoke key</strong>
          afecta sólo a ese consumidor; <strong>Revoke access</strong> invalida
          toda la identidad y todas sus claves. <strong>Primary</strong> es el
          nombre de una credencial anterior migrada, no una clave que deba
          compartirse. Ninguna API key MCP autoriza la API REST humana.
        </StatusBanner>
      </section>

      <section aria-labelledby="agent-modes">
        <h2 id="agent-modes">Tres modos explícitos</h2>
        <dl className="onboarding-modes">
          <div>
            <dt>Consultar</dt>
            <dd>Leer y resumir sin crear, reclamar ni actualizar trabajo.</dd>
          </div>
          <div>
            <dt>Planificar</dt>
            <dd>Crear o concretar tickets y preguntas, sin implementar.</dd>
          </div>
          <div>
            <dt>Ejecutar</dt>
            <dd>
              Reclamar un Ready elegible, verificar, enlazar el resultado,
              devolverlo a Ready for Human Review y liberar el claim.
            </dd>
          </div>
        </dl>
        <p>
          Pasar a Done exige el scope <code>issues:close</code> y autorización
          humana explícita.
        </p>
        <h3>Prompt inicial</h3>
        <pre>{starterPrompt}</pre>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void copy("prompt", starterPrompt)}
        >
          Copiar prompt inicial
        </Button>
      </section>

      <section aria-labelledby="agent-machine">
        <h2 id="agent-machine">Documentación para máquinas</h2>
        <p>
          Un agente puede recibir cualquiera de estas URLs como punto de
          entrada:
        </p>
        <ul className="onboarding-links">
          <li>
            <a href={machineGuide}>{machineGuide}</a>
          </li>
          <li>
            <a href={jsonGuide}>{jsonGuide}</a>
          </li>
          <li>
            <a href="/llms.txt">{new URL("/llms.txt", origin).toString()}</a>
          </li>
        </ul>
      </section>
    </article>
  );
}
