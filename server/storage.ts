import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { put } from "@vercel/blob";

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
const isVercel = process.env.VERCEL === "1" || Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function normalizeKey(relKey: string): string { return relKey.replace(/^\/+/, "").replace(/\\/g, "/"); }
function safePath(relKey: string): string {
  const key = normalizeKey(relKey); const full = path.resolve(UPLOAD_ROOT, key);
  if (full !== UPLOAD_ROOT && !full.startsWith(UPLOAD_ROOT + path.sep)) throw new Error("Invalid storage path");
  return full;
}
function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8); const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  if (isVercel) {
    const blob = await put(key, typeof data === "string" ? Buffer.from(data) : data, { access: "public", contentType });
    return { key, url: blob.url };
  }
  const filePath = safePath(key); await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, typeof data === "string" ? Buffer.from(data) : Buffer.from(data));
  return { key, url: `/uploads/${encodeURI(key).replace(/#/g, "%23")}` };
}
export async function storageGet(relKey: string) { const key = normalizeKey(relKey); return { key, url: `/uploads/${encodeURI(key).replace(/#/g, "%23")}` }; }
export async function storageGetBuffer(relKey: string): Promise<Buffer> {
  if (isVercel && /^https?:\/\//.test(relKey)) { const r = await fetch(relKey); if (!r.ok) throw new Error("Unable to read remote object"); return Buffer.from(await r.arrayBuffer()); }
  return fs.readFile(safePath(relKey));
}
export async function storageGetSignedUrl(relKey: string): Promise<string> { return `/uploads/${encodeURI(normalizeKey(relKey)).replace(/#/g, "%23")}`; }
