import type { ComposerModel } from "./useComposer";

export function InlineCreation({ model }: { model: ComposerModel }) {
  return (
    <fieldset
      className="create-destination"
      disabled={model.locked || model.imageBusy}
    >
      <fieldset className="create-shortcuts" aria-label="Crear proyecto o Epic">
        {(model.canCreateProjects
          ? (["project", "epic"] as const)
          : (["epic"] as const)
        ).map((target) => (
          <button
            key={target}
            id={`create-${target}-toggle`}
            type="button"
            className="create-shortcut"
            aria-label={
              target === "project" ? "Crear proyecto aquí" : "Crear Epic aquí"
            }
            aria-expanded={model.createPanel === target}
            aria-controls={`create-${target}-panel`}
            onClick={() => model.toggleCreatePanel(target)}
          >
            <span className="create-shortcut-icon" aria-hidden="true">
              {model.createPanel === target ? "−" : "+"}
            </span>
            {target === "project" ? "Crear proyecto" : "Crear Epic"}
          </button>
        ))}
      </fieldset>
      {model.canCreateProjects && (
        <section
          id="create-project-panel"
          className="create-inline-panel"
          aria-labelledby="create-project-toggle"
          hidden={model.createPanel !== "project"}
        >
          <label>
            Nombre del nuevo proyecto
            <input
              maxLength={120}
              value={model.projectName}
              onChange={(event) => model.setProjectName(event.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={!model.writable || !model.projectName.trim()}
            onClick={() => void model.createContainer("project")}
          >
            Crear proyecto
          </button>
        </section>
      )}
      <section
        id="create-epic-panel"
        className="create-inline-panel"
        aria-labelledby="create-epic-toggle"
        hidden={model.createPanel !== "epic"}
      >
        <p className="create-inline-hint">
          {model.form.projectId
            ? `En el proyecto ${model.projects.find((project) => project.id === model.form.projectId)?.name ?? "seleccionado"}.`
            : "Selecciona primero un proyecto en el formulario inferior."}
        </p>
        <label>
          Título del nuevo Epic
          <input
            maxLength={240}
            value={model.epicTitle}
            onChange={(event) => model.setEpicTitle(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={
            !model.writable || !model.form.projectId || !model.epicTitle.trim()
          }
          onClick={() => void model.createContainer("epic")}
        >
          Crear Epic
        </button>
      </section>
    </fieldset>
  );
}
