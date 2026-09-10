import { useCallback, useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { type AccountResponse, accountResponseSchema } from "../../lib/account";
import { instanceUrl } from "../../lib/instance";
import "./account.css";
import { InformationContent } from "./Information";

export function Account({
  onChange,
}: {
  onChange?: (account: AccountResponse) => void;
}) {
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
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
  const status = busy
    ? "Comprobando…"
    : !account?.ok
      ? "Revisar acceso"
      : connected
        ? account.canWrite
          ? "Conectada"
          : "Sólo lectura"
        : "Sin conectar";
  useEffect(() => {
    if (account) onChange?.(account);
  }, [account, onChange]);
  return (
    <>
      <button
        type="button"
        className="account-trigger"
        aria-label="Tu cuenta"
        aria-describedby="account-status"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="account-dialog"
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
        </svg>
        <span>
          Cuenta
          <small id="account-status" aria-live="polite">
            {status}
          </small>
        </span>
      </button>
      <dialog
        ref={dialog}
        id="account-dialog"
        className="account-dialog"
        aria-labelledby="account-heading"
        onClose={() => setOpen(false)}
      >
        <div className="account-dialog-heading">
          <h2 id="account-heading">Tu cuenta</h2>
          <button
            type="button"
            className="secondary account-close"
            aria-label="Cerrar cuenta"
            onClick={() => dialog.current?.close()}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p className="account-instance">{instanceUrl}</p>
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
              {!account.canWrite && (
                <p className="notice">
                  Esta conexión sólo permite lectura. Desconecta y vuelve a
                  conectar para autorizar tickets.
                </p>
              )}
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
          <a
            href={`${instanceUrl}/extensions`}
            target="_blank"
            rel="noreferrer"
          >
            Gestionar instalaciones en Issopen
          </a>
        </p>
        <p className="account-privacy">
          Tu contraseña se introduce sólo en la web de Issopen. La extensión no
          usa credenciales de agentes.
        </p>
        <section
          className="account-information"
          aria-labelledby="account-information-heading"
        >
          <h3 id="account-information-heading">Ayuda e información</h3>
          <InformationContent />
        </section>
      </dialog>
    </>
  );
}
