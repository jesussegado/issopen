import { useCallback, useEffect, useState } from "react";
import { Button, PageHeading, StatusBanner } from "../components/ui.js";
import { apiRequest } from "../lib/api.js";

type Installation = {
  id: string;
  name: string;
  active: boolean;
  expiresAt: string | null;
};

export function ExtensionsRoute({ linking = false }: { linking?: boolean }) {
  const params = new URLSearchParams(window.location.search);
  const [name, setName] = useState("Mi Chrome");
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(
    () =>
      apiRequest<{ installations: Installation[] }>("/api/v1/extensions").then(
        (r) => setInstallations(r.installations),
      ),
    [],
  );
  useEffect(() => {
    refresh()
      .catch(() =>
        setError(
          "No se pudieron cargar las conexiones. Recarga para intentarlo de nuevo.",
        ),
      )
      .finally(() => setLoading(false));
  }, [refresh]);
  async function link() {
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ authorizeUrl: string }>(
        "/api/v1/extensions/link",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            installationId: params.get("installationId"),
            extensionId: params.get("extensionId"),
            state: params.get("state"),
            challenge: params.get("challenge"),
          }),
        },
      );
      const destination = new URL(result.authorizeUrl);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname !== "/api/auth/oauth2/authorize"
      )
        throw new Error("Invalid authorization URL");
      window.location.assign(destination.toString());
    } catch {
      setError(
        "No se pudo iniciar la vinculación. Vuelve a la extensión e inténtalo de nuevo.",
      );
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/v1/extensions/${encodeURIComponent(id)}/revoke`, {
        method: "POST",
      });
      await refresh();
    } catch {
      setError("No se pudo revocar la instalación. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="reading-column">
      <PageHeading>
        {linking ? "Vincular Chrome con Issopen" : "Extensiones conectadas"}
      </PageHeading>
      {error && <StatusBanner error>{error}</StatusBanner>}
      {linking && (
        <form
          className="detail-panel"
          onSubmit={(e) => {
            e.preventDefault();
            void link();
          }}
        >
          <p>
            Conecta sólo una extensión de Issopen que hayas instalado tú. El
            siguiente paso muestra los permisos para que puedas aceptarlos o
            rechazarlos.
          </p>
          <p>
            Identificador de Chrome:{" "}
            <code>{params.get("extensionId")?.slice(0, 32)}</code>
          </p>
          <label className="field">
            Nombre de esta instalación
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p>
            La vinculación caduca a los 30 días. Puedes revocarla aquí sin
            afectar otros navegadores ni agentes.
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? "Continuando…" : "Continuar al consentimiento"}
          </Button>
        </form>
      )}
      <section className="detail-panel" aria-labelledby="extensions-list">
        <h2 id="extensions-list">Tus instalaciones</h2>
        {loading ? (
          <p>Cargando conexiones…</p>
        ) : installations.length === 0 ? (
          <p>
            No hay instalaciones vinculadas. Pulsa «Conectar con Issopen» en el
            panel de Chrome.
          </p>
        ) : (
          <ul>
            {installations.map((item) => (
              <li key={item.id}>
                <p>
                  <strong>{item.name}</strong> ·{" "}
                  {item.active ? "Activa" : "Revocada o caducada"}
                </p>
                {item.expiresAt && (
                  <p>Caduca: {new Date(item.expiresAt).toLocaleString()}</p>
                )}
                {item.active && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void revoke(item.id)}
                  >
                    Revocar {item.name}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
