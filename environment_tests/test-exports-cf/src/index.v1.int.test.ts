import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

/**
 * Integration tests for LangChain v1 Cloudflare Workers compatibility.
 *
 * These tests require API keys and make actual API calls to test
 * end-to-end functionality of LangChain v1 in Cloudflare Workers.
 *
 * LangChain v1 uses dynamic imports to gracefully handle environments
 * without node:async_hooks, so no nodejs_compat flag is required.
 */
describe("LangChain v1 Worker Integration", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.v1.ts", {
      experimental: { disableExperimentalWarning: true },
      config: "wrangler.v1.toml",
    });
  }, 60000);

  afterAll(async () => {
    await worker.stop();
  });

  it("should return success for integration endpoint", async () => {
    const resp = await worker.fetch("/integration");
    expect(resp.ok).toBe(true);

    const result = await resp.json();

    // If we have API keys, the live chain test should have run
    if (result.tests.liveChain) {
      expect(result.tests.liveChain.success).toBe(true);
    }
  }, 60000);
});
