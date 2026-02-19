import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

/**
 * Unit tests for LangChain v1 Cloudflare Workers compatibility.
 *
 * These tests verify that:
 * 1. The worker can start successfully with all v1 imports
 * 2. Core v1 functionality works in the CF Workers environment
 *
 * LangChain v1 uses dynamic imports with top-level await to gracefully
 * handle environments without node:async_hooks. This means it can run
 * in Cloudflare Workers WITHOUT the nodejs_compat flag.
 */
describe("LangChain v1 Worker", () => {
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

  it("should start the worker successfully", async () => {
    expect(worker).toBeDefined();
  });

  it("should pass all v1 unit tests", async () => {
    const resp = await worker.fetch();
    expect(resp.ok).toBe(true);

    const result = await resp.json();
    expect(result.status).toBe("success");
    expect(result.message).toContain("All LangChain v1 tests passed");
  }, 30000);

  it("should pass message types tests", async () => {
    const resp = await worker.fetch();
    const result = await resp.json();

    expect(result.tests.messageTypes.success).toBe(true);
  }, 30000);

  it("should pass tool creation tests", async () => {
    const resp = await worker.fetch();
    const result = await resp.json();

    expect(result.tests.toolCreation.success).toBe(true);
  }, 30000);

  it("should pass document and store tests", async () => {
    const resp = await worker.fetch();
    const result = await resp.json();

    expect(result.tests.documentAndStore.success).toBe(true);
  }, 30000);

  it("should pass initChatModel types tests", async () => {
    const resp = await worker.fetch();
    const result = await resp.json();

    expect(result.tests.initChatModelTypes.success).toBe(true);
  }, 30000);

  it("should pass chain creation tests", async () => {
    const resp = await worker.fetch();
    const result = await resp.json();

    expect(result.tests.chainCreation.success).toBe(true);
  }, 30000);
});

