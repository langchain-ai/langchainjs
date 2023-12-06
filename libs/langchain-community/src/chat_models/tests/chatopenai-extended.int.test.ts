import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "../openai.js";
import { HumanMessage, ToolMessage } from "../../schema/index.js";

test("Test ChatOpenAI JSON mode", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
  }).bind({
    response_format: {
      type: "json_object",
    },
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.invoke([["system", "Only return JSON"], message]);
  console.log(JSON.stringify(res));
});

test("Test ChatOpenAI seed", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
    temperature: 1,
  }).bind({
    seed: 123454930394983,
  });
  const message = new HumanMessage("Say something random!");
  const res = await chat.invoke([message]);
  console.log(JSON.stringify(res));
  const res2 = await chat.invoke([message]);
  expect(res).toEqual(res2);
});

test("Test ChatOpenAI tool calling", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
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
              unit: { type: "string", enum: ["celsius", "fahrenheit"] },
            },
            required: ["location"],
          },
        },
      },
    ],
    tool_choice: "auto",
  });
  const res = await chat.invoke([
    ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
  ]);
  console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls?.length).toBeGreaterThan(1);
});

test("Test ChatOpenAI tool calling with ToolMessages", async () => {
  function getCurrentWeather(location: string) {
    if (location.toLowerCase().includes("tokyo")) {
      return JSON.stringify({ location, temperature: "10", unit: "celsius" });
    } else if (location.toLowerCase().includes("san francisco")) {
      return JSON.stringify({
        location,
        temperature: "72",
        unit: "fahrenheit",
      });
    } else {
      return JSON.stringify({ location, temperature: "22", unit: "celsius" });
    }
  }
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
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
              unit: { type: "string", enum: ["celsius", "fahrenheit"] },
            },
            required: ["location"],
          },
        },
      },
    ],
    tool_choice: "auto",
  });
  const res = await chat.invoke([
    ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
  ]);
  console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls?.length).toBeGreaterThan(1);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const toolMessages = res.additional_kwargs.tool_calls!.map(
    (toolCall) =>
      new ToolMessage({
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: getCurrentWeather(
          JSON.parse(toolCall.function.arguments).location
        ),
      })
  );
  const finalResponse = await chat.invoke([
    ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
    res,
    ...toolMessages,
  ]);
  console.log(finalResponse);
});

test("Test ChatOpenAI tool calling with streaming", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 256,
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
              unit: { type: "string", enum: ["celsius", "fahrenheit"] },
            },
            required: ["location"],
          },
        },
      },
    ],
    tool_choice: "auto",
  });
  const stream = await chat.stream([
    ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
  ]);
  let finalChunk;
  const chunks = [];
  for await (const chunk of stream) {
    console.log(chunk.additional_kwargs.tool_calls);
    chunks.push(chunk);
    if (!finalChunk) {
      finalChunk = chunk;
    } else {
      finalChunk = finalChunk.concat(chunk);
    }
  }
  expect(chunks.length).toBeGreaterThan(1);
  console.log(finalChunk?.additional_kwargs.tool_calls);
  expect(finalChunk?.additional_kwargs.tool_calls?.length).toBeGreaterThan(1);
});
