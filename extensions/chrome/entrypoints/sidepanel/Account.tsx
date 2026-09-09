import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { type AccountResponse, accountResponseSchema } from "../../lib/account";
import { instanceUrl } from "../../lib/instance";

export function Account() {
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const request = useCallback(
    async (
      type: "account-connect" | "account-disconnect" | "account-status",
    ) => {
      setBusy(true);
      try {
        setAccount(
          accountResponseSchema.parse(
            await browser.runtime.sendMessage({ version: 1, type }),
          ),
        );
      } catch {
        setAccount({
          ok: false,
          message:
            "El panel no pudo comunicarse con la extensión. Recárgala e inténtalo de nuevo.",
        });
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  useEffect(() => {
    void request("account-status");
  }, [request]);
  const connected = account?.ok && account.connected;
  return (
    <section aria-labelledby="account-heading">
      <h2 id="account-heading">Tu cuenta</h2>
      <p>{instanceUrl}</p>
      <div aria-live="polite">
        {account && !account.ok && (
          <p role="alert" className="error">
            {account.message}
          </p>
        )}
        {connected && (
          <>
            <p>
              Conectado como <strong>{account.name}</strong>
            </p>
            <p>
              Vinculación hasta{" "}
              {new Date(account.expiresAt).toLocaleDateString()}.
            </p>
            <h3>Proyectos disponibles ({account.projects.length})</h3>
            <ul>
              {account.projects.map((project) => (
                <li key={project.id}>{project.name}</li>
              ))}
            </ul>
          </>
        )}
        {busy && (
          <p>
            Comprobando conexión… Si se abre una ventana, completa allí el
            acceso y el consentimiento.
          </p>
        )}
      </div>
      {connected ? (
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void request("account-disconnect")}
        >
          Desconectar esta instalación
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void request("account-connect")}
        >
          Conectar con Issopen
        </button>
      )}
      <p>
        <a href={`${instanceUrl}/extensions`} target="_blank" rel="noreferrer">
          Gestionar instalaciones en Issopen
        </a>
      </p>
      <p>
        Tu contraseña se introduce sólo en la web de Issopen. La extensión no
        usa credenciales de agentes.
      </p>
    </section>
  );
}
