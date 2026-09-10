import type { Express, Request, Response } from "express";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { get, issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned } from "@vercel/blob/client";
import { sdk } from "./sdk.js";
import {
  validateDirectUpload,
  MAX_PDF_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
} from "../uploadPolicy.js";

export const BLOB_NOT_CONFIGURED_MESSAGE =
  "خدمة التخزين السحابي (Vercel Blob) غير مُهيأة بعد: اضبطي متغير BLOB_READ_WRITE_TOKEN (أو BLOB_STORE_ID) في إعدادات مشروع Vercel ثم أعيدي المحاولة.";

/**
 * The Vercel Blob SDK needs one of:
 * - `BLOB_READ_WRITE_TOKEN` (long-lived read/write token), or
 * - `BLOB_STORE_ID` — on Vercel the `VERCEL_OIDC_TOKEN` environment variable is
 *   injected automatically, which is enough for OIDC auth.
 */
export function hasBlobCredentials(): boolean {
  return (
    Boolean(process.env.BLOB_READ_WRITE_TOKEN) ||
    Boolean(process.env.BLOB_STORE_ID)
  );
}

/** True when the failure is "no blob credentials configured" (not a real storage error). */
export function isBlobNotConfiguredError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error);
  return /No blob credentials found|Vercel Blob[\s):)]*غير/i.test(message);
}

export function warnIfBlobNotConfigured(): void {
  if (process.env.VERCEL === "1" && !hasBlobCredentials()) {
    console.warn(
      "[VercelBlob] تحذير: لا توجد بيانات اعتماد Vercel Blob — رفع الملفات وقراءة الملفات الخاصة لن يعمل. " +
        "اربطي Blob Store بالمشروع واضبطي BLOB_READ_WRITE_TOKEN (أو BLOB_STORE_ID) في Environment Variables ثم أعيدي النشر. " +
        "(No blob credentials found: set BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID in the project environment variables.)",
    );
  }
}

export function registerVercelBlobUploadRoute(app: Express) {
  app.post("/api/blob-upload", async (req: Request, res: Response) => {
    if (!hasBlobCredentials()) {
      console.warn(
        "[VercelBlob] Upload rejected: blob credentials are not configured.",
      );
      return res.status(503).json({ error: BLOB_NOT_CONFIGURED_MESSAGE });
    }
    try {
      const result = await handleUploadPresigned({
        body: req.body,
        request: req,
        getSignedToken: async (pathname, _clientPayload, _multipart) => {
          const user = await sdk.authenticateRequest(req);

          if (user.role !== "admin") {
            throw new Error("غير مصرح لكِ برفع الملفات.");
          }

          const fileName = pathname.split("/").pop() || pathname;
          const extension = fileName.split(".").pop()?.toLowerCase();

          const mimeType =
            extension === "pdf"
              ? "application/pdf"
              : extension === "mp4"
                ? "video/mp4"
                : extension === "webm"
                  ? "video/webm"
                  : extension === "ogg"
                    ? "video/ogg"
                    : extension === "mov"
                      ? "video/quicktime"
                      : "";

          const validation = validateDirectUpload({
            fileName,
            mimeType,
            bytes: 1,
          });

          if (!validation.ok) {
            throw new Error(validation.message);
          }

          const maxBytes = validation.mimeType.startsWith("video/")
            ? MAX_VIDEO_UPLOAD_BYTES
            : MAX_PDF_UPLOAD_BYTES;

          const token = await issueSignedToken({
            pathname,
            operations: ["put"],
            validUntil: Date.now() + 2 * 60 * 60 * 1000,
            allowedContentTypes: [validation.mimeType],
            maximumSizeInBytes: maxBytes,
          });

          // NOTE: `urlOptions` only accepts presign-URL fields in @vercel/blob v2.
          // `access`/`contentType` come from the client's `uploadPresigned` options,
          // while the signed token already scopes pathname + content type + size.
          return { token };
        },

        onUploadCompleted: async ({ blob }) => {
          console.log(
            "[VercelBlob] Presigned upload completed",
            blob.url,
          );
        },
      });

      return res.json(result);
    } catch (error) {
      if (isBlobNotConfiguredError(error)) {
        console.warn(
          "[VercelBlob] Upload rejected: blob credentials are not configured.",
        );
        return res.status(503).json({ error: BLOB_NOT_CONFIGURED_MESSAGE });
      }

      console.error(
        "[VercelBlob] Presigned upload failed",
        error,
      );

      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "تعذر تجهيز رفع الملف.",
      });
    }
  });
}

function isAllowedBlobPath(pathname: string) {
  return (
    pathname.startsWith("academy/") &&
    !pathname.includes("..") &&
    !pathname.includes("\\")
  );
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

      if (!hasBlobCredentials()) {
        console.warn(
          "[VercelBlob] Private file read rejected: blob credentials are not configured.",
        );
        return res.status(503).send(BLOB_NOT_CONFIGURED_MESSAGE);
      }

      const result = await get(pathname, {
        access: "private",
        ifNoneMatch:
          req.header("if-none-match") ?? undefined,
      });

      if (!result) {
        return res.status(404).send("الملف غير موجود.");
      }

      if (result.statusCode === 304) {
        res.status(304);
        res.setHeader("ETag", result.blob.etag);
        res.setHeader(
          "Cache-Control",
          "private, no-cache",
        );
        return res.end();
      }

      res.status(200);

      res.setHeader(
        "Content-Type",
        result.blob.contentType ||
          "application/octet-stream",
      );

      res.setHeader(
        "X-Content-Type-Options",
        "nosniff",
      );

      res.setHeader("ETag", result.blob.etag);

      res.setHeader(
        "Cache-Control",
        "private, no-cache",
      );

      if (result.blob.contentDisposition) {
        res.setHeader(
          "Content-Disposition",
          result.blob.contentDisposition,
        );
      }

      if (
        result.blob.size !== undefined &&
        result.blob.size !== null
      ) {
        res.setHeader(
          "Content-Length",
          String(result.blob.size),
        );
      }

      if (!result.stream) {
        return res.end();
      }

      Readable.fromWeb(
        result.stream as unknown as WebReadableStream,
      ).pipe(res);
    } catch (error) {
      if (isBlobNotConfiguredError(error)) {
        console.warn(
          "[VercelBlob] Private file read rejected: blob credentials are not configured.",
        );
        return res.status(503).send(BLOB_NOT_CONFIGURED_MESSAGE);
      }

      console.error(
        "[VercelBlob] Private file read failed",
        error,
      );

      return res
        .status(500)
        .send("تعذر قراءة الملف حالياً.");
    }
  });
}
