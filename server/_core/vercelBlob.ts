import type { Express, Request, Response } from "express";
import { Readable } from "node:stream";
import { get } from "@vercel/blob";
import { handleUpload } from "@vercel/blob/client";
import { sdk } from "./sdk.js";
import { validateDirectUpload, MAX_PDF_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from "../uploadPolicy.js";

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


function isAllowedBlobPath(pathname: string) {
  return pathname.startsWith("academy/") &&
    !pathname.includes("..") &&
    !pathname.includes("\\");
}

export function registerVercelBlobReadRoute(app: Express) {
  app.get("/api/blob-file", async (req: Request, res: Response) => {
    try {
      await sdk.authenticateRequest(req);

      const rawPathname = String(req.query.pathname ?? "");
      const pathname = rawPathname.replace(/^\/+/, "");

      if (!pathname || !isAllowedBlobPath(pathname)) {
        return res.status(400).send("مسار الملف غير صالح.");
      }

      const result = await get(pathname, {
        access: "private",
        ifNoneMatch: req.header("if-none-match") ?? undefined,
      });

      if (!result) {
        return res.status(404).send("الملف غير موجود.");
      }

      if (result.statusCode === 304) {
        res.status(304);
        res.setHeader("ETag", result.blob.etag);
        res.setHeader("Cache-Control", "private, no-cache");
        return res.end();
      }

      res.status(200);
      res.setHeader("Content-Type", result.blob.contentType || "application/octet-stream");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("ETag", result.blob.etag);
      res.setHeader("Cache-Control", "private, no-cache");

      if (result.blob.contentDisposition) {
        res.setHeader("Content-Disposition", result.blob.contentDisposition);
      }
      if (result.blob.size !== undefined && result.blob.size !== null) {
        res.setHeader("Content-Length", String(result.blob.size));
      }

      if (!result.stream) {
        return res.end();
      }

      Readable.fromWeb(
        result.stream as globalThis.ReadableStream<Uint8Array>,
      ).pipe(res);
    } catch (error) {
      console.error("[VercelBlob] Private file read failed", error);
      return res.status(500).send("تعذر قراءة الملف حالياً.");
    }
  });
}
