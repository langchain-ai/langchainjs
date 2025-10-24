import { test, expect, jest } from "@jest/globals";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { InMemoryCache } from "@langchain/core/caches";
import { AzureChatOpenAI } from "../chat_models.js";

test("Test ChatOpenAI JSON mode", async () => {
  const chat = new AzureChatOpenAI({
    model: "gpt-3.5-turbo-1106",
    maxTokens: 128,
  }).withConfig({
    response_format: {
      type: "json_object",
    },
  });
  const message = new HumanMessage("Hello!");
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.invoke([["system", "Only return JSON"], message]);
  // console.log(JSON.stringify(res));
});

test("Test ChatOpenAI seed", async () => {
  const chat = new AzureChatOpenAI({
    model: "gpt-3.5-turbo-1106",
    maxTokens: 128,
    temperature: 1,
  }).withConfig({
    seed: 123454930394983,
  });
  const message = new HumanMessage("Say something random!");
  const res = await chat.invoke([message]);
  // console.log(JSON.stringify(res));
  const res2 = await chat.invoke([message]);
  expect(res).toEqual(res2);
});

test("Test ChatOpenAI tool calling", async () => {
  const chat = new AzureChatOpenAI({
    model: "gpt-3.5-turbo-1106",
    maxTokens: 128,
  }).withConfig({
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
  // console.log(JSON.stringify(res));
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
  const chat = new AzureChatOpenAI({
    model: "gpt-3.5-turbo-1106",
    maxTokens: 128,
  }).withConfig({
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
  // console.log(JSON.stringify(res));
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
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const finalResponse = await chat.invoke([
    ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
    res,
    ...toolMessages,
  ]);
  // console.log(finalResponse);
});

test("Test ChatOpenAI tool calling with streaming", async () => {
  const chat = new AzureChatOpenAI({
    model: "gpt-3.5-turbo-1106",
    maxTokens: 256,
  }).withConfig({
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
    // console.log(chunk.additional_kwargs.tool_calls);
    chunks.push(chunk);
    if (!finalChunk) {
      finalChunk = chunk;
    } else {
      finalChunk = finalChunk.concat(chunk);
    }
  }
  expect(chunks.length).toBeGreaterThan(1);
  // console.log(finalChunk?.additional_kwargs.tool_calls);
  expect(finalChunk?.additional_kwargs.tool_calls?.length).toBeGreaterThan(1);
});

test("ChatOpenAI in JSON mode can cache generations", async () => {
  const memoryCache = new InMemoryCache();
  const lookupSpy = jest.spyOn(memoryCache, "lookup");
  const updateSpy = jest.spyOn(memoryCache, "update");
  const chat = new AzureChatOpenAI({
    model: "gpt-3.5-turbo-1106",
    temperature: 1,
    cache: memoryCache,
  }).withConfig({
    response_format: {
      type: "json_object",
    },
  });
  const message = new HumanMessage(
    "Respond with a JSON object containing arbitrary fields."
  );
  const res = await chat.invoke([message]);
  // console.log(res);

  const res2 = await chat.invoke([message]);
  // console.log(res2);

  expect(res).toEqual(res2);

  expect(lookupSpy).toHaveBeenCalledTimes(2);
  expect(updateSpy).toHaveBeenCalledTimes(1);

  lookupSpy.mockRestore();
  updateSpy.mockRestore();
});
