import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerLocalAuthRoutes, ensureAdminAccount } from "../server/_core/localAuth";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerVercelBlobUploadRoute } from "../server/_core/vercelBlob";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));
registerLocalAuthRoutes(app);
registerVercelBlobUploadRoute(app);
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
void ensureAdminAccount().catch(error => console.error("[Auth] تعذر تجهيز حساب الأدمن:", error));
export default app;
