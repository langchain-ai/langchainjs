import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

describe("@langchain/core Worker (no nodejs_compat)", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.core.ts", {
      experimental: { disableExperimentalWarning: true },
      config: "wrangler.core.toml",
    });
  }, 30000);

  afterAll(async () => {
    await worker.stop();
  });

  it("should pass all core unit tests", async () => {
    const resp = await worker.fetch("/test");
    expect(resp.status).toBe(200);

    const data = await resp.json();
    console.log("@langchain/core test results:", JSON.stringify(data, null, 2));

    expect(data.success).toBe(true);
  }, 30000);

  it("should pass message types tests", async () => {
    const resp = await worker.fetch("/test/messages");
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.success).toBe(true);
  }, 30000);

  it("should pass tool creation tests", async () => {
    const resp = await worker.fetch("/test/tools");
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.success).toBe(true);
    expect(data.result).toBe("5");
  }, 30000);

  it("should pass runnable composition tests", async () => {
    const resp = await worker.fetch("/test/runnables");
    expect(resp.status).toBe(200);

    const data = await resp.json();
    expect(data.success).toBe(true);
    expect(data.result).toBe(12);
  }, 30000);
});

