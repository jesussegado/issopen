import {
  captureSubmissionSchema,
  formatDom,
  structuralSelector,
} from "../../../../../src/shared/capture-contract";
import { instanceUrl } from "../../../lib/instance";
import { SelectField } from "../SelectField";
import { DestinationSelector } from "./DestinationSelector";
import type { ComposerModel } from "./useComposer";

export function TicketForm({ model }: { model: ComposerModel }) {
  return (
    <>
      <fieldset disabled={model.locked}>
        <DestinationSelector model={model} />
        <label>
          Título
          <input
            required
            maxLength={240}
            value={model.form.title}
            onChange={(event) =>
              model.updateForm({ title: event.target.value })
            }
          />
        </label>
        <label>
          Descripción
          <textarea
            maxLength={50000}
            rows={5}
            value={model.form.description}
            onChange={(event) =>
              model.updateForm({ description: event.target.value })
            }
          />
        </label>
        <SelectField
          label="Prioridad"
          disabled={model.locked}
          value={model.form.priority}
          onChange={(value) =>
            model.updateForm({
              priority: captureSubmissionSchema.shape.priority.parse(value),
            })
          }
          options={["low", "medium", "high", "urgent"].map((value) => ({
            value,
            label: value,
          }))}
        />
        <SelectField
          label="Estado"
          disabled={model.locked}
          value={model.form.status}
          onChange={(value) =>
            model.updateForm({
              status: captureSubmissionSchema.shape.status.parse(value),
            })
          }
          options={[
            "backlog",
            "ready",
            "in_progress",
            "ready_for_review",
            "done",
          ].map((value) => ({ value, label: value }))}
        />
      </fieldset>
      {model.evidence?.metadata && (
        <div className="final-evidence">
          <h3>Contexto de un borrador anterior</h3>
          {model.evidence.metadata.url && <p>{model.evidence.metadata.url}</p>}
          {model.evidence.metadata.element && (
            <code>{structuralSelector(model.evidence.metadata.element)}</code>
          )}
          {model.evidence.metadata.dom && (
            <details>
              <summary>DOM que se enviará</summary>
              <pre>{formatDom(model.evidence.metadata.dom)}</pre>
            </details>
          )}
          <button
            type="button"
            disabled={model.locked || model.imageBusy}
            className="secondary"
            onClick={model.removeMetadata}
          >
            Quitar contexto de página
          </button>
        </div>
      )}
      {!model.supportsImages && model.connected && (
        <p className="notice">
          Este servidor todavía no admite varias imágenes. Actualiza Issopen y
          vuelve a abrir el panel. Tu borrador se conserva.
        </p>
      )}
      {model.pending && (
        <p className="notice">
          Envío pendiente de confirmar. El contenido está bloqueado para
          reintentar sin duplicados.
        </p>
      )}
      <p className="submission-disclosure">
        Sólo al pulsar «Enviar ticket» se transmitirán por HTTPS los campos y{" "}
        {model.images.length === 1 ? "la imagen" : "las imágenes"}
        {model.images.length ? " seleccionadas" : " que hayas añadido"}.{" "}
        <a href={`${instanceUrl}/privacy`} target="_blank" rel="noreferrer">
          Privacidad y datos
        </a>
        .
      </p>
      {model.readOnly ? null : model.inline ? (
        <button
          type="button"
          disabled={model.busy || model.imageBusy || !model.writable}
          onClick={() =>
            void model.createContainer(
              model.inline?.action === "project" ? "project" : "epic",
            )
          }
        >
          Reintentar creación pendiente
        </button>
      ) : (
        <button
          type="button"
          disabled={
            model.busy ||
            !model.writable ||
            model.imageBusy ||
            !model.supportsImages ||
            !model.form.projectId ||
            !model.form.title.trim()
          }
          onClick={() => void model.send()}
        >
          {model.busy
            ? "Enviando…"
            : model.pending
              ? "Reintentar envío"
              : "Enviar ticket"}
        </button>
      )}
      {!model.writable && !model.readOnly && (
        <p>Conecta Issopen con permiso de creación para enviar.</p>
      )}
    </>
  );
}
