/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test } from "@jest/globals";
import { BaseMessageChunk, HumanMessage } from "../../../schema/index.js";
import { AnthropicFunctions } from "../anthropic_functions.js";
import { ChatBedrock } from "../../../chat_models/bedrock/web.js";

test("Test AnthropicFunctions", async () => {
  const chat = new AnthropicFunctions({ modelName: "claude-2", maxRetries: 0 });
  const message = new HumanMessage("Hello!");
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
});

test("Test AnthropicFunctions streaming", async () => {
  const chat = new AnthropicFunctions({ modelName: "claude-2", maxRetries: 0 });
  const message = new HumanMessage("Hello!");
  const stream = await chat.stream([message]);
  const chunks: BaseMessageChunk[] = [];
  for await (const chunk of stream) {
    console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});

test("Test AnthropicFunctions with functions", async () => {
  const chat = new AnthropicFunctions({
    modelName: "claude-2",
    temperature: 0.1,
    maxRetries: 0,
  }).bind({
    functions: [
      {
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
    ],
  });
  const message = new HumanMessage("What is the weather in San Francisco?");
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
});

test("Test AnthropicFunctions with a forced function call", async () => {
  const chat = new AnthropicFunctions({
    modelName: "claude-2",
    temperature: 0.1,
    maxRetries: 0,
  }).bind({
    functions: [
      {
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
    ],
    function_call: { name: "extract_data" },
  });
  const message = new HumanMessage(
    "Extract the desired information from the following passage:\n\nthis is really cool"
  );
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
});

test("Test AnthropicFunctions with a Bedrock model", async () => {
  const chatBedrock = new ChatBedrock({
    region: process.env.BEDROCK_AWS_REGION ?? "us-east-1",
    model: "anthropic.claude-v2",
    temperature: 0.1,
    maxRetries: 0,
    credentials: {
      secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
      accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
    },
  });
  const model = new AnthropicFunctions({
    llm: chatBedrock,
    maxRetries: 0,
  }).bind({
    functions: [
      {
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
    ],
    // You can set the `function_call` arg to force the model to use a function
    function_call: {
      name: "get_current_weather",
    },
  });

  const response = await model.invoke([
    new HumanMessage({
      content: "What's the weather in Boston?",
    }),
  ]);

  console.log(response);
});
