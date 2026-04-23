import { test, expect, vi } from "vitest";
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import { zodToJsonSchema } from "../../utils/zod-to-json-schema/index.js";
import { FakeChatModel, FakeListChatModel } from "../../utils/testing/index.js";
import { HumanMessage } from "../../messages/human.js";
import { getBufferString } from "../../messages/utils.js";
import { AIMessage } from "../../messages/ai.js";
import { RunCollectorCallbackHandler } from "../../tracers/run_collector.js";
import { BaseCallbackHandler } from "../../callbacks/base.js";
import { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";
import { LangChainTracer } from "../../tracers/tracer_langchain.js";
import { awaitAllCallbacks } from "../../callbacks/promises.js";
import type { LangSmithTracingClientInterface } from "langsmith";

class StreamingPrefCallbackHandler extends BaseCallbackHandler {
  name = "streaming_pref_callback_handler";

  lc_prefer_streaming = true;
}

test("Test ChatModel accepts array shorthand for messages", async () => {
  const model = new FakeChatModel({});
  const response = await model.invoke([["human", "Hello there!"]]);
  expect(response.content).toEqual("Hello there!");
});

test("Test ChatModel accepts object shorthand for messages", async () => {
  const model = new FakeChatModel({});
  const response = await model.invoke([
    {
      type: "human",
      content: "Hello there!",
      additional_kwargs: {},
      example: true,
    },
  ]);
  expect(response.content).toEqual("Hello there!");
});

test("Test ChatModel accepts object with role for messages", async () => {
  const model = new FakeChatModel({});
  const response = await model.invoke([
    {
      role: "human",
      content: "Hello there!!",
      example: true,
    },
  ]);
  expect(response.content).toEqual("Hello there!!");
});

test("Test ChatModel accepts several messages as objects with role", async () => {
  const model = new FakeChatModel({});
  const response = await model.invoke([
    {
      role: "system",
      content: "You are an assistant.",
    },
    {
      role: "human",
      content: [{ type: "text", text: "What is the weather in SF?" }],
      example: true,
    },
    {
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "call_123",
          function: {
            name: "get_weather",
            arguments: JSON.stringify({ location: "sf" }),
          },
          type: "function",
        },
      ],
    },
    {
      role: "tool",
      content: "Pretty nice right now!",
      tool_call_id: "call_123",
    },
  ]);
  expect(response.content).toEqual(
    [
      "You are an assistant.",
      JSON.stringify(
        [{ type: "text", text: "What is the weather in SF?" }],
        null,
        2
      ),
      "",
      "Pretty nice right now!",
    ].join("\n")
  );
});

test("Test ChatModel uses callbacks", async () => {
  const model = new FakeChatModel({});
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
  expect(response.content).toEqual(acc);
});

test("Test ChatModel uses callbacks with a cache", async () => {
  const model = new FakeChatModel({
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
  expect(response.content).toEqual(response2.content);
  expect(response2.content).toEqual(acc);
});

test("Test ChatModel invoke preserves generationInfo in response_metadata when callback prefers streaming", async () => {
  const model = new FakeListChatModel({
    responses: ["abc"],
    generationInfo: {
      finish_reason: "stop",
      usage_metadata: {
        input_tokens: 1,
        output_tokens: 3,
        total_tokens: 4,
      },
    },
  });

  const response = await model.invoke("Hello there!", {
    callbacks: [new StreamingPrefCallbackHandler()],
  });

  expect(response.response_metadata.finish_reason).toBe("stop");
  expect(response.response_metadata.usage_metadata).toEqual({
    input_tokens: 1,
    output_tokens: 3,
    total_tokens: 4,
  });
});

test("Test ChatModel legacy params withStructuredOutput", async () => {
  const model = new FakeListChatModel({
    responses: [`{ "test": true, "nested": { "somethingelse": "somevalue" } }`],
  }).withStructuredOutput({
    includeRaw: false,
    schema: z.object({
      test: z.boolean(),
      nested: z.object({
        somethingelse: z.string(),
      }),
    }),
  });
  const response = await model.invoke("Hello there!");
  expect(response).toEqual({
    test: true,
    nested: { somethingelse: "somevalue" },
  });
});

// test("Test ChatModel legacy params includeRaw withStructuredOutput", async () => {
//   const model = new FakeListChatModel({
//     responses: [`{ "test": true, "nested": { "somethingelse": "somevalue" } }`],
//   }).withStructuredOutput({
//     includeRaw: true,
//     schema: z.object({
//       test: z.boolean(),
//       nested: z.object({
//         somethingelse: z.string(),
//       }),
//     }),
//   });
//   const response = await model.invoke("Hello there!");
//   // @ts-expect-error legacy
//   console.log(response.nested);
//   console.log(response.parsed.nested);
// });

test("Test ChatModel withStructuredOutput with supplied type arg", async () => {
  const model = new FakeListChatModel({
    responses: [`{ "test": true, "nested": { "somethingelse": "somevalue" } }`],
  }).withStructuredOutput<{ forcedArg: number }>({
    includeRaw: false,
    schema: z.object({
      test: z.boolean(),
      nested: z.object({
        somethingelse: z.string(),
      }),
    }),
  });
  const response = await model.invoke("Hello there!");
  expect(response).toEqual({
    test: true,
    nested: { somethingelse: "somevalue" },
  });
});

test("Test ChatModel withStructuredOutput new syntax", async () => {
  const model = new FakeListChatModel({
    responses: [`{ "test": true, "nested": { "somethingelse": "somevalue" } }`],
  }).withStructuredOutput<{ forcedArg: number }>(
    z.object({
      test: z.boolean(),
      nested: z.object({
        somethingelse: z.string(),
      }),
    })
  );
  const response = await model.invoke("Hello there!");
  expect(response).toEqual({
    test: true,
    nested: { somethingelse: "somevalue" },
  });
});

test("Test ChatModel withStructuredOutput new syntax and JSON schema", async () => {
  const model = new FakeListChatModel({
    responses: [`{ "test": true, "nested": { "somethingelse": "somevalue" } }`],
  }).withStructuredOutput(
    zodToJsonSchema(
      z.object({
        test: z.boolean(),
        nested: z.object({
          somethingelse: z.string(),
        }),
      })
    )
  );
  const response = await model.invoke("Hello there!");
  expect(response).toEqual({
    test: true,
    nested: { somethingelse: "somevalue" },
  });
});

test("Test ChatModel withStructuredOutput new syntax and includeRaw", async () => {
  const model = new FakeListChatModel({
    responses: [`{ "test": true, "nested": { "somethingelse": "somevalue" } }`],
  }).withStructuredOutput(
    z.object({
      test: z.boolean(),
      nested: z.object({
        somethingelse: z.string(),
      }),
    }),
    { includeRaw: true }
  );
  const response = await model.invoke("Hello there!");
  expect(response).toBeDefined();
});

test("Test ChatModel withStructuredOutput new syntax using zod v4", async () => {
  const model = new FakeListChatModel({
    responses: [`{ "test": true, "nested": { "somethingelse": "somevalue" } }`],
  }).withStructuredOutput(
    z4.object({
      test: z4.boolean(),
      nested: z4.object({
        somethingelse: z4.string(),
      }),
    })
  );
  const response = await model.invoke("Hello there!");
  expect(response).toEqual({
    test: true,
    nested: { somethingelse: "somevalue" },
  });
});

test("Test ChatModel can cache complex messages", async () => {
  const model = new FakeChatModel({
    cache: true,
  });
  if (!model.cache) {
    throw new Error("Cache not enabled");
  }

  const contentToCache = [
    {
      type: "text",
      text: "Hello there!",
    },
  ];
  const humanMessage = new HumanMessage({
    content: contentToCache,
  });

  const prompt = getBufferString([humanMessage]);
  // getBufferString now uses the `text` property which extracts only text content
  // from content blocks, producing compact output to avoid token inflation
  expect(prompt).toBe("Human: Hello there!");

  const llmKey = model._getSerializedCacheKeyParametersForCall({});

  // Invoke model to trigger cache update
  await model.invoke([humanMessage]);

  const value = await model.cache.lookup(prompt, llmKey);
  expect(value).toBeDefined();
  if (!value) return;

  // FakeChatModel returns m.text for text content (extracts text from blocks)
  // This is consistent with using the text property for compact representation
  expect(value[0].text).toEqual("Hello there!");

  expect("message" in value[0]).toBeTruthy();
  if (!("message" in value[0])) return;
  const cachedMsg = value[0].message as AIMessage;
  expect(cachedMsg.content).toEqual("Hello there!");
});

test("Test ChatModel with cache does not start multiple chat model runs", async () => {
  const model = new FakeChatModel({
    cache: true,
  });
  if (!model.cache) {
    throw new Error("Cache not enabled");
  }

  const contentToCache = [
    {
      type: "text",
      text: "Hello there again!",
    },
  ];
  const humanMessage = new HumanMessage({
    content: contentToCache,
  });

  const prompt = getBufferString([humanMessage]);
  const llmKey = model._getSerializedCacheKeyParametersForCall({});

  const value = await model.cache.lookup(prompt, llmKey);
  expect(value).toBeNull();

  const runCollector = new RunCollectorCallbackHandler();

  // Invoke model to trigger cache update
  const eventStream = model.streamEvents([humanMessage], {
    version: "v2",
    callbacks: [runCollector],
  });

  expect(await model.cache.lookup(prompt, llmKey)).toBeDefined();

  const events = [];
  for await (const event of eventStream) {
    events.push(event);
  }
  expect(events.length).toEqual(2);
  expect(events[0].event).toEqual("on_chat_model_start");
  expect(events[1].event).toEqual("on_chat_model_end");
  expect(runCollector.tracedRuns[0].extra?.cached).not.toBe(true);

  const eventStream2 = model.streamEvents([humanMessage], {
    version: "v2",
    callbacks: [runCollector],
  });

  const events2 = [];
  for await (const event of eventStream2) {
    events2.push(event);
  }
  expect(events2.length).toEqual(2);
  expect(events2[0].event).toEqual("on_chat_model_start");
  expect(events2[1].event).toEqual("on_chat_model_end");
  expect(runCollector.tracedRuns[1].extra?.cached).toBe(true);
});

test("Test ChatModel can emit a custom event", async () => {
  const model = new FakeListChatModel({
    responses: ["hi"],
    emitCustomEvent: true,
  });
  let customEvent;
  const response = await model.invoke([["human", "Hello there!"]], {
    callbacks: [
      {
        handleCustomEvent(_, data) {
          customEvent = data;
        },
      },
    ],
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(response.content).toEqual("hi");
  expect(customEvent).toBeDefined();
});

test("Test ChatModel can stream back a custom event", async () => {
  const model = new FakeListChatModel({
    responses: ["hi"],
    emitCustomEvent: true,
  });
  let customEvent;
  const eventStream = await model.streamEvents([["human", "Hello there!"]], {
    version: "v2",
  });
  for await (const event of eventStream) {
    if (event.event === "on_custom_event") {
      customEvent = event;
    }
  }
  expect(customEvent).toBeDefined();
});

test(`Test ChatModel should not serialize a passed "cache" parameter`, async () => {
  const model = new FakeListChatModel({
    responses: ["hi"],
    emitCustomEvent: true,
    cache: true,
  });
  expect(JSON.stringify(model)).toEqual(
    `{"lc":1,"type":"constructor","id":["langchain","chat_models","fake-list","FakeListChatModel"],"kwargs":{"responses":["hi"],"emit_custom_event":true}}`
  );
});

test("Test ChatModel withStructuredOutput with Standard Schema", async () => {
  const mockStandardSchema: StandardSchemaV1 & StandardJSONSchemaV1 = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value: unknown) => ({
        value: value as Record<string, unknown>,
      }),
      jsonSchema: {
        input: () => ({
          type: "object",
          properties: {
            test: { type: "boolean" },
            nested: {
              type: "object",
              properties: {
                somethingelse: { type: "string" },
              },
            },
          },
          required: ["test", "nested"],
        }),
        output: () => ({
          type: "object",
          properties: {
            test: { type: "boolean" },
            nested: {
              type: "object",
              properties: {
                somethingelse: { type: "string" },
              },
            },
          },
          required: ["test", "nested"],
        }),
      },
    },
  };

  const model = new FakeListChatModel({
    responses: [`{ "test": true, "nested": { "somethingelse": "somevalue" } }`],
  }).withStructuredOutput(mockStandardSchema);

  const response = await model.invoke("Hello there!");
  expect(response).toEqual({
    test: true,
    nested: { somethingelse: "somevalue" },
  });
});

test("Test ChatModel passes invocationParams to tracer inheritable metadata", async () => {
  // Create a custom chat model that returns specific invocation params
  class ChatModelWithInvocationParams extends FakeChatModel {
    invocationParams() {
      return {
        temperature: 0.7,
        max_tokens: 100,
        model: "test-model",
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

  const model = new ChatModelWithInvocationParams({});
  await model.invoke("Hello there!", { callbacks: [tracer] });
  await awaitAllCallbacks();

  expect(createRunMock).toHaveBeenCalled();
  const postedRun = createRunMock.mock.calls[0]?.[0];
  // Verify invocation params are passed to tracer metadata
  expect(postedRun.extra?.metadata?.temperature).toBe(0.7);
  expect(postedRun.extra?.metadata?.max_tokens).toBe(100);
  expect(postedRun.extra?.metadata?.model).toBe("test-model");
});

test("Test ChatModel streaming does not include invocationParams in token events", async () => {
  // Create a custom streaming chat model that returns specific invocation params
  class StreamingChatModelWithInvocationParams extends FakeListChatModel {
    invocationParams() {
      return {
        temperature: 0.8,
        max_tokens: 50,
        model: "streaming-test-model",
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

  const model = new StreamingChatModelWithInvocationParams({
    responses: ["Hello world!"],
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
  expect(postedRun.extra?.metadata?.temperature).toBe(0.8);
  expect(postedRun.extra?.metadata?.max_tokens).toBe(50);
  expect(postedRun.extra?.metadata?.model).toBe("streaming-test-model");

  // Verify that streamEvents metadata does NOT contain invocation params
  // This is because tracerInheritableMetadata is only passed to tracers,
  // not to the EventStreamCallbackHandler which generates streamEvents
  const startEvent = events.find((e) => e.event === "on_chat_model_start");
  expect(startEvent).toBeDefined();
  expect(startEvent?.metadata?.temperature).toBeUndefined();
  expect(startEvent?.metadata?.max_tokens).toBeUndefined();
  expect(startEvent?.metadata?.model).toBeUndefined();

  // Verify that stream events also don't have invocation params in metadata
  const streamEventsList = events.filter(
    (e) => e.event === "on_chat_model_stream"
  );
  expect(streamEventsList.length).toBeGreaterThan(0);
  for (const streamEvent of streamEventsList) {
    // Metadata should NOT contain invocation params (not passed to EventStreamCallbackHandler)
    expect(streamEvent.metadata?.temperature).toBeUndefined();
    expect(streamEvent.metadata?.max_tokens).toBeUndefined();
    expect(streamEvent.metadata?.model).toBeUndefined();
    // And the chunk data itself should also NOT contain invocation params
    const chunkStr = JSON.stringify(streamEvent.data?.chunk ?? {});
    expect(chunkStr).not.toContain('"temperature":0.8');
    expect(chunkStr).not.toContain('"max_tokens":50');
    expect(chunkStr).not.toContain('"model":"streaming-test-model"');
  }
});
