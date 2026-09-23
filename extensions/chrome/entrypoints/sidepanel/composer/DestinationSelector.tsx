import { SelectField } from "../SelectField";
import type { ComposerModel } from "./useComposer";

export function DestinationSelector({ model }: { model: ComposerModel }) {
  return (
    <>
      <SelectField
        label="Proyecto"
        searchable
        required
        disabled={model.locked}
        value={model.form.projectId}
        onChange={model.selectProject}
        options={[
          { value: "", label: "Selecciona proyecto" },
          ...model.projects.map((project) => ({
            value: project.id,
            label: project.name,
          })),
        ]}
      />
      <SelectField
        label="Epic"
        searchable
        disabled={model.locked}
        value={model.form.epicId}
        missingLabel={
          model.epicLoading
            ? "Cargando Epic guardado…"
            : "Epic guardado no disponible; actualiza o elige otro"
        }
        onChange={model.selectEpic}
        options={[
          { value: "", label: "Sin Epic" },
          ...model.epics.map((epic) => ({
            value: epic.id,
            label: `${epic.number}-${epic.title}`,
          })),
        ]}
      />
      {model.epicLoading && <p role="status">Cargando Epics…</p>}
      <button
        type="button"
        className="secondary refresh-epics"
        onClick={model.refreshEpics}
      >
        Actualizar Epics
      </button>
    </>
  );
}
