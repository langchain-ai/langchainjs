import { describe, expect, test } from "vitest";

// Start tests/binding/worker.js with Wrangler first. Explicit opt-in: billed AI calls.
const origin = process.env.CLOUDFLARE_WORKERS_AI_BINDING_TEST_URL;
describe.skipIf(!origin)("ChatCloudflareWorkersAI real binding", () => {
  test.each(["invoke", "stream"])(
    "%s in workerd",
    async (mode) => {
      const response = await fetch(new URL(`/${mode}`, origin), {
        signal: AbortSignal.timeout(60_000),
      });
      expect(response.ok).toBe(true);
      const result = (await response.json()) as { text: string };
      expect(result.text.trim()).toBe("READY");
    },
    65_000
  );
});
