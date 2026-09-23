import type { CreatedTicket } from "./model";

export function CreationResult({
  created,
  onPrepareAnother,
}: {
  created: CreatedTicket;
  onPrepareAnother: () => void;
}) {
  return (
    <div role="status">
      <h3>
        Ticket creado: {created.number}-{created.title}
      </h3>
      {created.attachmentCount > 0 ? (
        <p>
          {created.attachmentCount}{" "}
          {created.attachmentCount === 1
            ? "imagen adjunta enviada."
            : "imágenes adjuntas enviadas."}
        </p>
      ) : null}
      <a href={created.url} target="_blank" rel="noreferrer">
        Abrir ticket en Issopen
      </a>
      <button type="button" onClick={onPrepareAnother}>
        Preparar otro ticket
      </button>
    </div>
  );
}
