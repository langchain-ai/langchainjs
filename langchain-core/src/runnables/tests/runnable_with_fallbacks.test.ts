/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "@jest/globals";
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
  const llm = new FakeStreamingLLM({});
  const backupLlm = new FakeStreamingLLM({});
  const llmWithFallbacks = llm.withFallbacks({
    fallbacks: [backupLlm],
  });
  const expectedUptput = "Hi there!";
  const stream = await llmWithFallbacks.stream(expectedUptput);
  const chunks: string[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toEqual(expectedUptput.length);
  expect(chunks.join("")).toEqual(expectedUptput);
});

test("RunnableWithFallbacks stream with initial error", async () => {
  const llmWithError = new FakeStreamingLLM({ thrownErrorString: "testError" });
  const backupLlm = new FakeStreamingLLM({});
  const llmWithFallbacks = llmWithError.withFallbacks({
    fallbacks: [backupLlm],
  });
  const expectedUptput = "Hi there!";
  const stream = await llmWithFallbacks.stream(expectedUptput);
  const chunks: string[] = [];
  for await (const chunk of stream) {
    console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toEqual(expectedUptput.length);
  expect(chunks.join("")).toEqual(expectedUptput);
});
