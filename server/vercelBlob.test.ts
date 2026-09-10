import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import express from "express";

const blobMocks = vi.hoisted(() => ({
  get: vi.fn(),
  issueSignedToken: vi.fn(),
  handleUploadPresigned: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  get: blobMocks.get,
  issueSignedToken: blobMocks.issueSignedToken,
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

function toWebStream(data: Buffer) {
  return Readable.toWeb(Readable.from([data])) as unknown as ReadableStream;
}

beforeEach(() => {
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("BLOB_STORE_ID", "");
  sdkMocks.authenticateRequest.mockResolvedValue({ role: "admin" });
});

afterEach(async () => {
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
    const sdkError = new Error(
      "Vercel Blob: No blob credentials found. Pass a `token` option, set `BLOB_READ_WRITE_TOKEN`, or use `oidcToken` (or `VERCEL_OIDC_TOKEN`) with `storeId` or `BLOB_STORE_ID`.",
    );
    expect(isBlobNotConfiguredError(sdkError)).toBe(true);
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
      );

      expect(response.status).toBe(503);
      expect(await response.text()).toBe(BLOB_NOT_CONFIGURED_MESSAGE);
      expect(blobMocks.get).not.toHaveBeenCalled();
    } finally {
      server.close();
    }
  });

  it("keeps validating the pathname before the credentials check", async () => {
    const { server, base } = await startApp();

    try {
      const response = await fetch(
        `${base}/api/blob-file?pathname=${encodeURIComponent("../etc/passwd")}`,
      );

      expect(response.status).toBe(400);
      expect(blobMocks.get).not.toHaveBeenCalled();
    } finally {
      server.close();
    }
  });

  it("reads through the SDK when a store id is configured", async () => {
    vi.stubEnv("BLOB_STORE_ID", "abc123");
    const body = Buffer.from("video-bytes");
    blobMocks.get.mockResolvedValue({
      statusCode: 200,
      stream: toWebStream(body),
      blob: {
        url: "https://abc123.private.blob.vercel-storage.com/academy/lesson.mp4",
        pathname: "academy/lesson.mp4",
        contentType: "video/mp4",
        contentDisposition: "",
        size: body.byteLength,
        etag: "etag-1",
      },
    });

    const { server, base } = await startApp();

    try {
      const response = await fetch(
        `${base}/api/blob-file?pathname=${encodeURIComponent("academy/lesson.mp4")}`,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("video/mp4");
      expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
        body.toString(),
      );
      expect(blobMocks.get).toHaveBeenCalledWith(
        "academy/lesson.mp4",
        expect.objectContaining({ access: "private" }),
      );
    } finally {
      server.close();
    }
  });

  it("still returns 503 if the SDK rejects auth mid-request", async () => {
    vi.stubEnv("BLOB_STORE_ID", "abc123");
    blobMocks.get.mockRejectedValue(
      new Error(
        "Vercel Blob: No blob credentials found. Pass a `token` option, set `BLOB_READ_WRITE_TOKEN`, or use `oidcToken` (or `VERCEL_OIDC_TOKEN`) with `storeId` or `BLOB_STORE_ID`.",
      ),
    );

    const { server, base } = await startApp();

    try {
      const response = await fetch(
        `${base}/api/blob-file?pathname=${encodeURIComponent("academy/lesson.mp4")}`,
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
    blobMocks.issueSignedToken.mockResolvedValue("signed-token-123");
    blobMocks.handleUploadPresigned.mockImplementation(
      async (config: {
        getSignedToken: (
          pathname: string,
          clientPayload: unknown,
          multipart: boolean,
        ) => Promise<{ token: string }>;
      }) => {
        const { token } = await config.getSignedToken(
          "academy/lesson.pdf",
          null,
          false,
        );
        return { status: 200, body: JSON.stringify({ token }) };
      },
    );

    const { server, base } = await startApp();

    try {
      const response = await fetch(`${base}/api/blob-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathname: "academy/lesson.pdf" }),
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(blobMocks.issueSignedToken).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "academy/lesson.pdf" }),
      );
      expect(data.body).toContain("signed-token-123");
    } finally {
      server.close();
    }
  });
});
