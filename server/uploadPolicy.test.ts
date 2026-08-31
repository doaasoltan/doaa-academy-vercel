import { describe, expect, it } from "vitest";
import { MAX_PDF_UPLOAD_BYTES, MAX_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES, validateDirectUpload } from "./uploadPolicy.js";

describe("validateDirectUpload", () => {
  it.each([
    ["lesson.pdf", "application/pdf"],
    ["lesson.mp4", "video/mp4"],
  ])("accepts a direct %s upload", (fileName, mimeType) => {
    expect(validateDirectUpload({ fileName, mimeType, bytes: 1024 })).toMatchObject({ ok: true });
  });

  it("keeps PDF limited to 50 MB while allowing video up to 100 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(MAX_PDF_UPLOAD_BYTES);
    expect(validateDirectUpload({ fileName: "lesson.pdf", mimeType: "application/pdf", bytes: MAX_PDF_UPLOAD_BYTES + 1 })).toMatchObject({ ok: false, status: 413, message: "الحد الأقصى لحجم ملف PDF هو 50 ميغابايت." });
    expect(validateDirectUpload({ fileName: "large.mp4", mimeType: "video/mp4", bytes: MAX_VIDEO_UPLOAD_BYTES - 1 })).toMatchObject({ ok: true });
    expect(validateDirectUpload({ fileName: "too-large.mp4", mimeType: "video/mp4", bytes: MAX_VIDEO_UPLOAD_BYTES + 1 })).toMatchObject({ ok: false, status: 413, message: "الحد الأقصى لحجم الفيديو هو 100 ميغابايت." });
  });

  it("rejects unsupported MIME types", () => {
    expect(validateDirectUpload({ fileName: "file.exe", mimeType: "application/octet-stream", bytes: 50 })).toMatchObject({ ok: false, status: 415 });
  });
});
