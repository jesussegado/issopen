import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { instanceUrl } from "../../lib/instance";
import "./information.css";

// A UI preference only: never read or rewrite account/draft storage here.
export const informationDismissedKey = "issopen-information-dismissed-v1";

export function InformationContent() {
  return (
    <div className="information-content">
      <p>
        Pega un recorte con Ctrl+V (⌘V en Mac) o sube imágenes de tu equipo.
        Elige proyecto y Epic, completa el título y envía el ticket.
      </p>
      <p>
        Revisa y oculta los datos sensibles antes de adjuntar. Las imágenes sólo
        se suben al pulsar Enviar ticket; nunca automáticamente.
      </p>
      <p>
        Los campos y las imágenes que añadas se guardan como un único borrador
        local durante 24 horas desde el último cambio. No leemos la página ni tu
        portapapeles automáticamente.
      </p>
      <p>
        Consulta qué datos se conservan y cómo borrarlos en la{" "}
        <a href={`${instanceUrl}/privacy`} target="_blank" rel="noreferrer">
          política de privacidad y datos
        </a>
        .
      </p>
    </div>
  );
}

export function InformationNotice({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    let active = true;
    let changed = false;
    const onChange = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area !== "local" || !(informationDismissedKey in changes)) return;
      changed = true;
      setVisible(changes[informationDismissedKey]?.newValue !== true);
    };
    browser.storage.onChanged.addListener(onChange);
    void browser.storage.local.get(informationDismissedKey).then(
      (value) => {
        if (active && !changed)
          setVisible(value[informationDismissedKey] !== true);
      },
      () => {
        if (active && !changed) setVisible(true);
      },
    );
    return () => {
      active = false;
      browser.storage.onChanged.removeListener(onChange);
    };
  }, []);
  function dismiss() {
    setVisible(false);
    onDismiss();
    void browser.storage.local
      .set({ [informationDismissedKey]: true })
      .catch(() => setStorageError(true));
  }
  return (
    <>
      {visible && (
        <aside className="info-notice" aria-labelledby="info-notice-heading">
          <div className="info-notice-heading">
            <h2 id="info-notice-heading">De una imagen a un ticket</h2>
            <button
              type="button"
              className="secondary"
              aria-label="Cerrar aviso informativo"
              onClick={dismiss}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <InformationContent />
          <p className="info-location">
            Siempre disponible en Cuenta → Ayuda e información.
          </p>
        </aside>
      )}
      {storageError && (
        <p role="status" className="info-location">
          Aviso cerrado por ahora. No pudimos recordar la preferencia y podría
          volver a aparecer al abrir el panel. La ayuda sigue en Cuenta.
        </p>
      )}
    </>
  );
}
