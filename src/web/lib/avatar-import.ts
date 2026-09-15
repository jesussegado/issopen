import {
  ImageImportError,
  imageDimensions,
} from "../../shared/image-validation.js";
import {
  avatarMaximumEncoded,
  avatarSide,
} from "../../shared/profile-contract.js";

export async function importAvatar(file: Blob): Promise<string> {
  if (!file.size || file.size > 4 * 1024 * 1024)
    throw new ImageImportError(
      "Choose one PNG, JPEG or WebP image up to 4 MiB.",
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dimensions = imageDimensions(bytes);
  if (dimensions.width * dimensions.height > 8_000_000)
    throw new ImageImportError(
      "Resize your avatar to at most 8 megapixels before uploading.",
    );
  const bitmap = await createImageBitmap(
    new Blob([bytes], { type: dimensions.type }),
  );
  try {
    if (
      bitmap.width * bitmap.height > 8_000_000 ||
      !bitmap.width ||
      !bitmap.height
    )
      throw new ImageImportError("The avatar dimensions are not supported.");
    const scale = Math.min(
      1,
      avatarSide / bitmap.width,
      avatarSide / bitmap.height,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new ImageImportError("This browser could not prepare the avatar.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/png");
    if (result.length > avatarMaximumEncoded)
      throw new ImageImportError(
        "The avatar is too detailed. Choose a smaller image.",
      );
    return result;
  } finally {
    bitmap.close();
  }
}
