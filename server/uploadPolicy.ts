export const MAX_PDF_UPLOAD_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 1024 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = MAX_PDF_UPLOAD_BYTES;

export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
] as const;

export type UploadMimeType = (typeof ALLOWED_UPLOAD_TYPES)[number];

type UploadValidation =
  | { ok: true; safeName: string; mimeType: UploadMimeType }
  | { ok: false; status: number; message: string };

export function validateDirectUpload(input: { fileName?: string; mimeType?: string; bytes: number }): UploadValidation {
  if (!input.fileName?.trim()) return { ok: false, status: 400, message: "اسم الملف مفقود." };
  if (!input.mimeType || !ALLOWED_UPLOAD_TYPES.includes(input.mimeType as UploadMimeType)) {
    return { ok: false, status: 415, message: "نوع الملف غير مدعوم. ارفعي PDF أو MP4 أو WEBM أو OGG أو MOV." };
  }
  if (!Number.isFinite(input.bytes) || input.bytes < 1) return { ok: false, status: 400, message: "الملف فارغ أو غير صالح." };
  const isVideo = input.mimeType.startsWith("video/");
  const maxBytes = isVideo ? MAX_VIDEO_UPLOAD_BYTES : MAX_PDF_UPLOAD_BYTES;
  if (input.bytes > maxBytes) return { ok: false, status: 413, message: isVideo ? "الحد الأقصى لحجم الفيديو هو 1 جيجابايت." : "الحد الأقصى لحجم ملف PDF هو 100 ميغابايت." };

  return {
    ok: true,
    safeName: input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 220),
    mimeType: input.mimeType as UploadMimeType,
  };
}
