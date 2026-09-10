import { useCallback, useEffect, useRef, useState } from "react";
import {
  imagesSchema,
  maximumImages,
  maximumPngBytes,
  pngBytes,
} from "../../shared/capture-contract.js";
import { ImageImportError } from "../../shared/image-validation.js";
import { importWebImage } from "../lib/image-import.js";
import { Button } from "./ui.js";

export function IssueImages({
  images,
  onChange,
  disabled,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const add = useCallback(
    async (files: Blob[]) => {
      if (disabled || busy || files.length === 0) return;
      setBusy(true);
      setError("");
      setMessage("");
      try {
        if (images.length + files.length > maximumImages)
          throw new ImageImportError(
            "You can attach up to 5 images. Remove one before adding more.",
          );
        const next = [...images];
        for (const file of files) {
          next.push(await importWebImage(file));
          if (!imagesSchema.safeParse(next).success)
            throw new ImageImportError(
              "The images together exceed 8 MiB. Resize them or attach fewer images.",
            );
        }
        onChange(next);
        setMessage(
          `${files.length === 1 ? "Image added" : `${files.length} images added`}. They will be stored when you create the issue.`,
        );
      } catch (caught) {
        setError(
          caught instanceof ImageImportError
            ? caught.message
            : "The image could not be prepared. Try saving it as PNG.",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, disabled, images, onChange],
  );

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      void add(files);
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [add]);

  const total = images.reduce((bytes, image) => bytes + pngBytes(image), 0);
  return (
    <section className="web-image-attachments" aria-labelledby="images-heading">
      <div className="web-image-heading">
        <h2 id="images-heading">Images</h2>
        <span className="badge">
          {images.length}/{maximumImages}
        </span>
      </div>
      <p className="metadata">
        Paste screenshots with Ctrl+V (⌘V on Mac), or choose PNG, JPG, or WebP
        files. Images remain private and are attached when the issue is created.
      </p>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Preparing images…" : "Choose images"}
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        aria-label="Choose images"
        hidden
        disabled={disabled || busy}
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          void add(files);
        }}
      />
      {images.length > 0 ? (
        <ul className="web-image-grid">
          {images.map((image, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: duplicate images are valid and ordering is meaningful.
            <li key={`${index}-${image.slice(-24)}`}>
              <img src={image} alt={`Attachment ${index + 1}`} />
              <Button
                type="button"
                variant="secondary"
                aria-label={`Remove attachment ${index + 1}`}
                disabled={disabled || busy}
                onClick={() => {
                  onChange(images.filter((_, position) => position !== index));
                  setError("");
                  setMessage("Image removed.");
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {images.length > 0 ? (
        <p className="metadata">
          {Math.ceil(total / 1024)} KiB of {maximumPngBytes / 1024} KiB used.
        </p>
      ) : null}
      <p className="field-helper" role="status">
        {message}
      </p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
