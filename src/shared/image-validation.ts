import { maximumImagePixels } from "./capture-contract.js";

export class ImageImportError extends Error {}

const invalid = () =>
  new ImageImportError(
    "The file is not a valid PNG, JPEG, or WebP image. SVG, GIF, and animated images are not supported.",
  );

export function imageDimensions(bytes: Uint8Array): {
  width: number;
  height: number;
  type: string;
} {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  let width = 0;
  let height = 0;
  let type = "";

  if (
    bytes.length >= 33 &&
    bytes[0] === 137 &&
    text(1, 7) === "PNG\r\n\x1a\n" &&
    text(12, 4) === "IHDR"
  ) {
    width = view.getUint32(16);
    height = view.getUint32(20);
    type = "image/png";
    for (let offset = 8; offset + 12 <= bytes.length; ) {
      const length = view.getUint32(offset);
      if (offset + length + 12 > bytes.length || text(offset + 4, 4) === "acTL")
        throw invalid();
      offset += length + 12;
    }
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    type = "image/jpeg";
    for (let offset = 2; offset + 4 <= bytes.length; ) {
      if (bytes[offset] !== 255) throw invalid();
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === undefined || marker === 218 || marker === 217) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) throw invalid();
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw invalid();
      if ([192, 193, 194].includes(marker)) {
        if (length < 8) throw invalid();
        height = view.getUint16(offset + 3);
        width = view.getUint16(offset + 5);
        break;
      }
      offset += length;
    }
  } else if (
    bytes.length >= 30 &&
    text(0, 4) === "RIFF" &&
    text(8, 4) === "WEBP"
  ) {
    type = "image/webp";
    const uint24 = (offset: number) =>
      (bytes[offset] ?? 0) +
      ((bytes[offset + 1] ?? 0) << 8) +
      ((bytes[offset + 2] ?? 0) << 16);
    for (let offset = 12; offset + 8 <= bytes.length; ) {
      const kind = text(offset, 4);
      const length = view.getUint32(offset + 4, true);
      const start = offset + 8;
      if (start + length > bytes.length) throw invalid();
      if (kind === "ANIM" || kind === "ANMF") throw invalid();
      if (kind === "VP8X" && length >= 10) {
        if ((bytes[start] ?? 0) & 2) throw invalid();
        width = uint24(start + 4) + 1;
        height = uint24(start + 7) + 1;
      } else if (
        !width &&
        kind === "VP8L" &&
        length >= 5 &&
        bytes[start] === 47
      ) {
        const bits = view.getUint32(start + 1, true);
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
      } else if (
        !width &&
        kind === "VP8 " &&
        length >= 10 &&
        text(start + 3, 3) === "\x9d\x01\x2a"
      ) {
        width = view.getUint16(start + 6, true) & 0x3fff;
        height = view.getUint16(start + 8, true) & 0x3fff;
      }
      offset = start + length + (length % 2);
    }
  }

  if (!width || !height || !type) throw invalid();
  if (width * height > maximumImagePixels)
    throw new ImageImportError(
      "The image exceeds 32 megapixels. Resize it before attaching it.",
    );
  return { width, height, type };
}
