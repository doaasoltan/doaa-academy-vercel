import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import express from "express";

const blobMocks = vi.hoisted(() => ({
  issueSignedToken: vi.fn(),
  presignUrl: vi.fn(),
  handleUploadPresigned: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  issueSignedToken: blobMocks.issueSignedToken,
  presignUrl: blobMocks.presignUrl,
}));

vi.mock("@vercel/blob/client", () => ({
  handleUploadPresigned: blobMocks.handleUploadPresigned,
}));

const sdkMocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
}));

vi.mock("./_core/sdk.js", () => ({
  sdk: sdkMocks,
}));

import {
  BLOB_NOT_CONFIGURED_MESSAGE,
  hasBlobCredentials,
  isBlobNotConfiguredError,
  registerVercelBlobReadRoute,
  registerVercelBlobUploadRoute,
  warnIfBlobNotConfigured,
} from "./_core/vercelBlob.js";

const SDK_NO_CREDENTIALS_ERROR =
  "Vercel Blob: No blob credentials found. Pass a `token` option, set `BLOB_READ_WRITE_TOKEN`, or use `oidcToken` (or `VERCEL_OIDC_TOKEN`) with `storeId` or `BLOB_STORE_ID`.";

async function startApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  registerVercelBlobUploadRoute(app);
  registerVercelBlobReadRoute(app);

  const server = app.listen(0);
  await new Promise<void>(resolve =>
    server.once("listening", () => resolve()),
  );

  const { port } = server.address() as AddressInfo;
  return {
    server,
    base: `http://127.0.0.1:${port}`,
  };
}

beforeEach(() => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("BLOB_STORE_ID", "");
  sdkMocks.authenticateRequest.mockResolvedValue({ role: "admin" });
  blobMocks.issueSignedToken.mockResolvedValue({
    clientSigningToken: "client-signing-token",
    delegationToken: "delegation-token",
  });
  blobMocks.presignUrl.mockResolvedValue({
    presignedUrl:
      "https://abc123.private.blob.vercel-storage.com/academy/lesson.mp4?vercel-blob-signature=signed",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("blob credential detection", () => {
  it("reports no credentials when neither env var is set", () => {
    expect(hasBlobCredentials()).toBe(false);
  });

  it("accepts a read-write token", () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "store_abc_token");
    expect(hasBlobCredentials()).toBe(true);
  });

  it("accepts a store id (OIDC auth on Vercel)", () => {
    vi.stubEnv("BLOB_STORE_ID", "abc123");
    expect(hasBlobCredentials()).toBe(true);
  });

  it("recognizes the SDK missing-credentials error", () => {
    expect(isBlobNotConfiguredError(new Error(SDK_NO_CREDENTIALS_ERROR))).toBe(true);
    expect(isBlobNotConfiguredError(BLOB_NOT_CONFIGURED_MESSAGE)).toBe(true);
    expect(
      isBlobNotConfiguredError(new Error("Vercel Blob: Blob not found.")),
    ).toBe(false);
  });

  it("warns at startup only on Vercel without credentials", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.stubEnv("VERCEL", "1");
    warnIfBlobNotConfigured();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "store_abc_token");
    warnIfBlobNotConfigured();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});

describe("/api/blob-file (private read)", () => {
  it("returns 503 with an actionable message when credentials are missing", async () => {
    const { server, base } = await startApp();

    try {
      const response = await fetch(
        `${base}/api/blob-file?pathname=${encodeURIComponent("academy/lesson.mp4")}`,
        { redirect: "manual" },
      );

      expect(response.status).toBe(503);
      expect(await response.text()).toBe(BLOB_NOT_CONFIGURED_MESSAGE);
      expect(blobMocks.issueSignedToken).not.toHaveBeenCalled();
      expect(blobMocks.presignUrl).not.toHaveBeenCalled();
    } finally {
      server.close();
    }
  });

  it("keeps validating the pathname before the credentials check", async () => {
    const { server, base } = await startApp();

    try {
      const response = await fetch(
        `${base}/api/blob-file?pathname=${encodeURIComponent("../etc/passwd")}`,
        { redirect: "manual" },
      );

      expect(response.status).toBe(400);
      expect(blobMocks.issueSignedToken).not.toHaveBeenCalled();
    } finally {
      server.close();
    }
  });

  it("redirects to a signed CDN URL when credentials are configured", async () => {
    vi.stubEnv("BLOB_STORE_ID", "abc123");

    const { server, base } = await startApp();

    try {
      const response = await fetch(
        `${base}/api/blob-file?pathname=${encodeURIComponent("academy/lesson-a.mp4")}`,
        { redirect: "manual" },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        "https://abc123.private.blob.vercel-storage.com/academy/lesson.mp4?vercel-blob-signature=signed",
      );

      // The signed token is scoped to exactly this file and only "get".
      expect(blobMocks.issueSignedToken).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "academy/lesson-a.mp4",
          operations: ["get"],
        }),
      );
      expect(blobMocks.presignUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          clientSigningToken: "client-signing-token",
          delegationToken: "delegation-token",
        }),
        expect.objectContaining({
          operation: "get",
          pathname: "academy/lesson-a.mp4",
          access: "private",
        }),
      );
    } finally {
      server.close();
    }
  });

  it("serves repeated views from the per-instance cache (one token call)", async () => {
    vi.stubEnv("BLOB_STORE_ID", "abc123");

    const { server, base } = await startApp();
    const url = `${base}/api/blob-file?pathname=${encodeURIComponent("academy/lesson-b.mp4")}`;

    try {
      const first = await fetch(url, { redirect: "manual" });
      const second = await fetch(url, { redirect: "manual" });

      expect(first.status).toBe(302);
      expect(second.status).toBe(302);
      expect(first.headers.get("location")).toBe(second.headers.get("location"));
      expect(blobMocks.issueSignedToken).toHaveBeenCalledTimes(1);
      expect(blobMocks.presignUrl).toHaveBeenCalledTimes(1);
    } finally {
      server.close();
    }
  });

  it("still returns 503 if the SDK reports missing credentials mid-request", async () => {
    vi.stubEnv("BLOB_STORE_ID", "abc123");
    blobMocks.issueSignedToken.mockRejectedValue(
      new Error(SDK_NO_CREDENTIALS_ERROR),
    );

    const { server, base } = await startApp();

    try {
      const response = await fetch(
        `${base}/api/blob-file?pathname=${encodeURIComponent("academy/lesson.mp4")}`,
        { redirect: "manual" },
      );

      expect(response.status).toBe(503);
      expect(await response.text()).toBe(BLOB_NOT_CONFIGURED_MESSAGE);
    } finally {
      server.close();
    }
  });
});

describe("/api/blob-upload (presigned upload)", () => {
  it("returns 503 with an actionable message when credentials are missing", async () => {
    const { server, base } = await startApp();

    try {
      const response = await fetch(`${base}/api/blob-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathname: "academy/lesson.pdf" }),
      });

      const data = await response.json();
      expect(response.status).toBe(503);
      expect(data.error).toBe(BLOB_NOT_CONFIGURED_MESSAGE);
      expect(blobMocks.handleUploadPresigned).not.toHaveBeenCalled();
    } finally {
      server.close();
    }
  });

  it("issues a signed token for admins when credentials are configured", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "store_abc_token");
    blobMocks.handleUploadPresigned.mockImplementation(
      async (config: {
        getSignedToken: (
          pathname: string,
          clientPayload: unknown,
          multipart: boolean,
        ) => Promise<{ token: { clientSigningToken: string; delegationToken: string } }>;
      }) => {
        const { token } = await config.getSignedToken(
          "academy/lesson.pdf",
          null,
          false,
        );
        return { status: 200, body: JSON.stringify(token) };
      },
    );

    const { server, base } = await startApp();

    try {
      const response = await fetch(`${base}/api/blob-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathname: "academy/lesson.pdf" }),
      });

      expect(response.status).toBe(200);
      expect(blobMocks.issueSignedToken).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "academy/lesson.pdf" }),
      );
    } finally {
      server.close();
    }
  });
});
