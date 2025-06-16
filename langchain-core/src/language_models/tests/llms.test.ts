/* eslint-disable no-promise-executor-return */

import { test, expect } from "@jest/globals";
import { FakeLLM, FakeStreamingLLM } from "../../utils/testing/index.js";
import { HumanMessagePromptTemplate } from "../../prompts/chat.js";
import { RunCollectorCallbackHandler } from "../../tracers/run_collector.js";

test("Test FakeLLM uses callbacks", async () => {
  const model = new FakeLLM({});
  let acc = "";
  const response = await model.invoke("Hello there!", {
    callbacks: [
      {
        handleLLMNewToken: (token: string) => {
          console.log(token);
          acc += token;
        },
      },
    ],
  });
  expect(response).toEqual(acc);
});

test("Test FakeLLM uses callbacks with a cache", async () => {
  const model = new FakeLLM({
    cache: true,
  });
  let acc = "";
  const response = await model.invoke("Hello there!");
  const response2 = await model.invoke("Hello there!", {
    callbacks: [
      {
        handleLLMNewToken: (token: string) => {
          console.log(token);
          acc += token;
        },
      },
    ],
  });
  // If callbacks are backgrounded
  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(response).toEqual(response2);
  expect(response2).toEqual(acc);
});

test("Test LLM with cache does not start multiple LLM runs", async () => {
  const model = new FakeLLM({
    cache: true,
  });
  if (!model.cache) {
    throw new Error("Cache not enabled");
  }

  const runCollector = new RunCollectorCallbackHandler();

  // Invoke model to trigger cache update
  const eventStream = model.streamEvents("Hello there!", {
    version: "v2",
    callbacks: [runCollector],
  });

  const events = [];
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events.length).toEqual(2);
  expect(events[0].event).toEqual("on_llm_start");
  expect(events[1].event).toEqual("on_llm_end");
  expect(runCollector.tracedRuns[0].extra?.cached).not.toBe(true);

  const eventStream2 = model.streamEvents("Hello there!", {
    version: "v2",
    callbacks: [runCollector],
  });

  const events2 = [];
  for await (const event of eventStream2) {
    events2.push(event);
  }
  expect(events2.length).toEqual(2);
  expect(events2[0].event).toEqual("on_llm_start");
  expect(events2[1].event).toEqual("on_llm_end");
  expect(runCollector.tracedRuns[1].extra?.cached).toBe(true);
});

test("Test FakeStreamingLLM works when streaming through a prompt", async () => {
  const prompt = HumanMessagePromptTemplate.fromTemplate("hello there {name}");
  const model = new FakeStreamingLLM({});
  const chain = prompt.pipe(model);
  const stream = await chain.stream({ name: "test" });
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.join("")).toEqual("Human: hello there test");
});
