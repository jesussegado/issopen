import { useCallback, useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import {
  imagesSchema,
  maximumImages,
  maximumPngBytes,
  pngBytes,
} from "../../../../src/shared/capture-contract";
import { ImageImportError, importImage } from "../../lib/image-import";
import "./images.css";

export function Images({
  images,
  onChange,
  onBusy,
  disabled,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const gate = useRef(false);
  const alive = useRef(true);
  const current = useRef({ images, disabled });
  current.current = { images, disabled };
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const add = useCallback(
    async (source: Blob[] | (() => Promise<Blob[]>)) => {
      if (gate.current || current.current.disabled) return;
      gate.current = true;
      setBusy(true);
      onBusy(true);
      setError("");
      setMessage("");
      try {
        const files = typeof source === "function" ? await source() : source;
        if (!files.length) return;
        if (current.current.images.length + files.length > maximumImages)
          throw new ImageImportError(
            "Puedes adjuntar hasta 5 imágenes por ticket. Quita alguna antes de añadir más.",
          );
        const result = [...current.current.images];
        for (const file of files) {
          result.push(await importImage(file));
          if (!imagesSchema.safeParse(result).success)
            throw new ImageImportError(
              "Las imágenes juntas superan los 8 MiB. Reduce su tamaño o adjunta menos imágenes.",
            );
        }
        if (alive.current && !current.current.disabled) {
          onChange(result);
          setMessage(
            `${files.length === 1 ? "Imagen añadida" : `${files.length} imágenes añadidas`}. Todavía no se han enviado.`,
          );
        }
      } catch (e) {
        if (alive.current)
          setError(
            e instanceof ImageImportError
              ? e.message
              : "No se pudo preparar la imagen. Prueba a guardarla como PNG y vuelve a seleccionarla.",
          );
      } finally {
        gate.current = false;
        if (alive.current) {
          setBusy(false);
          onBusy(false);
        }
      }
    },
    [onChange, onBusy],
  );
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (!files.length) return; // Normal text paste stays native; no HTML/URL fetching.
      event.preventDefault();
      void add(files);
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [add]);
  async function paste() {
    await add(async () => {
      try {
        // Optional permission is requested only by this explicit user gesture.
        const granted = await browser.permissions.request({
          permissions: ["clipboardRead"],
        });
        if (!granted) throw new Error();
        const items = await navigator.clipboard.read();
        const files: Blob[] = [];
        for (const item of items) {
          const type = ["image/png", "image/jpeg", "image/webp"].find((t) =>
            item.types.includes(t),
          );
          if (type) files.push(await item.getType(type));
        }
        if (!files.length)
          throw new ImageImportError(
            "No hay ninguna imagen copiada. Copia el recorte como imagen (no su enlace) o usa Subir imágenes.",
          );
        return files;
      } catch (error) {
        if (error instanceof ImageImportError) throw error;
        throw new ImageImportError(
          "Chrome no ha permitido leer el portapapeles. Haz clic en este panel y pulsa Ctrl+V (⌘V en Mac), o usa Subir imágenes.",
        );
      }
    });
  }
  const total = images.reduce((n, image) => n + pngBytes(image), 0);
  return (
    <section className="image-attachments" aria-labelledby="images-heading">
      <h2 id="images-heading">
        Imágenes del ticket{" "}
        <span className="image-count">
          {images.length}/{maximumImages}
        </span>
      </h2>
      <p>
        Pega tu recorte con <kbd>Ctrl+V</kbd> (⌘V en Mac) o elige imágenes de tu
        equipo.
      </p>
      <div className="image-buttons">
        <button
          type="button"
          className="secondary"
          disabled={disabled || busy}
          onClick={() => void paste()}
        >
          Pegar imagen
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          Subir imágenes
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          aria-label="Seleccionar imágenes"
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void add(files);
          }}
        />
      </div>
      <p className="image-hint">
        PNG, JPG o WebP · hasta 5 imágenes · 8 MiB en total.
      </p>
      {images.length > 0 && (
        <ul className="image-grid">
          {images.map((image, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stateless previews; identical images are allowed and numbering follows position.
            <li key={`${index}-${image.slice(-24)}`}>
              <img src={image} alt={`Imagen adjunta ${index + 1}`} />
              <div>
                <span>Imagen {index + 1}</span>
                <button
                  type="button"
                  className="secondary"
                  aria-label={`Quitar imagen ${index + 1}`}
                  disabled={disabled || busy}
                  onClick={() => {
                    onChange(images.filter((_, i) => i !== index));
                    setMessage("Imagen quitada del borrador.");
                    setError("");
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {images.length > 0 && (
        <p className="image-hint">
          {Math.ceil(total / 1024)} KiB de {maximumPngBytes / 1024} KiB
          disponibles.
        </p>
      )}
      <p role="status">{busy ? "Preparando imágenes…" : message}</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
