import { useEffect, useState } from "react";
import { z } from "zod";
import {
  captureMetadataSchema,
  formatDom,
  structuralSelector,
} from "../../shared/capture-contract.js";
import { apiRequest } from "../lib/api.js";

const schema = z.object({
  evidence: z.array(
    z.object({
      id: z.uuid(),
      metadata: captureMetadataSchema.nullable(),
      bytes: z.number(),
      sha256: z.string().nullable(),
      createdAt: z.string(),
      imageUrl: z
        .string()
        .regex(/^\/api\/v1\/evidence\/[a-f0-9-]+\/image$/)
        .nullable(),
    }),
  ),
});
export function CaptureEvidence({ issueId }: { issueId: string }) {
  const [rows, setRows] = useState<z.infer<typeof schema>["evidence"]>([]);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [copied, setCopied] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: explicit user retry reloads the same issue.
  useEffect(() => {
    let alive = true;
    setRows([]);
    setError(false);
    apiRequest(`/api/v1/issues/${issueId}/evidence`)
      .then((value) => {
        const parsed = schema.parse(value);
        if (alive) setRows(parsed.evidence);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [issueId, reload]);
  if (!rows.length && !error) return null;
  return (
    <section
      className="detail-panel capture-evidence"
      aria-label="Ticket images and evidence"
    >
      <h2>Images and evidence ({rows.length})</h2>
      {error && (
        <p role="alert">
          Evidence could not be loaded.{" "}
          <button type="button" onClick={() => setReload(reload + 1)}>
            Retry evidence
          </button>
        </p>
      )}
      {rows.map((row, index) => (
        <article key={row.id}>
          <p className="metadata">
            Private · Chrome extension ·{" "}
            {new Date(row.createdAt).toLocaleString()}
          </p>
          {row.imageUrl && (
            <>
              <a href={row.imageUrl} target="_blank" rel="noreferrer">
                <img
                  src={row.imageUrl}
                  alt={`Attachment ${index + 1} for this issue`}
                  loading="lazy"
                />
              </a>
              <p>
                <a href={`${row.imageUrl}?download=1`}>
                  Download image {index + 1} ({Math.ceil(row.bytes / 1024)} KiB)
                </a>
              </p>
            </>
          )}
          {row.metadata && row.metadata.mode !== "upload" && (
            <dl>
              <dt>Mode</dt>
              <dd>{row.metadata.mode}</dd>
              {row.metadata.url && (
                <>
                  <dt>Reviewed URL</dt>
                  <dd>
                    <a href={row.metadata.url} target="_blank" rel="noreferrer">
                      {row.metadata.url}
                    </a>
                  </dd>
                </>
              )}
              {row.metadata.viewport && (
                <>
                  <dt>Viewport / DPR</dt>
                  <dd>
                    {row.metadata.viewport.width} ×{" "}
                    {row.metadata.viewport.height} ·{" "}
                    {row.metadata.viewport.devicePixelRatio}×
                  </dd>
                </>
              )}
              {row.metadata.capturedAt && (
                <>
                  <dt>Captured</dt>
                  <dd>{new Date(row.metadata.capturedAt).toLocaleString()}</dd>
                </>
              )}
              {row.metadata.element && (
                <>
                  <dt>Selected element</dt>
                  <dd>
                    <code>{structuralSelector(row.metadata.element)}</code>
                  </dd>
                </>
              )}
            </dl>
          )}
          {row.metadata?.dom && (
            <details>
              <summary>
                Sanitized DOM {row.metadata.dom.truncated ? "(truncated)" : ""}
              </summary>
              <pre>{formatDom(row.metadata.dom)}</pre>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (!row.metadata?.dom) return;
                    await navigator.clipboard.writeText(
                      formatDom(row.metadata.dom),
                    );
                    setCopied(row.id);
                  } catch {
                    setCopied("failed");
                  }
                }}
              >
                Copy DOM
              </button>
              <span role="status">
                {copied === row.id
                  ? " Copied"
                  : copied === "failed"
                    ? " Select the text to copy manually"
                    : ""}
              </span>
            </details>
          )}
        </article>
      ))}
    </section>
  );
}
