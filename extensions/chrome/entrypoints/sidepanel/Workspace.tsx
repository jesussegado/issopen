import { useCallback, useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import {
  type CaptureSubmission,
  captureSubmissionSchema,
  formatDom,
  structuralSelector,
} from "../../../../src/shared/capture-contract";
import type { AccountResponse } from "../../lib/account";
import {
  clearDraft,
  type Draft,
  draftLifetime,
  draftSchema,
  loadDraft,
  type ReviewedEvidence,
  saveDraft,
} from "../../lib/draft";
import { instanceUrl } from "../../lib/instance";
import {
  type TicketRequest,
  ticketErrors,
  ticketResponseSchema,
} from "../../lib/tickets";
import { Images } from "./Images";
import { SelectField } from "./SelectField";

type Project = { id: string; name: string };
type Epic = { id: string; number: number; title: string };
const initialForm: Draft["form"] = {
  projectId: "",
  epicId: "",
  title: "",
  description: "",
  priority: "medium",
  status: "backlog",
};
async function request(message: TicketRequest) {
  try {
    return ticketResponseSchema.parse(
      await browser.runtime.sendMessage(message),
    );
  } catch {
    return { ok: false, code: "network" } as const;
  }
}
export function Workspace({ account }: { account: AccountResponse | null }) {
  const [form, setForm] = useState(initialForm);
  const [evidence, setEvidence] = useState<ReviewedEvidence | null>(null);
  const [pending, setPending] = useState<CaptureSubmission | null>(null);
  const [inline, setInline] = useState<TicketRequest | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [projectName, setProjectName] = useState("");
  const [epicTitle, setEpicTitle] = useState("");
  const [createPanel, setCreatePanel] = useState<"project" | "epic" | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{
    id: string;
    number: number;
    title: string;
    url: string;
    attachmentCount: number;
  } | null>(null);
  const [generation, setGeneration] = useState(0);
  const [imageBusy, setImageBusy] = useState(false);
  const [epicReload, setEpicReload] = useState(0);
  const [epicLoading, setEpicLoading] = useState(false);
  const gate = useRef(false);
  const connected = account?.ok && account.connected ? account : null;
  const connectedUserId = connected?.userId ?? connected?.ownerId;
  const identity =
    connectedUserId && connected?.workspaceId
      ? `${connectedUserId}:${connected.workspaceId}`
      : null;
  // Older servers do not announce workspaceRole and only supported owners.
  const canCreateProjects = connected?.workspaceRole !== "member";
  const mismatch = Boolean(owner && identity && owner !== identity);
  const locked = busy || Boolean(pending || inline || created) || mismatch;
  const writable = Boolean(
    connected?.canWrite && connected.apiVersion === 1 && identity && !mismatch,
  );
  const changeImages = useCallback((images: string[]) => {
    setEvidence((previous) =>
      images.length || previous?.metadata
        ? { image: null, images, metadata: previous?.metadata ?? null }
        : null,
    );
  }, []);
  const images = evidence?.images ?? (evidence?.image ? [evidence.image] : []);
  const supportsImages = images.length <= (connected?.maxImages ?? 1);
  useEffect(() => {
    let alive = true;
    loadDraft()
      .then(async (draft) => {
        if (!alive) return;
        if (draft) {
          setForm(draft.form);
          setEvidence(draft.evidence);
          setPending(draft.pending);
          setInline(draft.inline);
          setOwner(draft.owner);
        } else {
          const preferences =
            await browser.storage.local.get("ticket-destination");
          const value = draftSchema.shape.form
            .pick({ projectId: true, epicId: true })
            .safeParse(preferences["ticket-destination"]);
          if (alive && value.success)
            setForm({
              ...initialForm,
              projectId: value.data.projectId,
              epicId: value.data.epicId,
            });
        }
      })
      .catch(() => {
        if (alive) setStorageError(true);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (connected) setProjects(connected.projects);
  }, [connected]);
  useEffect(() => {
    if (ready && identity && !owner) setOwner(identity);
  }, [ready, identity, owner]);
  useEffect(() => {
    if (!ready || busy || created) return;
    const timer = setTimeout(() => {
      void saveDraft({
        version: 1,
        expiresAt: Date.now() + draftLifetime,
        owner,
        form,
        evidence,
        pending,
        inline,
      })
        .then(() => setStorageError(false))
        .catch(() => setStorageError(true));
    }, 150);
    return () => clearTimeout(timer);
  }, [ready, busy, created, owner, form, evidence, pending, inline]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: manual refresh must retry unchanged project IDs.
  useEffect(() => {
    if (!connected || !form.projectId) {
      setEpics([]);
      setEpicLoading(false);
      return;
    }
    let alive = true;
    setEpicLoading(true);
    void request({
      type: "tickets",
      version: 1,
      action: "epics",
      projectId: form.projectId,
    }).then((r) => {
      if (!alive) return;
      setEpicLoading(false);
      if (r.ok && "epics" in r) {
        setEpics(r.epics);
        setError("");
      } else if (!r.ok) setError(ticketErrors[r.code]);
    });
    return () => {
      alive = false;
    };
  }, [form.projectId, connected, epicReload]);
  function snapshot(next: Partial<Draft> = {}): Draft {
    return {
      version: 1,
      expiresAt: Date.now() + draftLifetime,
      owner: owner ?? identity,
      form,
      evidence,
      pending,
      inline,
      ...next,
    };
  }
  async function send() {
    if (
      gate.current ||
      !writable ||
      inline ||
      created ||
      imageBusy ||
      !supportsImages
    )
      return;
    const parsed = captureSubmissionSchema.safeParse(
      pending ?? {
        version: 1,
        idempotencyKey: crypto.randomUUID(),
        ...form,
        epicId: form.epicId || null,
        metadata: evidence?.metadata ?? null,
        image: images.length === 1 ? images[0] : null,
        ...(images.length > 1 ? { images } : {}),
      },
    );
    if (!parsed.success) {
      setError(
        "Selecciona proyecto y completa el título; revisa los límites del ticket.",
      );
      return;
    }
    gate.current = true;
    setBusy(true);
    setError("");
    const payload = parsed.data;
    setPending(payload);
    try {
      await saveDraft(snapshot({ pending: payload }));
      const response = await request({
        type: "tickets",
        version: 1,
        action: "capture",
        payload,
      });
      if (!response.ok) {
        setError(ticketErrors[response.code]);
        if (["validation", "size", "not_found"].includes(response.code))
          setPending(null);
        return;
      }
      if (!("issue" in response)) throw new Error();
      setCreated({ ...response.issue, attachmentCount: images.length });
      setPending(null);
      // The confirmed images now belong to the server-side ticket. Keeping an
      // editable thumbnail here made its disabled remove button look stuck and
      // incorrectly claimed the image had not been sent.
      setEvidence(null);
      await clearDraft();
      await browser.storage.local.set({
        "ticket-destination": {
          projectId: form.projectId,
          epicId: form.epicId,
        },
      });
    } catch {
      setStorageError(true);
      setError(
        "No se pudo confirmar el guardado local. Conserva este panel; un reintento mantiene la misma clave.",
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function createContainer(action: "project" | "epic") {
    if (
      gate.current ||
      !writable ||
      pending ||
      created ||
      imageBusy ||
      (action === "project" && !canCreateProjects)
    )
      return;
    const message =
      inline ??
      (action === "project"
        ? ({
            version: 1,
            type: "tickets",
            action,
            name: projectName,
            idempotencyKey: crypto.randomUUID(),
          } as const)
        : ({
            version: 1,
            type: "tickets",
            action,
            title: epicTitle,
            projectId: form.projectId,
            idempotencyKey: crypto.randomUUID(),
          } as const));
    gate.current = true;
    setBusy(true);
    setInline(message);
    setError("");
    try {
      await saveDraft(snapshot({ inline: message }));
      const result = await request(message);
      if (!result.ok) {
        setError(ticketErrors[result.code]);
        if (["validation", "not_found"].includes(result.code)) setInline(null);
        return;
      }
      if ("project" in result) {
        setProjects((rows) => [
          ...rows.filter((p) => p.id !== result.project.id),
          result.project,
        ]);
        setForm((f) => ({ ...f, projectId: result.project.id, epicId: "" }));
        setProjectName("");
      }
      if ("epic" in result) {
        setEpics((rows) => [
          ...rows.filter((e) => e.id !== result.epic.id),
          result.epic,
        ]);
        setForm((f) => ({ ...f, epicId: result.epic.id }));
        setEpicTitle("");
      }
      setInline(null);
    } catch {
      setStorageError(true);
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function discard() {
    if (imageBusy || busy) return;
    if (
      !window.confirm(
        pending || inline
          ? "El servidor podría haber creado ya el ticket/proyecto/Epic. Revisa Issopen antes de crear otro. ¿Borrar el borrador y la clave de reintento?"
          : "¿Borrar el borrador y las imágenes adjuntas de este navegador?",
      )
    )
      return;
    try {
      await clearDraft();
      setPending(null);
      setInline(null);
      setEvidence(null);
      setOwner(identity);
      setCreated(null);
      setForm({
        ...initialForm,
        projectId: form.projectId,
        epicId: form.epicId,
      });
      setGeneration((g) => g + 1);
      setError("");
    } catch {
      setStorageError(true);
    }
  }
  return (
    <>
      {!ready ? (
        <p role="status">Recuperando borrador…</p>
      ) : (
        <>
          {!created ? (
            <Images
              key={generation}
              images={images}
              onChange={changeImages}
              onBusy={setImageBusy}
              disabled={locked}
            />
          ) : null}
          <section aria-labelledby="composer-heading">
            <h2 id="composer-heading">Crear ticket</h2>
            {!created && (
              <fieldset
                className="create-destination"
                disabled={locked || imageBusy}
              >
                <fieldset
                  className="create-shortcuts"
                  aria-label="Crear proyecto o Epic"
                >
                  {(canCreateProjects
                    ? (["project", "epic"] as const)
                    : (["epic"] as const)
                  ).map((target) => (
                    <button
                      key={target}
                      id={`create-${target}-toggle`}
                      type="button"
                      className="create-shortcut"
                      aria-label={
                        target === "project"
                          ? "Crear proyecto aquí"
                          : "Crear Epic aquí"
                      }
                      aria-expanded={createPanel === target}
                      aria-controls={`create-${target}-panel`}
                      onClick={() =>
                        setCreatePanel((current) =>
                          current === target ? null : target,
                        )
                      }
                    >
                      <span className="create-shortcut-icon" aria-hidden="true">
                        {createPanel === target ? "−" : "+"}
                      </span>
                      {target === "project" ? "Crear proyecto" : "Crear Epic"}
                    </button>
                  ))}
                </fieldset>
                {canCreateProjects && (
                  <section
                    id="create-project-panel"
                    className="create-inline-panel"
                    aria-labelledby="create-project-toggle"
                    hidden={createPanel !== "project"}
                  >
                    <label>
                      Nombre del nuevo proyecto
                      <input
                        maxLength={120}
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!writable || !projectName.trim()}
                      onClick={() => void createContainer("project")}
                    >
                      Crear proyecto
                    </button>
                  </section>
                )}
                <section
                  id="create-epic-panel"
                  className="create-inline-panel"
                  aria-labelledby="create-epic-toggle"
                  hidden={createPanel !== "epic"}
                >
                  <p className="create-inline-hint">
                    {form.projectId
                      ? `En el proyecto ${projects.find((p) => p.id === form.projectId)?.name ?? "seleccionado"}.`
                      : "Selecciona primero un proyecto en el formulario inferior."}
                  </p>
                  <label>
                    Título del nuevo Epic
                    <input
                      maxLength={240}
                      value={epicTitle}
                      onChange={(e) => setEpicTitle(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!writable || !form.projectId || !epicTitle.trim()}
                    onClick={() => void createContainer("epic")}
                  >
                    Crear Epic
                  </button>
                </section>
              </fieldset>
            )}
            {storageError && (
              <p role="alert" className="error">
                No se pudo guardar el borrador local. No cierres este panel.
              </p>
            )}
            {mismatch && (
              <p role="alert" className="error">
                Este borrador pertenece a otra cuenta/workspace. Reconecta esa
                cuenta o descártalo.
              </p>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {created ? (
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
                <button
                  type="button"
                  onClick={() => {
                    setCreated(null);
                    setEvidence(null);
                    setForm({
                      ...initialForm,
                      projectId: form.projectId,
                      epicId: form.epicId,
                    });
                    setGeneration((g) => g + 1);
                  }}
                >
                  Preparar otro ticket
                </button>
              </div>
            ) : (
              <>
                <fieldset disabled={locked}>
                  <SelectField
                    label="Proyecto"
                    searchable
                    required
                    disabled={locked}
                    value={form.projectId}
                    onChange={(value) => {
                      setForm({ ...form, projectId: value, epicId: "" });
                      setEpics([]);
                    }}
                    options={[
                      { value: "", label: "Selecciona proyecto" },
                      ...projects.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                  <SelectField
                    label="Epic"
                    searchable
                    disabled={locked}
                    value={form.epicId}
                    missingLabel={
                      epicLoading
                        ? "Cargando Epic guardado…"
                        : "Epic guardado no disponible; actualiza o elige otro"
                    }
                    onChange={(value) => setForm({ ...form, epicId: value })}
                    options={[
                      { value: "", label: "Sin Epic" },
                      ...epics.map((e) => ({
                        value: e.id,
                        label: `${e.number}-${e.title}`,
                      })),
                    ]}
                  />
                  {epicLoading && <p role="status">Cargando Epics…</p>}
                  <button
                    type="button"
                    className="secondary refresh-epics"
                    onClick={() => setEpicReload((v) => v + 1)}
                  >
                    Actualizar Epics
                  </button>
                  <label>
                    Título
                    <input
                      required
                      maxLength={240}
                      value={form.title}
                      onChange={(e) =>
                        setForm({ ...form, title: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Descripción
                    <textarea
                      maxLength={50000}
                      rows={5}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                    />
                  </label>
                  <SelectField
                    label="Prioridad"
                    disabled={locked}
                    value={form.priority}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        priority:
                          captureSubmissionSchema.shape.priority.parse(value),
                      })
                    }
                    options={["low", "medium", "high", "urgent"].map(
                      (value) => ({
                        value,
                        label: value,
                      }),
                    )}
                  />
                  <SelectField
                    label="Estado"
                    disabled={locked}
                    value={form.status}
                    onChange={(value) =>
                      setForm({
                        ...form,
                        status:
                          captureSubmissionSchema.shape.status.parse(value),
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
                {evidence?.metadata && (
                  <div className="final-evidence">
                    <h3>Contexto de un borrador anterior</h3>
                    {evidence.metadata?.url && <p>{evidence.metadata.url}</p>}
                    {evidence.metadata?.element && (
                      <code>
                        {structuralSelector(evidence.metadata.element)}
                      </code>
                    )}
                    {evidence.metadata?.dom && (
                      <details>
                        <summary>DOM que se enviará</summary>
                        <pre>{formatDom(evidence.metadata.dom)}</pre>
                      </details>
                    )}
                    <button
                      type="button"
                      disabled={locked || imageBusy}
                      className="secondary"
                      onClick={() => {
                        setEvidence({ image: null, images, metadata: null });
                      }}
                    >
                      Quitar contexto de página
                    </button>
                  </div>
                )}
                {!supportsImages && connected && (
                  <p className="notice">
                    Este servidor todavía no admite varias imágenes. Actualiza
                    Issopen y vuelve a abrir el panel. Tu borrador se conserva.
                  </p>
                )}
                {pending && (
                  <p className="notice">
                    Envío pendiente de confirmar. El contenido está bloqueado
                    para reintentar sin duplicados.
                  </p>
                )}
                <p className="submission-disclosure">
                  Sólo al pulsar «Enviar ticket» se transmitirán por HTTPS los
                  campos y {images.length === 1 ? "la imagen" : "las imágenes"}
                  {images.length ? " seleccionadas" : " que hayas añadido"}.{" "}
                  <a
                    href={`${instanceUrl}/privacy`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Privacidad y datos
                  </a>
                  .
                </p>
                {inline ? (
                  <button
                    type="button"
                    disabled={busy || imageBusy || !writable}
                    onClick={() =>
                      void createContainer(
                        inline.action === "project" ? "project" : "epic",
                      )
                    }
                  >
                    Reintentar creación pendiente
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !writable ||
                      imageBusy ||
                      !supportsImages ||
                      !form.projectId ||
                      !form.title.trim()
                    }
                    onClick={() => void send()}
                  >
                    {busy
                      ? "Enviando…"
                      : pending
                        ? "Reintentar envío"
                        : "Enviar ticket"}
                  </button>
                )}
                {!writable && (
                  <p>Conecta Issopen con permiso de creación para enviar.</p>
                )}
              </>
            )}
            <button
              type="button"
              className="secondary"
              disabled={busy || imageBusy}
              onClick={() => void discard()}
            >
              Descartar borrador
            </button>
          </section>
        </>
      )}
    </>
  );
}
