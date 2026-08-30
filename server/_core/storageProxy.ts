import type { Express } from "express";
import path from "node:path";
import express from "express";

export function registerStorageProxy(app: Express) {
  const uploadRoot = path.resolve(process.cwd(), "uploads");
  app.use("/uploads", express.static(uploadRoot, {
    fallthrough: false,
    index: false,
    maxAge: "1h",
  }));
}
