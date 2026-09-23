import type { AccountResponse } from "../../lib/account";
import { CreationResult } from "./composer/CreationResult";
import { InlineCreation } from "./composer/InlineCreation";
import { TicketForm } from "./composer/TicketForm";
import { useComposer } from "./composer/useComposer";
import { Images } from "./Images";

export function Workspace({ account }: { account: AccountResponse | null }) {
  const model = useComposer(account);
  if (!model.ready) return <p role="status">Recuperando borrador…</p>;

  return (
    <>
      {!model.created ? (
        <Images
          key={model.generation}
          images={model.images}
          onChange={model.changeImages}
          onBusy={model.setImageBusy}
          disabled={model.locked}
        />
      ) : null}
      <section aria-labelledby="composer-heading">
        <h2 id="composer-heading">Crear ticket</h2>
        {model.readOnly ? (
          <p role="status" className="notice">
            Esta instalación no tiene permiso para crear tickets ni Epics. Pide
            al Owner acceso de edición a un proyecto y actualiza tu cuenta; si
            la vinculaste sólo para lectura, vuelve a conectarla con permiso de
            creación. Tu borrador sigue guardado aquí.
          </p>
        ) : null}
        {!model.created && !model.readOnly ? (
          <InlineCreation model={model} />
        ) : null}
        {model.storageError ? (
          <p role="alert" className="error">
            No se pudo guardar el borrador local. No cierres este panel.
          </p>
        ) : null}
        {model.mismatch ? (
          <p role="alert" className="error">
            Este borrador pertenece a otra cuenta/workspace. Reconecta esa
            cuenta o descártalo.
          </p>
        ) : null}
        {model.error ? (
          <p role="alert" className="error">
            {model.error}
          </p>
        ) : null}
        {model.created ? (
          <CreationResult
            created={model.created}
            onPrepareAnother={model.prepareAnother}
          />
        ) : (
          <TicketForm model={model} />
        )}
        <button
          type="button"
          className="secondary"
          disabled={model.busy || model.imageBusy}
          onClick={() => void model.discard()}
        >
          Descartar borrador
        </button>
      </section>
    </>
  );
}
