import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import type { Express, Request, Response } from "express";
import * as db from "../db.js";
import { getSessionCookieOptions } from "./cookies.js";
import { sdk } from "./sdk.js";
import { hashPassword, normalizeEmail, validatePassword, verifyPassword } from "./auth.js";
import crypto from "node:crypto";
import { ENV } from "./env.js";

function setSession(res: Response, req: Request, token: string) {
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
}

export async function ensureAdminAccount() {
  if (!ENV.adminEmail || !ENV.adminPassword) {
    console.warn("[Auth] ADMIN_EMAIL/ADMIN_PASSWORD غير مضبوطين؛ لم يتم إنشاء حساب الأدمن تلقائيًا.");
    return;
  }
  const email = normalizeEmail(ENV.adminEmail);
  const passwordError = validatePassword(ENV.adminPassword);
  if (passwordError) throw new Error(`ADMIN_PASSWORD غير صالح: ${passwordError}`);
  const existing = await db.getUserByEmail(email);
  const passwordHash = await hashPassword(ENV.adminPassword);
  if (existing) {
    await db.upsertUser({ openId: existing.openId, name: ENV.adminName || "مديرة الأكاديمية", email, loginMethod: "password", role: "admin", passwordHash, lastSignedIn: existing.lastSignedIn });
    return;
  }
  await db.createUser({ openId: `admin-${crypto.randomUUID()}`, name: ENV.adminName || "مديرة الأكاديمية", email, loginMethod: "password", role: "admin", passwordHash });
  console.log(`[Auth] تم إنشاء حساب الأدمن: ${email}`);
}

export function registerLocalAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const name = String(req.body?.name ?? "").trim();
      const email = normalizeEmail(String(req.body?.email ?? ""));
      const password = String(req.body?.password ?? "");
      if (name.length < 2) return res.status(400).json({ error: "الاسم مطلوب." });
      if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "أدخلي بريدًا إلكترونيًا صحيحًا." });
      const passwordError = validatePassword(password);
      if (passwordError) return res.status(400).json({ error: passwordError });
      if (ENV.adminEmail && email === normalizeEmail(ENV.adminEmail)) return res.status(409).json({ error: "هذا البريد مخصص لحساب الإدارة." });
      if (await db.getUserByEmail(email)) return res.status(409).json({ error: "البريد الإلكتروني مستخدم بالفعل." });
      const openId = `user-${crypto.randomUUID()}`;
      const passwordHash = await hashPassword(password);
      await db.createUser({ openId, name, email, loginMethod: "password", role: "user", passwordHash });
      const token = await sdk.createSessionToken(openId, { name, expiresInMs: ONE_YEAR_MS });
      setSession(res, req, token);
      return res.json({ success: true, user: { name, email, role: "user" } });
    } catch (error) {
      console.error("[Auth] Register failed", error);
      return res.status(500).json({ error: "تعذر إنشاء الحساب حاليًا." });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const email = normalizeEmail(String(req.body?.email ?? ""));
      const password = String(req.body?.password ?? "");
      if (!email || !password) return res.status(400).json({ error: "أدخلي البريد الإلكتروني وكلمة المرور." });
      const user = await db.getUserByEmail(email);
      if (!user || !(await verifyPassword(password, user.passwordHash))) return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      const token = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
      setSession(res, req, token);
      return res.json({ success: true, user: { name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      return res.status(500).json({ error: "تعذر تسجيل الدخول حاليًا." });
    }
  });

  // Backward-compatible local shortcut for development only. Never enabled in production.
  if (!ENV.isProduction && ENV.localAuth) {
    app.get("/api/local-login", async (req: Request, res: Response) => {
      const requestedRole = req.query.role === "admin" ? "admin" : "user";
      const email = requestedRole === "admin" ? ENV.adminEmail : "student@local.test";
      const user = email ? await db.getUserByEmail(normalizeEmail(email)) : undefined;
      if (!user) return res.redirect(302, `/login?error=${encodeURIComponent("أنشئي حسابًا أولًا")}`);
      const token = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
      setSession(res, req, token);
      res.redirect(302, requestedRole === "admin" ? "/admin" : "/student");
    });
  }
}
