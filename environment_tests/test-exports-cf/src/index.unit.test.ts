import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

describe("Worker", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
      compatibilityFlags: ["nodejs_compat"],
      experimental: { disableExperimentalWarning: true },
    });
  }, 30000);

  afterAll(async () => {
    await worker.stop();
  });

  it("should count tokens", async () => {
    const response = await worker.fetch("http://example.com/token-count");

    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toEqual({ maxTokens: 4095 });
  }, 30000);
});
