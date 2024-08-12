/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from "@jest/globals";
import { FakeLLM, FakeStreamingLLM } from "../../utils/testing/index.js";

test("RunnableWithFallbacks", async () => {
  const llm = new FakeLLM({
    thrownErrorString: "Bad error!",
  });
  await expect(async () => {
    const result1 = await llm.invoke("What up");
    console.log(result1);
  }).rejects.toThrow();
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
  await expect(async () => {
    const result1 = await llm.batch(["What up"]);
    console.log(result1);
  }).rejects.toThrow();
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
