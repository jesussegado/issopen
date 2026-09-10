import {
  maximumImagePixels,
  maximumPngBytes,
} from "../../../src/shared/capture-contract";
import {
  ImageImportError,
  imageDimensions as validateImageDimensions,
} from "../../../src/shared/image-validation";

export { ImageImportError };

const invalid = () =>
  new ImageImportError(
    "El archivo no es una imagen PNG, JPEG o WebP válida. No se admiten SVG, GIF ni animaciones.",
  );

export function imageDimensions(bytes: Uint8Array) {
  try {
    return validateImageDimensions(bytes);
  } catch (error) {
    if (error instanceof ImageImportError && error.message.includes("32"))
      throw new ImageImportError(
        "La imagen supera los 32 megapíxeles. Redúcela con tu herramienta de imágenes antes de adjuntarla.",
      );
    throw invalid();
  }
}

export async function importImage(file: Blob): Promise<string> {
  if (!file.size || file.size > maximumPngBytes)
    throw new ImageImportError("Cada archivo debe ocupar como máximo 8 MiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { type } = imageDimensions(bytes);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type }));
  } catch {
    throw invalid();
  }
  try {
    if (bitmap.width * bitmap.height > maximumImagePixels)
      throw new ImageImportError("La imagen supera los 32 megapíxeles.");
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw invalid();
    ctx.drawImage(bitmap, 0, 0);
    const png = await canvas.convertToBlob({ type: "image/png" });
    if (png.size > maximumPngBytes)
      throw new ImageImportError(
        "Al preparar la imagen supera los 8 MiB. Redúcela antes de adjuntarla.",
      );
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(invalid());
      reader.onerror = () => reject(invalid());
      reader.readAsDataURL(png);
    });
  } finally {
    bitmap.close();
  }
}
