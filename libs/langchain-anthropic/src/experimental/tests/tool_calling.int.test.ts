/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { BaseMessageChunk, HumanMessage } from "@langchain/core/messages";
import { ChatAnthropicTools } from "../tool_calling.js";

test("Test ChatAnthropicTools", async () => {
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
});

test("Test ChatAnthropicTools streaming", async () => {
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  });
  const message = new HumanMessage("Hello!");
  const stream = await chat.stream([message]);
  const chunks: BaseMessageChunk[] = [];
  for await (const chunk of stream) {
    console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("Test ChatAnthropicTools with tools", async () => {
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    temperature: 0.1,
    maxRetries: 0,
  }).bind({
    tools: [
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
              unit: {
                type: "string",
                enum: ["celsius", "fahrenheit"],
              },
            },
            required: ["location"],
          },
        },
      },
    ],
  });
  const message = new HumanMessage("What is the weather in San Francisco?");
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls).toBeDefined();
  expect(res.additional_kwargs.tool_calls?.[0].function.name).toEqual(
    "get_current_weather"
  );
});

test("Test ChatAnthropicTools with a forced function call", async () => {
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    temperature: 0.1,
    maxRetries: 0,
  }).bind({
    tools: [
      {
        type: "function",
        function: {
          name: "extract_data",
          description: "Return information about the input",
          parameters: {
            type: "object",
            properties: {
              sentiment: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA",
              },
              aggressiveness: {
                type: "integer",
                description: "How aggressive the input is from 1 to 10",
              },
              language: {
                type: "string",
                description: "The language the input is in",
              },
            },
            required: ["sentiment", "aggressiveness"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "extract_data" } },
  });
  const message = new HumanMessage(
    "Extract the desired information from the following passage:\n\nthis is really cool"
  );
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls).toBeDefined();
  expect(res.additional_kwargs.tool_calls?.[0]?.function.name).toEqual(
    "extract_data"
  );
});

test("ChatAnthropicTools with Zod schema", async () => {
  const schema = z.object({
    people: z.array(
      z.object({
        name: z.string().describe("The name of a person"),
        height: z.number().describe("The person's height"),
        hairColor: z.optional(z.string()).describe("The person's hair color"),
      })
    ),
  });
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    temperature: 0.1,
    maxRetries: 0,
  }).bind({
    tools: [
      {
        type: "function",
        function: {
          name: "information_extraction",
          description: "Extracts the relevant information from the passage.",
          parameters: zodToJsonSchema(schema),
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: {
        name: "information_extraction",
      },
    },
  });
  const message = new HumanMessage(
    "Alex is 5 feet tall. Claudia is 1 foot taller than Alex and jumps higher than him. Claudia is a brunette and Alex is blonde."
  );
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls).toBeDefined();
  expect(res.additional_kwargs.tool_calls?.[0]?.function.name).toEqual(
    "information_extraction"
  );
  expect(
    JSON.parse(res.additional_kwargs.tool_calls?.[0]?.function.arguments ?? "")
  ).toEqual({
    people: expect.arrayContaining([
      { name: "Alex", height: 5, hairColor: "blonde" },
      { name: "Claudia", height: 6, hairColor: "brunette" },
    ]),
  });
});

test("ChatAnthropicTools with parallel tool calling", async () => {
  const schema = z.object({
    name: z.string().describe("The name of a person"),
    height: z.number().describe("The person's height"),
    hairColor: z.optional(z.string()).describe("The person's hair color"),
  });
  const chat = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    temperature: 0.1,
    maxRetries: 0,
  }).bind({
    tools: [
      {
        type: "function",
        function: {
          name: "person",
          description: "A person mentioned in the passage.",
          parameters: zodToJsonSchema(schema),
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: {
        name: "person",
      },
    },
  });
  console.log(zodToJsonSchema(schema));
  const message = new HumanMessage(
    "Alex is 5 feet tall. Claudia is 1 foot taller than Alex and jumps higher than him. Claudia is a brunette and Alex is blonde."
  );
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls).toBeDefined();
  expect(
    res.additional_kwargs.tool_calls?.map((toolCall) =>
      JSON.parse(toolCall.function.arguments ?? "")
    )
  ).toEqual(
    expect.arrayContaining([
      { name: "Alex", height: 5, hairColor: "blonde" },
      { name: "Claudia", height: 6, hairColor: "brunette" },
    ])
  );
});

test("Test ChatAnthropic withStructuredOutput", async () => {
  const runnable = new ChatAnthropicTools({
    modelName: "claude-3-sonnet-20240229",
    maxRetries: 0,
  }).withStructuredOutput({
    schema: z.object({
      name: z.string().describe("The name of a person"),
      height: z.number().describe("The person's height"),
      hairColor: z.optional(z.string()).describe("The person's hair color"),
    }),
    name: "person",
  });
  const message = new HumanMessage("Alex is 5 feet tall. Alex is blonde.");
  const res = await runnable.invoke([message]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toEqual({ name: "Alex", height: 5, hairColor: "blonde" });
});
