import { test } from "@jest/globals";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { concat } from "@langchain/core/utils/stream";
import { ChatCerebras } from "../chat_models.js";

test("invoke", async () => {
  const chat = new ChatCerebras({
    model: "llama3.1-8b",
    maxRetries: 2,
  });
  const message = new HumanMessage("What color is the sky?");
  const res = await chat.invoke([message]);
  // console.log({ res });
  expect(res.content.length).toBeGreaterThan(10);
});

test("invoke with stop sequence", async () => {
  const chat = new ChatCerebras({
    model: "llama3.1-8b",
    maxRetries: 2,
  });
  const message = new HumanMessage("Count to ten.");
  const res = await chat.withConfig({ stop: ["5", "five"] }).invoke([message]);
  // console.log({ res });
  expect((res.content as string).toLowerCase()).not.toContain("6");
  expect((res.content as string).toLowerCase()).not.toContain("six");
});

test("invoke with streaming: true", async () => {
  const chat = new ChatCerebras({
    model: "llama3.1-8b",
    maxRetries: 2,
    streaming: true,
  });
  const message = new HumanMessage("What color is the sky?");
  const res = await chat.invoke([message]);
  console.log({ res });
  expect(res.content.length).toBeGreaterThan(10);
});

test("invoke should respect passed headers", async () => {
  const chat = new ChatCerebras({
    model: "llama3.1-8b",
    maxRetries: 2,
  });
  const message = new HumanMessage("Count to ten.");
  await expect(async () => {
    await chat.invoke([message], {
      headers: { Authorization: "badbadbad" },
    });
  }).rejects.toThrowError();
});

test("stream should respect passed headers", async () => {
  const chat = new ChatCerebras({
    model: "llama3.1-8b",
    maxRetries: 2,
  });
  const message = new HumanMessage("Count to ten.");
  await expect(async () => {
    await chat.stream([message], {
      headers: { Authorization: "badbadbad" },
    });
  }).rejects.toThrowError();
});

test("generate", async () => {
  const chat = new ChatCerebras({
    model: "llama3.1-8b",
    maxRetries: 2,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.generate([[message]]);
  // console.log(JSON.stringify(res, null, 2));
  expect(res.generations[0][0].text.length).toBeGreaterThan(10);
});

test("streaming", async () => {
  const chat = new ChatCerebras({
    model: "llama3.1-8b",
    maxRetries: 2,
  });
  const message = new HumanMessage("What color is the sky?");
  const stream = await chat.stream([message]);
  let iters = 0;
  let finalRes = "";
  for await (const chunk of stream) {
    iters += 1;
    finalRes += chunk.content;
  }
  // console.log({ finalRes, iters });
  expect(iters).toBeGreaterThan(1);
});

test("invoke with bound tools", async () => {
  const chat = new ChatCerebras({
    model: "llama3.1-8b",
    maxRetries: 2,
  });
  const message = new HumanMessage("What is the current weather in Hawaii?");
  const res = await chat
    .bindTools(
      [
        {
          type: "function",
          function: {
            name: "get_current_weather",
            description: "Get the current weather in a given location",
            parameters: {
              type: "object",
              properties: {
                location: {
                  type: "string",
                  description: "The city and state, e.g. San Francisco, CA",
                },
                unit: { type: "string", enum: ["celsius", "fahrenheit"] },
              },
              required: ["location"],
            },
          },
        },
      ],
      {
        tool_choice: "auto",
      }
    )
    .invoke([message]);
  expect(typeof res.tool_calls?.[0].args).toEqual("object");
});

test("stream with bound tools, yielding a single chunk", async () => {
  const chat = new ChatCerebras({
    model: "llama3.1-8b",
    maxRetries: 2,
  });
  const message = new HumanMessage("What is the current weather in Hawaii?");
  const stream = await chat
    .bindTools(
      [
        {
          type: "function",
          function: {
            name: "get_current_weather",
            description: "Get the current weather in a given location",
            parameters: {
              type: "object",
              properties: {
                location: {
                  type: "string",
                  description: "The city and state, e.g. San Francisco, CA",
                },
                unit: { type: "string", enum: ["celsius", "fahrenheit"] },
              },
              required: ["location"],
            },
          },
        },
      ],
      {
        tool_choice: "auto",
      }
    )
    .stream([message]);
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  for await (const chunk of stream) {
    // console.log(JSON.stringify(chunk));
  }
});

test("Few shotting with tool calls", async () => {
  const chat = new ChatCerebras({
    model: "llama3.1-8b",
    temperature: 0,
  }).bindTools(
    [
      {
        type: "function",
        function: {
          name: "get_current_weather",
          description: "Get the current weather in a given location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA",
              },
              unit: { type: "string", enum: ["celsius", "fahrenheit"] },
            },
            required: ["location"],
          },
        },
      },
    ],
    {
      tool_choice: "auto",
    }
  );
  const res = await chat.invoke([
    new HumanMessage("What is the weather in SF?"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "12345",
          name: "get_current_weather",
          args: {
            location: "SF",
          },
        },
      ],
    }),
    new ToolMessage({
      tool_call_id: "12345",
      content: "It is currently 24 degrees with hail in SF.",
    }),
    new AIMessage("It is currently 24 degrees in SF with hail in SF."),
    new HumanMessage("What did you say the weather was?"),
  ]);
  // console.log(res);
  expect(res.content).toContain("24");
});

test("Cerebras can stream tool calls", async () => {
  const model = new ChatCerebras({
    model: "llama3.1-8b",
    temperature: 0,
  });

  const weatherTool = tool((_) => "The temperature is 24 degrees with hail.", {
    name: "get_current_weather",
    schema: z.object({
      location: z
        .string()
        .describe("The location to get the current weather for."),
    }),
    description: "Get the current weather in a given location.",
  });

  const modelWithTools = model.bindTools([weatherTool]);

  const stream = await modelWithTools.stream(
    "What is the weather in San Francisco?"
  );

  let finalMessage: AIMessageChunk | undefined;
  for await (const chunk of stream) {
    finalMessage = !finalMessage ? chunk : concat(finalMessage, chunk);
  }

  expect(finalMessage).toBeDefined();
  if (!finalMessage) return;

  expect(finalMessage.tool_calls?.[0]).toBeDefined();
  if (!finalMessage.tool_calls?.[0]) return;

  expect(finalMessage.tool_calls?.[0].name).toBe("get_current_weather");
  expect(finalMessage.tool_calls?.[0].args).toHaveProperty("location");
  expect(finalMessage.tool_calls?.[0].id).toBeDefined();
});

test("json mode", async () => {
  const llm = new ChatCerebras({
    model: "llama3.1-8b",
    temperature: 0,
  });

  const messages = [
    {
      role: "system",
      content:
        "You are a math tutor that handles math exercises and makes output in json in format { result: number }.",
    },
    { role: "user", content: "2 + 2" },
  ];

  const res = await llm.invoke(messages, {
    response_format: { type: "json_object" },
  });

  expect(JSON.parse(res.content as string)).toEqual({ result: 4 });
});
