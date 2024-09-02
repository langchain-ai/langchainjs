/* eslint-disable no-promise-executor-return */

import { test, expect } from "@jest/globals";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { FakeChatModel, FakeListChatModel } from "../../utils/testing/index.js";
import { HumanMessage } from "../../messages/human.js";
import { getBufferString } from "../../messages/utils.js";
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
          console.log(token);
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
          console.log(token);
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
  // @ts-expect-error not in run output type
  console.log(response.notthere);
  console.log(response.nested.somethingelse);
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
  // @ts-expect-error run output type forced to something else
  console.log(response.nested.somethingelse);
  // No error here
  console.log(response.forcedArg);
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
  // @ts-expect-error run output type forced to something else
  console.log(response.nested.somethingelse);
  // No error here
  console.log(response.forcedArg);
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
  // No error here
  console.log(response.nested.somethingelse);
  // Also no error here
  console.log(response.forcedArg);
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
  // @ts-expect-error run output includes raw
  console.log(response.nested.somethingelse);
  // No error
  console.log(response.parsed);
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
