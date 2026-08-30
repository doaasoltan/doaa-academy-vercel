import type { Express, Request, Response } from "express";
import { handleUpload } from "@vercel/blob/client";
import { sdk } from "./sdk";
import { validateDirectUpload, MAX_PDF_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from "../uploadPolicy";

export function registerVercelBlobUploadRoute(app: Express) {
  app.post("/api/blob-upload", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.role !== "admin") return res.status(403).json({ error: "غير مصرح لكِ برفع الملفات." });
      const token = await handleUpload({
        body: req.body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          const fileName = pathname.split("/").pop() || pathname;
          const extension = fileName.split(".").pop()?.toLowerCase();
          const mimeType = extension === "pdf" ? "application/pdf" : extension === "mp4" ? "video/mp4" : extension === "webm" ? "video/webm" : extension === "ogg" ? "video/ogg" : extension === "mov" ? "video/quicktime" : "";
          const validation = validateDirectUpload({ fileName, mimeType, bytes: 1 });
          if (!validation.ok) throw new Error(validation.message);
          const maxBytes = validation.mimeType.startsWith("video/") ? MAX_VIDEO_UPLOAD_BYTES : MAX_PDF_UPLOAD_BYTES;
          return { allowedContentTypes: [validation.mimeType], addRandomSuffix: true, maximumSizeInBytes: maxBytes };
        },
        onUploadCompleted: async ({ blob }) => console.log("[VercelBlob] Upload completed", blob.url),
      });
      return res.json(token);
    } catch (error) {
      console.error("[VercelBlob] Token generation failed", error);
      return res.status(500).json({ error: error instanceof Error ? error.message : "تعذر تجهيز رفع الملف." });
    }
  });
}
