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
import {
  type TicketRequest,
  ticketErrors,
  ticketResponseSchema,
} from "../../lib/tickets";
import { Account } from "./Account";
import { Capture } from "./Capture";

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
export function Workspace() {
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [form, setForm] = useState(initialForm);
  const [evidence, setEvidence] = useState<ReviewedEvidence | null>(null);
  const [pending, setPending] = useState<CaptureSubmission | null>(null);
  const [inline, setInline] = useState<TicketRequest | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [search, setSearch] = useState("");
  const [epicSearch, setEpicSearch] = useState("");
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
  } | null>(null);
  const [generation, setGeneration] = useState(0);
  const [unreviewed, setUnreviewed] = useState(false);
  const [epicReload, setEpicReload] = useState(0);
  const gate = useRef(false);
  const connected = account?.ok && account.connected ? account : null;
  const identity =
    connected?.ownerId && connected.workspaceId
      ? `${connected.ownerId}:${connected.workspaceId}`
      : null;
  const mismatch = Boolean(owner && identity && owner !== identity);
  const locked = busy || Boolean(pending || inline || created) || mismatch;
  const writable = Boolean(
    connected?.canWrite && connected.apiVersion === 1 && identity && !mismatch,
  );
  const invalidate = useCallback(() => {
    setEvidence(null);
    setUnreviewed(true);
  }, []);
  const review = useCallback((value: ReviewedEvidence) => {
    setEvidence(value);
    setUnreviewed(false);
  }, []);
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
      return;
    }
    let alive = true;
    void request({
      type: "tickets",
      version: 1,
      action: "epics",
      projectId: form.projectId,
    }).then((r) => {
      if (!alive) return;
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
    if (gate.current || !writable || inline || created || unreviewed) return;
    const parsed = captureSubmissionSchema.safeParse(
      pending ?? {
        version: 1,
        idempotencyKey: crypto.randomUUID(),
        ...form,
        epicId: form.epicId || null,
        metadata: evidence?.metadata ?? null,
        image: evidence?.image ?? null,
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
      setCreated(response.issue);
      setPending(null);
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
    if (gate.current || !writable || pending || created) return;
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
    if (
      !window.confirm(
        pending || inline
          ? "El servidor podría haber creado ya el ticket/proyecto/Epic. Revisa Issopen antes de crear otro. ¿Borrar el borrador y la clave de reintento?"
          : "¿Borrar el borrador, la captura y todo su historial local?",
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
      setUnreviewed(false);
      setError("");
    } catch {
      setStorageError(true);
    }
  }
  return (
    <>
      <Account onChange={setAccount} />
      {!ready ? (
        <p role="status">Recuperando borrador…</p>
      ) : (
        <>
          <Capture
            key={generation}
            initialEvidence={evidence}
            onReview={review}
            onInvalidate={invalidate}
            disabled={locked}
          />
          <section aria-labelledby="composer-heading">
            <h2 id="composer-heading">Crear ticket</h2>
            {!created && (
              <fieldset className="create-destination" disabled={locked}>
                <fieldset
                  className="create-shortcuts"
                  aria-label="Crear proyecto o Epic"
                >
                  {(["project", "epic"] as const).map((target) => (
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
            <p className="notice">
              Un borrador local, hasta 24 horas desde el último cambio. Sólo se
              envía al pulsar Enviar ticket; nunca en segundo plano.
            </p>
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
                <a href={created.url} target="_blank" rel="noreferrer">
                  Abrir ticket en Issopen
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setCreated(null);
                    setEvidence(null);
                    setUnreviewed(false);
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
                  <label>
                    Buscar proyecto
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <label>
                    Proyecto
                    <select
                      required
                      aria-label="Proyecto"
                      value={form.projectId}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          projectId: e.target.value,
                          epicId: "",
                        });
                        setEpics([]);
                      }}
                    >
                      <option value="">Selecciona proyecto</option>
                      {projects
                        .filter(
                          (p) =>
                            p.id === form.projectId ||
                            p.name.toLowerCase().includes(search.toLowerCase()),
                        )
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Buscar Epic
                    <input
                      value={epicSearch}
                      onChange={(e) => setEpicSearch(e.target.value)}
                    />
                  </label>
                  <label>
                    Epic
                    <select
                      value={form.epicId}
                      aria-label="Epic"
                      onChange={(e) =>
                        setForm({ ...form, epicId: e.target.value })
                      }
                    >
                      <option value="">Sin Epic</option>
                      {epics
                        .filter(
                          (e) =>
                            e.id === form.epicId ||
                            e.title
                              .toLowerCase()
                              .includes(epicSearch.toLowerCase()),
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.number}-{e.title}
                          </option>
                        ))}
                    </select>
                  </label>
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
                  <label>
                    Prioridad
                    <select
                      value={form.priority}
                      aria-label="Prioridad"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          priority:
                            captureSubmissionSchema.shape.priority.parse(
                              e.target.value,
                            ),
                        })
                      }
                    >
                      {["low", "medium", "high", "urgent"].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Estado
                    <select
                      value={form.status}
                      aria-label="Estado"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          status: captureSubmissionSchema.shape.status.parse(
                            e.target.value,
                          ),
                        })
                      }
                    >
                      {[
                        "backlog",
                        "ready",
                        "in_progress",
                        "ready_for_review",
                        "done",
                      ].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
                <h3>Contenido que se enviará</h3>
                {evidence ? (
                  <div className="final-evidence">
                    {evidence.image ? (
                      <img
                        src={evidence.image}
                        alt="Imagen final revisada para enviar"
                      />
                    ) : (
                      <p>Sin imagen adjunta</p>
                    )}
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
                      disabled={locked}
                      className="secondary"
                      onClick={() => {
                        setEvidence(null);
                        setUnreviewed(false);
                      }}
                    >
                      Excluir toda la evidencia
                    </button>
                  </div>
                ) : (
                  <p>Sin adjuntos ni contexto de página.</p>
                )}
                {unreviewed && (
                  <p className="notice">
                    La captura ha cambiado. Confírmala tras revisar o{" "}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        setUnreviewed(false);
                        setEvidence(null);
                      }}
                    >
                      Continuar sin captura
                    </button>
                    .
                  </p>
                )}
                {pending && (
                  <p className="notice">
                    Envío pendiente de confirmar. El contenido está bloqueado
                    para reintentar sin duplicados.
                  </p>
                )}
                {inline ? (
                  <button
                    type="button"
                    disabled={busy || !writable}
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
                      unreviewed ||
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
              disabled={busy}
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
