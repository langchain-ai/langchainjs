import { test, expect, vi } from "vitest";
import { FakeLLM, FakeStreamingLLM } from "../../utils/testing/index.js";
import { HumanMessagePromptTemplate } from "../../prompts/chat.js";
import { RunCollectorCallbackHandler } from "../../tracers/run_collector.js";
import { LangChainTracer } from "../../tracers/tracer_langchain.js";
import { awaitAllCallbacks } from "../../callbacks/promises.js";
import type { LangSmithTracingClientInterface } from "langsmith";

test("Test FakeLLM uses callbacks", async () => {
  const model = new FakeLLM({});
  let acc = "";
  const response = await model.invoke("Hello there!", {
    callbacks: [
      {
        handleLLMNewToken: (token: string) => {
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

test("Test LLM passes invocationParams to tracer inheritable metadata", async () => {
  // Create a custom LLM that returns specific invocation params
  class LLMWithInvocationParams extends FakeLLM {
    invocationParams() {
      return {
        temperature: 0.5,
        max_tokens: 200,
        model: "test-llm-model",
      };
    }
  }

  const createRunMock = vi.fn().mockResolvedValue(undefined);
  const updateRunMock = vi.fn().mockResolvedValue(undefined);
  const mockClient = {
    createRun: createRunMock,
    updateRun: updateRunMock,
  } as LangSmithTracingClientInterface;
  const tracer = new LangChainTracer({ client: mockClient });

  const model = new LLMWithInvocationParams({});
  await model.invoke("Hello there!", { callbacks: [tracer] });
  await awaitAllCallbacks();

  expect(createRunMock).toHaveBeenCalled();
  const postedRun = createRunMock.mock.calls[0]?.[0];
  // Verify invocation params are passed to tracer metadata
  expect(postedRun.extra?.metadata?.temperature).toBe(0.5);
  expect(postedRun.extra?.metadata?.max_tokens).toBe(200);
  expect(postedRun.extra?.metadata?.model).toBe("test-llm-model");
});

test("Test LLM streaming does not include invocationParams in token events", async () => {
  // Create a custom streaming LLM that returns specific invocation params
  class StreamingLLMWithInvocationParams extends FakeStreamingLLM {
    invocationParams() {
      return {
        temperature: 0.9,
        max_tokens: 75,
        model: "streaming-llm-model",
      };
    }
  }

  const createRunMock = vi.fn().mockResolvedValue(undefined);
  const updateRunMock = vi.fn().mockResolvedValue(undefined);
  const mockClient = {
    createRun: createRunMock,
    updateRun: updateRunMock,
  } as LangSmithTracingClientInterface;
  const tracer = new LangChainTracer({ client: mockClient });

  const model = new StreamingLLMWithInvocationParams({
    responses: ["Hello streaming world!"],
  });

  // Use streamEvents to capture all events
  const eventStream = model.streamEvents("Hello there!", {
    version: "v2",
    callbacks: [tracer],
  });
  const events = [];
  for await (const event of eventStream) {
    events.push(event);
  }
  await awaitAllCallbacks();

  // Verify invocation params are passed to tracer metadata at run start
  // This is the key assertion - tracerInheritableMetadata goes to the tracer
  expect(createRunMock).toHaveBeenCalled();
  const postedRun = createRunMock.mock.calls[0]?.[0];
  expect(postedRun.extra?.metadata?.temperature).toBe(0.9);
  expect(postedRun.extra?.metadata?.max_tokens).toBe(75);
  expect(postedRun.extra?.metadata?.model).toBe("streaming-llm-model");

  // Verify that streamEvents metadata does NOT contain invocation params
  // This is because tracerInheritableMetadata is only passed to tracers,
  // not to the EventStreamCallbackHandler which generates streamEvents
  const startEvent = events.find((e) => e.event === "on_llm_start");
  expect(startEvent).toBeDefined();
  expect(startEvent?.metadata?.temperature).toBeUndefined();
  expect(startEvent?.metadata?.max_tokens).toBeUndefined();
  expect(startEvent?.metadata?.model).toBeUndefined();

  // Verify that stream events also don't have invocation params in metadata
  const streamEventsList = events.filter((e) => e.event === "on_llm_stream");
  expect(streamEventsList.length).toBeGreaterThan(0);
  for (const streamEvent of streamEventsList) {
    // Metadata should NOT contain invocation params (not passed to EventStreamCallbackHandler)
    expect(streamEvent.metadata?.temperature).toBeUndefined();
    expect(streamEvent.metadata?.max_tokens).toBeUndefined();
    expect(streamEvent.metadata?.model).toBeUndefined();
    // And the chunk data itself should also NOT contain invocation params
    const chunkStr = JSON.stringify(streamEvent.data?.chunk ?? {});
    expect(chunkStr).not.toContain('"temperature":0.9');
    expect(chunkStr).not.toContain('"max_tokens":75');
    expect(chunkStr).not.toContain('"model":"streaming-llm-model"');
  }
});
