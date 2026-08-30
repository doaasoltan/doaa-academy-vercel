import { describe, expect, it } from "vitest";

describe("built-in forge environment", () => {
  it("uses the configured secret for a lightweight API request", async () => {
    const baseUrl = process.env.BUILT_IN_FORGE_API_URL;
    const secret = process.env.DUMMY_KEY;
    expect(baseUrl).toBeTruthy();
    expect(secret).toBeTruthy();
    const response = await fetch(`${baseUrl!.replace(/\/$/, "")}/v1/models`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    expect(response.status).toBeLessThan(500);
  });
});
