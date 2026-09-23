import { useCallback, useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import {
  type CaptureSubmission,
  captureSubmissionSchema,
} from "../../../../../src/shared/capture-contract";
import type { AccountResponse } from "../../../lib/account";
import {
  clearDraft,
  type Draft,
  draftLifetime,
  draftSchema,
  loadDraft,
  type ReviewedEvidence,
  saveDraft,
} from "../../../lib/draft";
import { requestTicket } from "../../../lib/ticket-client";
import { type TicketRequest, ticketErrors } from "../../../lib/tickets";
import {
  type CreatedTicket,
  type Epic,
  initialComposerForm,
  type Project,
} from "./model";

export function useComposer(account: AccountResponse | null) {
  const [form, setForm] = useState(initialComposerForm);
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
  const [created, setCreated] = useState<CreatedTicket | null>(null);
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
  const readOnly = Boolean(
    connected?.apiVersion === 1 && connected.canWrite === false,
  );
  const images = evidence?.images ?? (evidence?.image ? [evidence.image] : []);
  const supportsImages = images.length <= (connected?.maxImages ?? 1);

  const changeImages = useCallback((nextImages: string[]) => {
    setEvidence((previous) =>
      nextImages.length || previous?.metadata
        ? {
            image: null,
            images: nextImages,
            metadata: previous?.metadata ?? null,
          }
        : null,
    );
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
          return;
        }
        const preferences =
          await browser.storage.local.get("ticket-destination");
        const value = draftSchema.shape.form
          .pick({ projectId: true, epicId: true })
          .safeParse(preferences["ticket-destination"]);
        if (alive && value.success)
          setForm({
            ...initialComposerForm,
            projectId: value.data.projectId,
            epicId: value.data.epicId,
          });
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
    void requestTicket({
      type: "tickets",
      version: 1,
      action: "epics",
      projectId: form.projectId,
    }).then((response) => {
      if (!alive) return;
      setEpicLoading(false);
      if (response.ok && "epics" in response) {
        setEpics(response.epics);
        setError("");
      } else if (!response.ok) setError(ticketErrors[response.code]);
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
      const response = await requestTicket({
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
      const result = await requestTicket(message);
      if (!result.ok) {
        setError(ticketErrors[result.code]);
        if (["validation", "not_found"].includes(result.code)) setInline(null);
        return;
      }
      if ("project" in result) {
        setProjects((rows) => [
          ...rows.filter((project) => project.id !== result.project.id),
          result.project,
        ]);
        setForm((current) => ({
          ...current,
          projectId: result.project.id,
          epicId: "",
        }));
        setProjectName("");
      }
      if ("epic" in result) {
        setEpics((rows) => [
          ...rows.filter((epic) => epic.id !== result.epic.id),
          result.epic,
        ]);
        setForm((current) => ({ ...current, epicId: result.epic.id }));
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
        ...initialComposerForm,
        projectId: form.projectId,
        epicId: form.epicId,
      });
      setGeneration((current) => current + 1);
      setError("");
    } catch {
      setStorageError(true);
    }
  }

  return {
    ready,
    form,
    evidence,
    pending,
    inline,
    projects,
    epics,
    projectName,
    epicTitle,
    createPanel,
    busy,
    storageError,
    error,
    created,
    generation,
    imageBusy,
    epicLoading,
    connected: Boolean(connected),
    canCreateProjects,
    mismatch,
    locked,
    writable,
    readOnly,
    images,
    supportsImages,
    changeImages,
    setImageBusy,
    setProjectName,
    setEpicTitle,
    toggleCreatePanel: (panel: "project" | "epic") =>
      setCreatePanel((current) => (current === panel ? null : panel)),
    updateForm: (next: Partial<Draft["form"]>) =>
      setForm((current) => ({ ...current, ...next })),
    selectProject: (projectId: string) => {
      setForm((current) => ({ ...current, projectId, epicId: "" }));
      setEpics([]);
    },
    selectEpic: (epicId: string) =>
      setForm((current) => ({ ...current, epicId })),
    refreshEpics: () => setEpicReload((current) => current + 1),
    removeMetadata: () => setEvidence({ image: null, images, metadata: null }),
    prepareAnother: () => {
      setCreated(null);
      setEvidence(null);
      setForm({
        ...initialComposerForm,
        projectId: form.projectId,
        epicId: form.epicId,
      });
      setGeneration((current) => current + 1);
    },
    send,
    createContainer,
    discard,
  };
}

export type ComposerModel = ReturnType<typeof useComposer>;
