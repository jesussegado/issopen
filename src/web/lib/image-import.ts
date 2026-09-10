import {
  maximumImagePixels,
  maximumPngBytes,
} from "../../shared/capture-contract.js";
import {
  ImageImportError,
  imageDimensions,
} from "../../shared/image-validation.js";

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new ImageImportError("The image could not be read."));
    reader.onerror = () =>
      reject(new ImageImportError("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}

function canvasPng(
  canvas: HTMLCanvasElement,
  maximumBytes: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob)
        return reject(new ImageImportError("The image could not be prepared."));
      if (blob.size > maximumBytes)
        return reject(
          new ImageImportError(
            "The prepared image exceeds 8 MiB. Resize it before attaching it.",
          ),
        );
      resolve(blob);
    }, "image/png");
  });
}

export async function importWebImage(file: Blob): Promise<string> {
  if (!file.size || file.size > maximumPngBytes)
    throw new ImageImportError("Each image must be no larger than 8 MiB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = imageDimensions(bytes);
  if (dimensions.type === "image/png")
    return dataUrl(new Blob([bytes], { type: "image/png" }));

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(
      new Blob([bytes], { type: dimensions.type }),
    );
  } catch {
    throw new ImageImportError("The image could not be decoded safely.");
  }
  try {
    if (bitmap.width * bitmap.height > maximumImagePixels)
      throw new ImageImportError(
        "The image exceeds 32 megapixels. Resize it before attaching it.",
      );
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context)
      throw new ImageImportError("The image could not be prepared.");
    context.drawImage(bitmap, 0, 0);
    return dataUrl(await canvasPng(canvas, maximumPngBytes));
  } finally {
    bitmap.close();
  }
}
