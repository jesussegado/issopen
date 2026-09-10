import { useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import {
  formatDom,
  structuralSelector,
} from "../../../../src/shared/capture-contract";
import {
  type CaptureResponse,
  captureModeSchema,
  captureResponseSchema,
  pixelRect,
} from "../../lib/capture";
import {
  type CaptureErrorCode,
  captureProblems,
} from "../../lib/capture-errors";
import type { ReviewedEvidence } from "../../lib/draft";
import "./capture-errors.css";

export function Capture({
  onReview,
  onInvalidate,
  disabled = false,
  initialEvidence,
}: {
  onReview?: (evidence: ReviewedEvidence) => void;
  onInvalidate?: () => void;
  disabled?: boolean;
  initialEvidence?: ReviewedEvidence | null;
}) {
  const [mode, setMode] = useState<"crop" | "viewport" | "full" | "element">(
    "crop",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CaptureErrorCode | null>(null);
  const problem = error ? captureProblems[error] : null;
  const [result, setResult] = useState<Extract<
    CaptureResponse,
    { ok: true }
  > | null>(
    initialEvidence?.image
      ? {
          ok: true,
          dataUrl: initialEvidence.image,
          width: 1,
          height: 1,
          origin: initialEvidence.metadata?.url
            ? new URL(initialEvidence.metadata.url).origin
            : "Borrador revisado",
          mode: initialEvidence.metadata?.mode ?? "viewport",
          ...(initialEvidence.metadata
            ? { metadata: initialEvidence.metadata }
            : {}),
        }
      : null,
  );
  const [history, setHistory] = useState<string[]>(
    initialEvidence?.image ? [initialEvidence.image] : [],
  );
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<"redact" | "crop">("redact");
  const [rect, setRect] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [showMetadata, setShowMetadata] = useState(true);
  const [includeDom, setIncludeDom] = useState(true);
  const [includeImage, setIncludeImage] = useState(true);
  const [includeElement, setIncludeElement] = useState(true);
  const [reviewed, setReviewed] = useState(false);
  const [zoom, setZoom] = useState("fit");
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [selection, setSelection] = useState<typeof rect | null>(null);
  const [loadedUrl, setLoadedUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dataUrl = history[index];
  const previewReady = Boolean(dataUrl && loadedUrl === dataUrl);
  const mounted = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: every change to the reviewed payload invalidates explicit approval.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setReviewed(false);
    onInvalidate?.();
  }, [
    dataUrl,
    includeDom,
    includeImage,
    includeElement,
    showMetadata,
    onInvalidate,
  ]);
  useEffect(() => {
    browser.storage.local
      .get("capture-mode")
      .then((value) => {
        const saved = captureModeSchema.safeParse(value["capture-mode"]);
        if (saved.success) setMode(saved.data);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!dataUrl) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext("2d")?.drawImage(image, 0, 0);
      setSize({ width: image.width, height: image.height });
      setLoadedUrl(dataUrl);
    };
    image.src = dataUrl;
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);
  async function capture() {
    if (
      history.length &&
      !window.confirm("¿Descartar la captura local y empezar otra?")
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const response = captureResponseSchema.parse(
        await browser.runtime.sendMessage({
          version: 1,
          type: "capture",
          mode,
        }),
      );
      if (!response.ok) {
        setError(response.code ?? "capture-failed");
        return;
      }
      setResult(response);
      setHistory([response.dataUrl]);
      setIndex(0);
      setRect({
        x: 0,
        y: 0,
        width: Math.min(100, response.width),
        height: Math.min(100, response.height),
      });
      await browser.storage.local.set({ "capture-mode": mode });
    } catch {
      setError("extension-unavailable");
    } finally {
      setBusy(false);
    }
  }
  function apply(area = rect) {
    if (!previewReady) return;
    const original = canvasRef.current;
    if (!original) return;
    const clipped = pixelRect(area, 1, original.width, original.height);
    const canvas = document.createElement("canvas");
    canvas.width = tool === "crop" ? clipped.width : original.width;
    canvas.height = tool === "crop" ? clipped.height : original.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (tool === "crop")
      ctx.drawImage(
        original,
        clipped.x,
        clipped.y,
        clipped.width,
        clipped.height,
        0,
        0,
        clipped.width,
        clipped.height,
      );
    else {
      ctx.drawImage(original, 0, 0);
      ctx.fillStyle = "#000000";
      ctx.fillRect(clipped.x, clipped.y, clipped.width, clipped.height);
    }
    const image = canvas.toDataURL("image/png");
    const next = [...history.slice(0, index + 1), image].slice(-6);
    setHistory(next);
    setIndex(next.length - 1);
  }
  const position = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x:
        (Math.max(0, Math.min(bounds.width, e.clientX - bounds.left)) *
          canvas.width) /
        bounds.width,
      y:
        (Math.max(0, Math.min(bounds.height, e.clientY - bounds.top)) *
          canvas.height) /
        bounds.height,
    };
  };
  return (
    <section aria-labelledby="capture-heading">
      <fieldset disabled={disabled} className="capture-fieldset">
        <h2 id="capture-heading">Captura y previsualización</h2>
        <p>
          La imagen no sale del navegador hasta pulsar Enviar ticket. Ocultamos
          controles de formulario e iframes, elementos personalizados y hosts de
          Shadow DOM detectables; revisa también los datos sensibles que
          aparezcan como texto o imágenes.
        </p>
        <label>
          Modo
          <select
            aria-label="Modo"
            value={mode}
            disabled={busy}
            onChange={(e) => setMode(captureModeSchema.parse(e.target.value))}
          >
            <option value="crop">Recorte de la página</option>
            <option value="viewport">Área visible</option>
            <option value="full">Página completa</option>
            <option value="element">Elemento seleccionado</option>
          </select>
        </label>
        {mode === "full" && (
          <p className="notice">
            En página completa se omiten elementos fijos/sticky para evitar
            repeticiones. Máximo 20 tramos / 16.000 px CSS / 32 megapíxeles / 8
            MiB. No soporta scroll horizontal ni páginas infinitas.
          </p>
        )}
        <button type="button" disabled={busy} onClick={() => void capture()}>
          {busy ? "Capturando…" : "Capturar página"}
        </button>
        {busy && (
          <p role="status">
            Mantén esta pestaña abierta. Para recorte, arrastra sobre la página;
            Escape cancela. En modo elemento, ↑ elige el ancestro, ↓ vuelve y
            Enter confirma.
          </p>
        )}
        {problem && (
          <div
            className="error capture-error"
            role="alert"
            data-capture-error={error}
          >
            <strong>{problem.title}</strong>
            <p>{problem.description}</p>
            <ol>
              {problem.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="capture-error-safety">
              Esta captura no se ha enviado.
              {dataUrl ? " La previsualización anterior sigue disponible." : ""}
            </p>
          </div>
        )}
        {result && dataUrl && (
          <div className="capture-editor">
            <h3>Previsualización local</h3>
            <label>
              <input
                type="checkbox"
                checked={showMetadata}
                onChange={(e) => setShowMetadata(e.target.checked)}
              />
              Mostrar origen de la página
            </label>
            {showMetadata && (
              <p>
                {result.metadata?.url ?? result.origin} · {size.width} ×{" "}
                {size.height} px
              </p>
            )}
            {result.metadata?.element && (
              <div className="element-context">
                <h4>Elemento seleccionado</h4>
                <code>{structuralSelector(result.metadata.element)}</code>
                <label>
                  <input
                    type="checkbox"
                    checked={includeDom}
                    onChange={(e) => setIncludeDom(e.target.checked)}
                  />
                  Incluir estructura DOM saneada
                </label>
                <p>
                  Sin texto, IDs, clases, enlaces ni valores de formulario. Sólo
                  estructura y atributos semánticos permitidos.
                </p>
                {includeDom && result.metadata.dom && (
                  <details>
                    <summary>
                      Revisar DOM{" "}
                      {result.metadata.dom.truncated
                        ? "(truncado por límites)"
                        : ""}
                    </summary>
                    <pre>{formatDom(result.metadata.dom)}</pre>
                  </details>
                )}
              </div>
            )}
            <label>
              Herramienta
              <select
                aria-label="Herramienta"
                value={tool}
                onChange={(e) =>
                  setTool(e.target.value === "crop" ? "crop" : "redact")
                }
              >
                <option value="redact">
                  Ocultar zona (negro irreversible)
                </option>
                <option value="crop">Recortar imagen</option>
              </select>
            </label>
            <label>
              Zoom de previsualización
              <select
                aria-label="Zoom de previsualización"
                value={zoom}
                onChange={(e) => setZoom(e.target.value)}
              >
                <option value="fit">Ajustar al panel</option>
                <option value="100">100 % (píxeles reales)</option>
                <option value="200">200 %</option>
              </select>
            </label>
            <p>
              Arrastra sobre la imagen para aplicar la herramienta o indica el
              rectángulo en píxeles. Puedes deshacer hasta cinco cambios
              mientras el panel siga abierto.
            </p>
            <div className="capture-viewport">
              <div
                className="capture-surface"
                style={{
                  width:
                    zoom === "fit"
                      ? "100%"
                      : `${(size.width * Number(zoom)) / 100}px`,
                }}
              >
                <canvas
                  ref={canvasRef}
                  aria-label="Previsualización de captura local"
                  aria-busy={!previewReady}
                  className="capture-canvas"
                  onPointerDown={(e) => {
                    if (!previewReady) return;
                    start.current = position(e);
                    setSelection(null);
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!start.current) return;
                    const end = position(e),
                      a = start.current;
                    setSelection({
                      x: Math.min(a.x, end.x),
                      y: Math.min(a.y, end.y),
                      width: Math.abs(a.x - end.x),
                      height: Math.abs(a.y - end.y),
                    });
                  }}
                  onPointerUp={(e) => {
                    if (!start.current) return;
                    const end = position(e),
                      a = start.current;
                    start.current = null;
                    setSelection(null);
                    const selected = {
                      x: Math.min(a.x, end.x),
                      y: Math.min(a.y, end.y),
                      width: Math.abs(a.x - end.x),
                      height: Math.abs(a.y - end.y),
                    };
                    if (selected.width >= 2 && selected.height >= 2) {
                      setRect(selected);
                      apply(selected);
                    }
                  }}
                  onPointerCancel={() => {
                    start.current = null;
                    setSelection(null);
                  }}
                />
                {selection && (
                  <div
                    className="capture-selection"
                    aria-hidden="true"
                    style={{
                      left: `${(selection.x / size.width) * 100}%`,
                      top: `${(selection.y / size.height) * 100}%`,
                      width: `${(selection.width / size.width) * 100}%`,
                      height: `${(selection.height / size.height) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
            <p>
              {size.width} × {size.height} px · PNG final
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                apply();
              }}
            >
              <div className="rectangle-fields">
                {(["x", "y", "width", "height"] as const).map((key) => (
                  <label key={key}>
                    {{ x: "X", y: "Y", width: "Ancho", height: "Alto" }[key]}
                    <input
                      type="number"
                      required
                      min={key === "x" || key === "y" ? 0 : 1}
                      max={32000}
                      value={Math.round(rect[key])}
                      onChange={(e) =>
                        setRect({ ...rect, [key]: Number(e.target.value) })
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                type="submit"
                className="secondary"
                disabled={!previewReady}
              >
                Aplicar {tool === "crop" ? "recorte" : "ocultación"}
              </button>
            </form>
            <div className="capture-actions">
              <button
                type="button"
                className="secondary"
                disabled={!previewReady || index === 0}
                onClick={() => setIndex(index - 1)}
              >
                Deshacer
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!previewReady || index === history.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                Rehacer
              </button>
            </div>
            <p>
              El PNG contiene los píxeles finales, sin capas ni zonas
              recuperables. No se guarda el historial ni la imagen original en
              el servidor o en storage.
            </p>
            <a
              className="download"
              href={dataUrl}
              download="issopen-captura-revisada.png"
            >
              Descargar PNG revisado
            </a>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (
                  window.confirm("¿Descartar la captura y su historial local?")
                ) {
                  setHistory([]);
                  setResult(null);
                }
              }}
            >
              Descartar captura
            </button>
            <p className="notice">
              Sólo la versión que confirmes se conserva en el borrador local
              durante 24 horas. Si cierras antes de revisar, se pierde esta
              captura. Nunca guardamos originales ni historial.
            </p>
            {onReview && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={includeImage}
                    onChange={(e) => setIncludeImage(e.target.checked)}
                  />
                  Incluir imagen final
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={includeElement}
                    onChange={(e) => setIncludeElement(e.target.checked)}
                  />
                  Incluir descriptor del elemento
                </label>
                <p>
                  «Mostrar origen» incluye o excluye URL, viewport y fecha. El
                  modo de captura permanece como dato técnico.
                </p>
                <button
                  type="button"
                  disabled={!previewReady}
                  onClick={() => {
                    const metadata = result.metadata;
                    onReview({
                      image: includeImage ? dataUrl : null,
                      metadata: metadata
                        ? {
                            mode: metadata.mode,
                            ...(showMetadata
                              ? {
                                  ...(metadata.url
                                    ? { url: metadata.url }
                                    : {}),
                                  ...(metadata.viewport
                                    ? { viewport: metadata.viewport }
                                    : {}),
                                  ...(metadata.capturedAt
                                    ? { capturedAt: metadata.capturedAt }
                                    : {}),
                                }
                              : {}),
                            ...(includeElement && metadata.element
                              ? { element: metadata.element }
                              : {}),
                            ...(includeDom && metadata.dom
                              ? { dom: metadata.dom }
                              : {}),
                          }
                        : null,
                    });
                    setReviewed(true);
                  }}
                >
                  Confirmar captura revisada
                </button>
                {reviewed && (
                  <p role="status">
                    Captura revisada añadida al borrador. Revisa el destino y
                    pulsa Enviar ticket.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </fieldset>
    </section>
  );
}
