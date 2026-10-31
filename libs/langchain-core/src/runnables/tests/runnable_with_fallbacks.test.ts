/* oxlint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";
import { FakeLLM, FakeStreamingLLM } from "../../utils/testing/index.js";
import { RunnableLambda } from "../base.js";
import { AsyncLocalStorageProviderSingleton } from "../../singletons/index.js";

test("RunnableWithFallbacks", async () => {
  const llm = new FakeLLM({
    thrownErrorString: "Bad error!",
  });
  await expect(async () => llm.invoke("What up")).rejects.toThrow();
  const llmWithFallbacks = llm.withFallbacks({
    fallbacks: [new FakeLLM({})],
  });
  const result2 = await llmWithFallbacks.invoke("What up");
  expect(result2).toEqual("What up");
});

test("RunnableWithFallbacks batch", async () => {
  const llm = new FakeLLM({
    thrownErrorString: "Bad error!",
  });
  await expect(async () => llm.batch(["What up"])).rejects.toThrow();

  const llmWithFallbacks = llm.withFallbacks({
    fallbacks: [new FakeLLM({})],
  });
  const result2 = await llmWithFallbacks.batch([
    "What up 1",
    "What up 2",
    "What up 3",
  ]);
  expect(result2).toEqual(["What up 1", "What up 2", "What up 3"]);
});

test("RunnableWithFallbacks batch returns per-input results and errors", async () => {
  const primary = RunnableLambda.from((input: string) => {
    if (input !== "primary-success") {
      throw new Error(`Primary failed for ${input}`);
    }
    return `Primary handled ${input}`;
  });
  const fallbackInputs: string[] = [];
  const fallback = RunnableLambda.from((input: string) => {
    fallbackInputs.push(input);
    if (input === "all-fail") {
      throw new Error(`Fallback failed for ${input}`);
    }
    return `Fallback handled ${input}`;
  });

  const results = await primary
    .withFallbacks([fallback])
    .batch(["primary-success", "fallback-success", "all-fail"], undefined, {
      returnExceptions: true,
    });

  expect(results[0]).toBe("Primary handled primary-success");
  expect(results[1]).toBe("Fallback handled fallback-success");
  expect(results[2]).toBeInstanceOf(Error);
  if (!(results[2] instanceof Error)) {
    throw new Error("Expected the failed input to return an error.");
  }
  expect(results[2].message).toBe("Primary failed for all-fail");
  expect(fallbackInputs).toEqual(["fallback-success", "all-fail"]);
});

test("RunnableWithFallbacks stream", async () => {
  const llm = new FakeStreamingLLM({
    thrownErrorString: "Bad error!",
  });
  await expect(async () => {
    await llm.stream("What up");
  }).rejects.toThrow();
  const llmWithFallbacks = llm.withFallbacks({
    fallbacks: [new FakeStreamingLLM({})],
  });
  const stream = await llmWithFallbacks.stream("What up");
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.join("")).toEqual("What up");
});

test("RunnableWithFallbacks stream events with local storage and callbacks added via env vars", async () => {
  process.env.LANGCHAIN_VERBOSE = "true";
  AsyncLocalStorageProviderSingleton.initializeGlobalInstance(
    new AsyncLocalStorage()
  );
  const llm = new FakeStreamingLLM({
    thrownErrorString: "Bad error!",
  });
  const llmWithFallbacks = llm.withFallbacks({
    fallbacks: [new FakeStreamingLLM({})],
  });
  const runnable = RunnableLambda.from(async (input: any) => {
    const res = await llmWithFallbacks.invoke(input);
    const stream = await llmWithFallbacks.stream(input);
    for await (const _ of stream) {
      // oxlint-disable-next-line no-void
      void _;
    }
    return res;
  });
  const stream = await runnable.streamEvents("hi", {
    version: "v2",
  });
  const chunks = [];
  for await (const chunk of stream) {
    if (chunk.event === "on_llm_stream") {
      chunks.push(chunk);
    }
  }
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.map((chunk) => chunk.data.chunk.text).join("")).toEqual("hihi");
});
