import { storageGetBuffer, storagePut } from "./storage";
import { validateDirectUpload, type UploadMimeType } from "./uploadPolicy";

const CHUNK_XOR_KEY = 90;
export const MAX_UPLOAD_CHUNK_BYTES = 512 * 1024;
export const MAX_UPLOAD_CHUNKS = 9000;

export function decodeUploadChunk(encoded: string): Buffer {
  const encrypted = Buffer.from(encoded, "base64");
  for (let index = 0; index < encrypted.length; index += 1) encrypted[index] ^= CHUNK_XOR_KEY;
  return encrypted;
}

export async function storeUploadChunk(input: { userId: number; uploadId: string; chunkIndex: number; chunkData: string }) {
  const data = decodeUploadChunk(input.chunkData);
  if (data.byteLength < 1 || data.byteLength > MAX_UPLOAD_CHUNK_BYTES) throw new Error("دفعة الرفع غير صالحة.");
  return storagePut(`academy/${input.userId}/transfer/${input.uploadId}/${String(input.chunkIndex).padStart(5, "0")}.part`, data, "application/octet-stream");
}

export async function finalizeChunkedUpload(input: { userId: number; uploadId: string; fileName: string; mimeType: UploadMimeType; chunkKeys: string[] }) {
  const validation = validateDirectUpload({ fileName: input.fileName, mimeType: input.mimeType, bytes: 1 });
  if (!validation.ok) throw new Error(validation.message);
  if (input.chunkKeys.length < 1 || input.chunkKeys.length > MAX_UPLOAD_CHUNKS) throw new Error("تعذر العثور على دفعات الملف المرفوع.");

  const parts: Buffer[] = [];
  for (const key of input.chunkKeys) {
    try {
      parts.push(await storageGetBuffer(key));
    } catch {
      throw new Error("تعذر استكمال إحدى دفعات الملف.");
    }
  }
  const file = Buffer.concat(parts);
  const sizeCheck = validateDirectUpload({ fileName: input.fileName, mimeType: input.mimeType, bytes: file.byteLength });
  if (!sizeCheck.ok) throw new Error(sizeCheck.message);
  return storagePut(`academy/${input.userId}/${Date.now()}-${sizeCheck.safeName}`, file, sizeCheck.mimeType);
}
