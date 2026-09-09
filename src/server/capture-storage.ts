import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, readdir, statfs } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";
import { crc32, deflate, inflate } from "node:zlib";
import { maximumPngBytes } from "../shared/capture-contract.js";

export class CaptureError extends Error {
  constructor(
    public readonly code:
      | "validation"
      | "size"
      | "quota"
      | "storage"
      | "conflict"
      | "busy",
    public readonly status: 400 | 409 | 413 | 429 | 503 = 400,
  ) {
    super(code);
  }
}
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const unzip = promisify(inflate);
const zip = promisify(deflate);
function pngChunk(kind: string, body: Buffer) {
  const data = Buffer.alloc(body.length + 12);
  data.writeUInt32BE(body.length);
  data.write(kind, 4);
  body.copy(data, 8);
  data.writeUInt32BE(crc32(data.subarray(4, -4)), data.length - 4);
  return data;
}
// Accept only the non-interlaced 8-bit RGB/RGBA PNG emitted by our canvas.
// Validate compressed pixels and strip all ancillary metadata, including text.
export async function normalizePng(dataUrl: string): Promise<Buffer> {
  if (!dataUrl.startsWith("data:image/png;base64,"))
    throw new CaptureError("validation");
  const encoded = dataUrl.slice(22);
  if (encoded.length > Math.ceil(maximumPngBytes / 3) * 4)
    throw new CaptureError("size", 413);
  const input = Buffer.from(encoded, "base64");
  if (
    input.toString("base64") !== encoded ||
    input.length > maximumPngBytes ||
    !input.subarray(0, 8).equals(signature)
  )
    throw new CaptureError("validation");
  const parts: Buffer[] = [signature];
  const compressed: Buffer[] = [];
  let width = 0,
    height = 0,
    channels = 0,
    ended = false,
    afterData = false;
  for (let offset = 8, count = 0; offset < input.length; ) {
    if (++count > 2048 || offset + 12 > input.length)
      throw new CaptureError("validation");
    const size = input.readUInt32BE(offset);
    const end = offset + size + 12;
    if (end > input.length) throw new CaptureError("validation");
    const kind = input.toString("ascii", offset + 4, offset + 8);
    const chunk = input.subarray(offset, end);
    const body = chunk.subarray(8, -4);
    if (crc32(chunk.subarray(4, -4)) !== chunk.readUInt32BE(chunk.length - 4))
      throw new CaptureError("validation");
    if (count === 1) {
      if (kind !== "IHDR" || size !== 13) throw new CaptureError("validation");
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;
      if (
        !width ||
        !height ||
        width * height > 32_000_000 ||
        !channels ||
        body[8] !== 8 ||
        body[10] ||
        body[11] ||
        body[12]
      )
        throw new CaptureError("size", 413);
      parts.push(chunk);
    } else if (kind === "IDAT") {
      if (afterData) throw new CaptureError("validation");
      compressed.push(body);
      parts.push(chunk);
    } else if (kind === "IEND") {
      if (size || !compressed.length || end !== input.length)
        throw new CaptureError("validation");
      ended = true;
      parts.push(chunk);
    } else {
      if (compressed.length) afterData = true;
      // No APNG, unknown critical chunks or second headers.
      if (
        kind === "acTL" ||
        kind === "fcTL" ||
        kind === "fdAT" ||
        !/^[a-z][A-Za-z]{3}$/.test(kind)
      )
        throw new CaptureError("validation");
    }
    offset = end;
  }
  if (!ended) throw new CaptureError("validation");
  const stride = width * channels + 1;
  try {
    const raw = await unzip(Buffer.concat(compressed), {
      maxOutputLength: stride * height,
    });
    if (raw.length !== stride * height) throw new Error();
    for (let y = 0; y < height; y++)
      if ((raw[y * stride] ?? 5) > 4) throw new Error();
    // Re-encode validated scanlines so ignored zlib tails cannot smuggle data.
    const normalized = Buffer.concat([
      signature,
      parts[1] as Buffer,
      pngChunk("IDAT", await zip(raw)),
      pngChunk("IEND", Buffer.alloc(0)),
    ]);
    if (normalized.length > maximumPngBytes)
      throw new CaptureError("size", 413);
    return normalized;
  } catch {
    throw new CaptureError("validation");
  }
}

export class CaptureStorage {
  constructor(
    readonly directory: string,
    readonly quotaBytes = 1024 * 1024 * 1024,
  ) {
    if (
      !isAbsolute(directory) ||
      directory === "/" ||
      !Number.isSafeInteger(quotaBytes) ||
      quotaBytes < maximumPngBytes
    )
      throw new Error("Invalid attachment storage configuration");
  }
  path(key: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/.test(
        key,
      )
    )
      throw new CaptureError("validation");
    return join(this.directory, key);
  }
  async ready() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const dir = await open(
      this.directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    await dir.close();
  }
  async usage() {
    await this.ready();
    let bytes = 0;
    for (const name of await readdir(this.directory)) {
      if (!name.endsWith(".png")) continue;
      const file = await open(
        this.path(name),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        bytes += (await file.stat()).size;
      } finally {
        await file.close();
      }
    }
    return { bytes, quotaBytes: this.quotaBytes };
  }
  async write(png: Buffer) {
    // Caller holds the database-wide attachment advisory transaction lock.
    const usage = await this.usage();
    const free = await statfs(this.directory);
    if (
      usage.bytes + png.length > this.quotaBytes ||
      free.bavail * free.bsize < png.length + 32 * 1024 * 1024
    )
      throw new CaptureError("quota", 503);
    const key = `${randomUUID()}.png`;
    const file = await open(
      this.path(key),
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await file.writeFile(png);
      await file.sync();
    } finally {
      await file.close();
    }
    const dir = await open(
      this.directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
    return {
      fileKey: key,
      bytes: png.length,
      mime: "image/png",
      sha256: createHash("sha256").update(png).digest("hex"),
    };
  }
  async read(key: string, hash: string, bytes: number) {
    try {
      const file = await open(
        this.path(key),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      let data: Buffer;
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size !== bytes || bytes > maximumPngBytes)
          throw new Error();
        data = await file.readFile();
      } finally {
        await file.close();
      }
      if (createHash("sha256").update(data).digest("hex") !== hash)
        throw new Error();
      return data;
    } catch {
      throw new CaptureError("storage", 503);
    }
  }
}
