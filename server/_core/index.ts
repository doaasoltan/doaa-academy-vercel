import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { registerLocalAuthRoutes } from "./localAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { storagePut } from "../storage";
import { validateDirectUpload, MAX_PDF_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from "../uploadPolicy";
import { sdk } from "./sdk";
import { ensureAdminAccount } from "./localAuth";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));
  registerStorageProxy(app);
  registerLocalAuthRoutes(app);

  // Local binary upload endpoint: avoids JSON/base64 limits and stores files locally.
  app.post(
    "/api/local-upload",
    express.raw({ type: ["application/octet-stream", "application/pdf", "video/*"], limit: "100mb" }),
    async (req, res) => {
      try {
        const user = await sdk.authenticateRequest(req);
        if (user.role !== "admin") return res.status(403).json({ error: "غير مصرح لكِ برفع الملفات." });
        const nameHeader = req.headers["x-file-name"];
        const encodedName = Array.isArray(nameHeader) ? nameHeader[0] : nameHeader;
        const fileName = encodedName ? decodeURIComponent(encodedName) : "";
        const typeHeader = req.headers["x-file-type"];
        const mimeType = (Array.isArray(typeHeader) ? typeHeader[0] : typeHeader) || req.headers["content-type"] || "";
        const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
        const validation = validateDirectUpload({ fileName, mimeType, bytes: body.byteLength });
        if (!validation.ok) return res.status(validation.status).json({ error: validation.message });
        const maxBytes = validation.mimeType.startsWith("video/") ? MAX_VIDEO_UPLOAD_BYTES : MAX_PDF_UPLOAD_BYTES;
        if (body.byteLength > maxBytes) return res.status(413).json({ error: validation.mimeType.startsWith("video/") ? "الحد الأقصى لحجم الفيديو هو 100 ميغابايت." : "الحد الأقصى لحجم ملف PDF هو 50 ميغابايت." });
        const stored = await storagePut(`academy/${user.id}/${Date.now()}-${validation.safeName}`, body, validation.mimeType);
        return res.json({ url: stored.url, key: stored.key, name: validation.safeName });
      } catch (error) {
        console.error("[LocalUpload] Upload failed", error);
        return res.status(500).json({ error: error instanceof Error ? error.message : "تعذر رفع الملف حالياً." });
      }
    },
  );

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  try {
    await ensureAdminAccount();
  } catch (error) {
    console.error("[Auth] تعذر تجهيز حساب الأدمن:", error);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
