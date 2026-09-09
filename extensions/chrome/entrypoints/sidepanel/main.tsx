import { useState } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import {
  errorMessages,
  type InspectRequest,
  type InspectResponse,
  inspectResponseSchema,
} from "../../lib/protocol";
import "./style.css";
import { Account } from "./Account";

function App() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InspectResponse | null>(null);

  async function inspect() {
    setBusy(true);
    setResult(null);
    try {
      const raw: unknown = await browser.runtime.sendMessage({
        version: 1,
        type: "inspect-active-tab",
      } satisfies InspectRequest);
      const parsed = inspectResponseSchema.safeParse(raw);
      setResult(
        parsed.success ? parsed.data : { ok: false, code: "invalid-message" },
      );
    } catch {
      setResult({ ok: false, code: "unavailable" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <img src="/icon.png" width="44" height="44" alt="" />
        <div>
          <strong>Issopen</strong>
          <p>Captura desde tu navegador</p>
        </div>
      </header>
      <p className="badge">
        Base de desarrollo · {browser.runtime.getManifest().version}
      </p>
      <section aria-labelledby="start-heading">
        <h1 id="start-heading">De la web a un ticket</h1>
        <p>
          Estamos construyendo el flujo de captura, revisión y envío. Esta
          versión permite comprobar la conexión del panel con tu pestaña.
        </p>
        <p className="notice">
          Ya puedes conectar tu cuenta. La captura y el envío de tickets se
          incorporarán en los siguientes cortes.
        </p>
      </section>
      <Account />
      <section aria-labelledby="page-heading">
        <h2 id="page-heading">Comprueba la página</h2>
        <p>
          Abre Issopen desde su icono en una página web. Al comprobarla, sólo
          leemos su origen, tamaño de pantalla y densidad de píxeles.
        </p>
        <p>
          No leemos contenido, formularios ni credenciales. Los datos se quedan
          en este panel y no se guardan ni se envían.
        </p>
        <button type="button" onClick={() => void inspect()} disabled={busy}>
          {busy ? "Comprobando…" : "Comprobar página"}
        </button>
        <div aria-live="polite" aria-atomic="true">
          {result?.ok && (
            <div className="result">
              <h3>Página comprobada</h3>
              <dl>
                <dt>Origen</dt>
                <dd>{result.context.origin}</dd>
                <dt>Viewport</dt>
                <dd>
                  {result.context.viewport.width} ×{" "}
                  {result.context.viewport.height} px
                </dd>
                <dt>Densidad</dt>
                <dd>{result.context.viewport.devicePixelRatio}×</dd>
              </dl>
              <p>
                Es una comprobación puntual. Si cambias de página, vuelve a
                comprobarla.
              </p>
              <button
                className="secondary"
                type="button"
                onClick={() => setResult(null)}
              >
                Borrar comprobación
              </button>
            </div>
          )}
          {result && !result.ok && (
            <p className="error" role="alert">
              {errorMessages[result.code]}
            </p>
          )}
        </div>
      </section>
      <footer>Acceso temporal a la pestaña · Sin acceso en incógnito</footer>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing extension root");
createRoot(root).render(<App />);
