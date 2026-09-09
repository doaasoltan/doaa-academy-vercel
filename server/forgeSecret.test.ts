import { describe, expect, it } from "vitest";

// This test targets the Manus built-in Forge environment and requires
// platform-provided secrets. On Vercel/local setups those variables do not
// exist, so the test is skipped to keep the suite green.
const hasForgeEnv = Boolean(process.env.BUILT_IN_FORGE_API_URL && process.env.DUMMY_KEY);

describe("built-in forge environment", () => {
  it.skipIf(!hasForgeEnv)("uses the configured secret for a lightweight API request", async () => {
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
