import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  createLesson: vi.fn(),
  getLearningPaths: vi.fn(),
  getLessonsByPath: vi.fn(),
  getAssessmentsByPath: vi.fn(),
}));
const chunkMocks = vi.hoisted(() => ({
  MAX_UPLOAD_CHUNKS: 9000,
  storeUploadChunk: vi.fn(),
  finalizeChunkedUpload: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./chunkedUpload", () => chunkMocks);

import { appRouter } from "./routers";

function adminContext(): TrpcContext {
  return {
    user: { id: 1, openId: "admin-open-id", name: "دعاء", email: "academy@example.test", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("uploaded file to catalog visibility", () => {
  it("carries a video from chunk upload into a published catalog lesson", async () => {
    chunkMocks.storeUploadChunk.mockResolvedValue({ key: "academy/1/transfer/video.part" });
    chunkMocks.finalizeChunkedUpload.mockResolvedValue({ key: "academy/1/video.mp4", url: "/uploads/academy/1/video.mp4" });
    dbMocks.createLesson.mockResolvedValue({ id: 31 });
    dbMocks.getLearningPaths.mockResolvedValue([{ id: 3, title: "أساسيات البرمجة", isPublished: true }]);
    dbMocks.getLessonsByPath.mockResolvedValue([{ id: 31, pathId: 3, title: "فيديو محفوظ", lessonType: "video", sourceUrl: "/uploads/academy/1/video.mp4", isPublished: true }]);
    dbMocks.getAssessmentsByPath.mockResolvedValue([]);

    const admin = appRouter.createCaller(adminContext());
    const chunk = await admin.admin.uploadChunk({ uploadId: "33333333-3333-4333-8333-333333333333", chunkIndex: 0, chunkData: "AAAA" });
    const finalized = await admin.admin.finalizeUpload({ uploadId: "33333333-3333-4333-8333-333333333333", fileName: "video.mp4", mimeType: "video/mp4", chunkKeys: [chunk.key] });
    await admin.admin.createLesson({ pathId: 3, title: "فيديو محفوظ", lessonType: "video", sourceUrl: finalized.url, durationMinutes: 12, position: 1 });
    const catalog = await admin.catalog.pathContent({ pathId: 3 });

    expect(chunkMocks.storeUploadChunk).toHaveBeenCalledOnce();
    expect(chunkMocks.finalizeChunkedUpload).toHaveBeenCalledWith(expect.objectContaining({ chunkKeys: [chunk.key], mimeType: "video/mp4" }));
    expect(dbMocks.createLesson).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: finalized.url }));
    expect(catalog.lessons[0]).toMatchObject({ sourceUrl: "/uploads/academy/1/video.mp4", isPublished: true });
  });
});
