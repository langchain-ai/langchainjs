import { test, describe, expect } from "vitest";
import { RunnableLambda } from "../base.js";
import { FakeStreamingLLM } from "../../utils/testing/index.js";

describe("streamTimeout", () => {
  test("Stream should complete when chunks arrive within timeout", async () => {
    // LLM with 50ms delay between chunks
    const llm = new FakeStreamingLLM({
      sleep: 50,
      responses: ["hello"],
    });

    const chunks: string[] = [];
    // 200ms timeout - much longer than the 50ms delay between chunks
    const stream = await llm.stream("test", {
      streamTimeout: 200,
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("hello");
  });

  test("Stream should timeout when no chunks arrive within the timeout period", async () => {
    // LLM with 500ms delay between chunks
    const llm = new FakeStreamingLLM({
      sleep: 500,
      responses: ["hello world"],
    });

    // 100ms timeout - shorter than the 500ms delay between chunks
    await expect(async () => {
      const stream = await llm.stream("test", {
        streamTimeout: 100,
      });

      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
    }).rejects.toThrow(/Stream timeout/);
  });

  test("Stream should reset timeout on each chunk", async () => {
    // LLM with 80ms delay between chunks
    const llm = new FakeStreamingLLM({
      sleep: 80,
      responses: ["abcdefgh"], // 8 chunks
    });

    const chunks: string[] = [];
    // 150ms timeout - longer than 80ms delay, so each chunk should reset the timer
    const stream = await llm.stream("test", {
      streamTimeout: 150,
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    // Should get all chunks because timeout resets on each chunk
    expect(chunks.join("")).toBe("abcdefgh");
  });

  test("Stream should work with RunnableLambda that yields chunks", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const slowGenerator = RunnableLambda.from(async function* (
      _input: unknown
    ) {
      for (const char of "test") {
        await new Promise((resolve) => setTimeout(resolve, 50));
        yield char;
      }
    });

    const chunks: unknown[] = [];
    const stream = await slowGenerator.stream({}, { streamTimeout: 200 });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("test");
  });

  test("Stream should timeout with RunnableLambda when chunks are too slow", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const verySlowGenerator = RunnableLambda.from(async function* (
      _input: unknown
    ) {
      for (const char of "test") {
        await new Promise((resolve) => setTimeout(resolve, 300));
        yield char;
      }
    });

    await expect(async () => {
      const stream = await verySlowGenerator.stream({}, { streamTimeout: 100 });
      for await (const _ of stream) {
        // consume stream
      }
    }).rejects.toThrow(/Stream timeout/);
  });

  test("streamTimeout should work alongside regular timeout", async () => {
    // LLM with 50ms delay between chunks
    const llm = new FakeStreamingLLM({
      sleep: 50,
      responses: ["hi"],
    });

    const chunks: string[] = [];
    // Both timeouts set
    const stream = await llm.stream("test", {
      timeout: 5000, // Long overall timeout
      streamTimeout: 200, // Per-chunk timeout
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("hi");
  });

  test("streamTimeout should work with signal", async () => {
    const llm = new FakeStreamingLLM({
      sleep: 50,
      responses: ["hello"],
    });

    const controller = new AbortController();
    const chunks: string[] = [];
    const stream = await llm.stream("test", {
      streamTimeout: 200,
      signal: controller.signal,
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("hello");
  });

  test("streamTimeout in mergeConfigs should take minimum value", async () => {
    // Create a RunnableLambda that wraps the streaming LLM
    const llm = new FakeStreamingLLM({
      sleep: 50,
      responses: ["hi"],
    });

    // Create a runnable sequence that has streamTimeout in config
    const runnable = RunnableLambda.from(async function* (input: string) {
      for await (const chunk of await llm.stream(input)) {
        yield chunk;
      }
    });

    // Bind with 300ms streamTimeout via withConfig
    const boundRunnable = runnable.withConfig({
      streamTimeout: 300,
    });

    const chunks: unknown[] = [];

    // Call with 200ms timeout - the shorter one should be used via mergeConfigs
    const stream = await boundRunnable.stream("test", {
      streamTimeout: 200,
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("hi");
  });

  test("streamTimeout validation should reject non-positive values", async () => {
    const llm = new FakeStreamingLLM({
      sleep: 50,
      responses: ["hi"],
    });

    await expect(async () => {
      await llm.stream("test", {
        streamTimeout: 0,
      });
    }).rejects.toThrow(/Stream timeout must be a positive number/);

    await expect(async () => {
      await llm.stream("test", {
        streamTimeout: -100,
      });
    }).rejects.toThrow(/Stream timeout must be a positive number/);
  });
});
