import { afterEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  storageGetSignedUrl: vi.fn(),
  storagePut: vi.fn(),
}));

vi.mock("./storage", () => storageMocks);

import { decodeUploadChunk, finalizeChunkedUpload, MAX_UPLOAD_CHUNK_BYTES, storeUploadChunk } from "./chunkedUpload";

function encodeForTransfer(data: Buffer) {
  const transformed = Buffer.from(data.map(byte => byte ^ 90));
  return transformed.toString("base64");
}

describe("chunked upload encoding", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });
  it("restores a small PDF-like chunk after the transfer encoding", () => {
    const pdfChunk = Buffer.from("%PDF-1.7 small lesson");
    expect(decodeUploadChunk(encodeForTransfer(pdfChunk))).toEqual(pdfChunk);
  });

  it("restores a video-like binary chunk without exposing its original bytes in the payload", () => {
    const videoChunk = Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
    const payload = encodeForTransfer(videoChunk);
    expect(payload).not.toContain(videoChunk.toString("base64"));
    expect(decodeUploadChunk(payload)).toEqual(videoChunk);
  });

  it("limits a transfer chunk to 24 kilobytes before JSON and Base64 overhead", async () => {
    await expect(storeUploadChunk({ userId: 10, uploadId: "11111111-1111-4111-8111-111111111111", chunkIndex: 0, chunkData: encodeForTransfer(Buffer.alloc(MAX_UPLOAD_CHUNK_BYTES + 1)) })).rejects.toThrow("دفعة الرفع غير صالحة");
  });

  it("combines a larger 2 MB video through multiple stored chunks", async () => {
    vi.clearAllMocks();
    const chunk = Buffer.alloc(8 * 1024, 17);
    const chunkCount = 256;
    storageMocks.storagePut.mockImplementation(async (key: string) => ({ key, url: `/uploads/${key}` }));
    storageMocks.storageGetSignedUrl.mockResolvedValue("https://storage.example/video-part");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) }));
    const chunkKeys: string[] = [];
    for (let index = 0; index < chunkCount; index += 1) {
      const stored = await storeUploadChunk({ userId: 10, uploadId: "22222222-2222-4222-8222-222222222222", chunkIndex: index, chunkData: encodeForTransfer(chunk) });
      chunkKeys.push(stored.key);
    }
    const finalized = await finalizeChunkedUpload({ userId: 10, uploadId: "22222222-2222-4222-8222-222222222222", fileName: "course-video.mp4", mimeType: "video/mp4", chunkKeys });
    expect(chunkKeys).toHaveLength(chunkCount);
    expect(storageMocks.storagePut).toHaveBeenLastCalledWith(expect.stringContaining("academy/10/"), expect.any(Buffer), "video/mp4");
    expect(finalized.url).toContain("/uploads/");
  });

  it("stores, retrieves and combines a small PDF through the complete chunk workflow", async () => {
    const pdf = Buffer.from("%PDF-1.7\nsmall lesson");
    storageMocks.storagePut.mockResolvedValueOnce({ key: "academy/10/transfer/upload/00000.part", url: "/uploads/chunk" }).mockResolvedValueOnce({ key: "academy/10/lesson.pdf", url: "/uploads/academy/10/lesson.pdf" });
    storageMocks.storageGetSignedUrl.mockResolvedValue("https://storage.example/chunk");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) }));

    const chunk = await storeUploadChunk({ userId: 10, uploadId: "11111111-1111-4111-8111-111111111111", chunkIndex: 0, chunkData: encodeForTransfer(pdf) });
    const finalized = await finalizeChunkedUpload({ userId: 10, uploadId: "11111111-1111-4111-8111-111111111111", fileName: "lesson.pdf", mimeType: "application/pdf", chunkKeys: [chunk.key] });

    expect(storageMocks.storagePut).toHaveBeenNthCalledWith(1, expect.stringContaining("/transfer/"), pdf, "application/octet-stream");
    expect(storageMocks.storagePut).toHaveBeenNthCalledWith(2, expect.stringMatching(/^academy\/10\//), pdf, "application/pdf");
    expect(finalized.url).toBe("/uploads/academy/10/lesson.pdf");
  });
});
