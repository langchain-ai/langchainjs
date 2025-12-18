import { test, expect, describe } from "vitest";
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import { zodToJsonSchema } from "../../utils/zod-to-json-schema/index.js";
import {
  FakeChatModel,
  FakeChatModelWithUsage,
  FakeListChatModel,
} from "../../utils/testing/index.js";
import { HumanMessage } from "../../messages/human.js";
import { getBufferString } from "../../messages/utils.js";
import { RunCollectorCallbackHandler } from "../../tracers/run_collector.js";
import { AIMessage } from "../../messages/ai.js";

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
  const llmKey = model._getSerializedCacheKeyParametersForCall({});

  // Invoke model to trigger cache update
  await model.invoke([humanMessage]);

  const value = await model.cache.lookup(prompt, llmKey);
  expect(value).toBeDefined();
  if (!value) return;

  expect(value[0].text).toEqual(JSON.stringify(contentToCache, null, 2));

  expect("message" in value[0]).toBeTruthy();
  if (!("message" in value[0])) return;
  const cachedMsg = value[0].message as AIMessage;
  expect(cachedMsg.content).toEqual(JSON.stringify(contentToCache, null, 2));
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

describe("handleLLMEnd extraParams with usage_metadata", () => {
  test("passes usage_metadata in extraParams during streaming via stream()", async () => {
    const model = new FakeChatModelWithUsage({
      responses: ["Hello!"],
      usageMetadata: {
        input_tokens: 5,
        output_tokens: 10,
        total_tokens: 15,
      },
    });

    const runCollector = new RunCollectorCallbackHandler();

    const stream = await model.stream("Hi", {
      callbacks: [runCollector],
    });

    // Consume the stream
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(runCollector.tracedRuns.length).toBe(1);

    const run = runCollector.tracedRuns[0];
    expect(run.extra?.metadata).toBeDefined();
    expect(run.extra?.metadata?.usage_metadata).toEqual({
      input_tokens: 5,
      output_tokens: 10,
      total_tokens: 15,
    });
  });

  test("passes usage_metadata in extraParams during invoke()", async () => {
    const model = new FakeChatModelWithUsage({
      responses: ["Hello!"],
      usageMetadata: {
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      },
    });

    const runCollector = new RunCollectorCallbackHandler();

    await model.invoke("Hi", {
      callbacks: [runCollector],
    });

    expect(runCollector.tracedRuns.length).toBe(1);

    const run = runCollector.tracedRuns[0];
    expect(run.extra?.metadata).toBeDefined();
    expect(run.extra?.metadata?.usage_metadata).toEqual({
      input_tokens: 100,
      output_tokens: 200,
      total_tokens: 300,
    });
  });

  test("passes usage_metadata in extraParams during streamEvents()", async () => {
    const model = new FakeChatModelWithUsage({
      responses: ["Hello!"],
      usageMetadata: {
        input_tokens: 7,
        output_tokens: 14,
        total_tokens: 21,
      },
    });

    const runCollector = new RunCollectorCallbackHandler();

    const eventStream = model.streamEvents("Hi", {
      version: "v2",
      callbacks: [runCollector],
    });

    // Consume the event stream
    const events = [];
    for await (const event of eventStream) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    expect(runCollector.tracedRuns.length).toBe(1);

    const run = runCollector.tracedRuns[0];
    expect(run.extra?.metadata).toBeDefined();
    expect(run.extra?.metadata?.usage_metadata).toEqual({
      input_tokens: 7,
      output_tokens: 14,
      total_tokens: 21,
    });
  });

  test("passes cache flag and usage_metadata for cached results", async () => {
    const model = new FakeChatModelWithUsage({
      responses: ["Hello!"],
      usageMetadata: {
        input_tokens: 50,
        output_tokens: 100,
        total_tokens: 150,
      },
      cache: true,
    });

    // First call - not cached
    const runCollector1 = new RunCollectorCallbackHandler();
    await model.invoke("Cache test message", {
      callbacks: [runCollector1],
    });

    expect(runCollector1.tracedRuns.length).toBe(1);
    const firstRun = runCollector1.tracedRuns[0];
    // First run should have usage_metadata but not cache flag
    expect(firstRun.extra?.metadata?.usage_metadata).toEqual({
      input_tokens: 50,
      output_tokens: 100,
      total_tokens: 150,
    });
    expect(firstRun.extra?.cached).toBeUndefined();

    // Second call - should be cached
    const runCollector2 = new RunCollectorCallbackHandler();
    await model.invoke("Cache test message", {
      callbacks: [runCollector2],
    });

    expect(runCollector2.tracedRuns.length).toBe(1);
    const secondRun = runCollector2.tracedRuns[0];
    // Second run should have cache flag set to true
    expect(secondRun.extra?.cached).toBe(true);
    // Cached results have usage_metadata with all zeros
    expect(secondRun.extra?.metadata?.usage_metadata).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    });
  });
});
