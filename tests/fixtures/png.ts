import { crc32, deflateSync } from "node:zlib";
export function pngChunk(kind: string, body: Buffer) {
  const data = Buffer.alloc(body.length + 12);
  data.writeUInt32BE(body.length);
  data.write(kind, 4);
  body.copy(data, 8);
  data.writeUInt32BE(crc32(data.subarray(4, -4)), data.length - 4);
  return data;
}
export function syntheticPng(extra = false) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    ...(extra ? [pngChunk("tEXt", Buffer.from("PRIVATE-DECOY"))] : []),
    pngChunk("IDAT", deflateSync(Buffer.from([0, 0, 0, 0, 255, 0, 0, 0, 255]))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
