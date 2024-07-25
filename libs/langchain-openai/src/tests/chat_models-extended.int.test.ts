import { test, expect, jest } from "@jest/globals";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { InMemoryCache } from "@langchain/core/caches";
import { ChatOpenAI } from "../chat_models.js";

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
  // console.log(JSON.stringify(res));
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

  const res2 = await chat.invoke([message]);

  expect(res.response_metadata.system_fingerprint).toBeDefined();
  expect(res2.response_metadata.system_fingerprint).toBeDefined();

  // These are unfortunately not consistently the same
  delete res.response_metadata.system_fingerprint;
  delete res2.response_metadata.system_fingerprint;

  const resAsObject = {
    ...res,
    id: undefined,
    lc_kwargs: { ...res.lc_kwargs, id: undefined },
  };
  const res2AsObject = {
    ...res2,
    id: undefined,
    lc_kwargs: { ...res2.lc_kwargs, id: undefined },
  };
  expect(resAsObject).toEqual(res2AsObject);
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
  // console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls?.length).toEqual(3);
  expect(res.tool_calls?.[0].args).toEqual(
    JSON.parse(res.additional_kwargs.tool_calls?.[0].function.arguments ?? "{}")
  );
  expect(res.tool_calls?.[1].args).toEqual(
    JSON.parse(res.additional_kwargs.tool_calls?.[1].function.arguments ?? "{}")
  );
  expect(res.tool_calls?.[2].args).toEqual(
    JSON.parse(res.additional_kwargs.tool_calls?.[2].function.arguments ?? "{}")
  );
});

test("Test ChatOpenAI streaming logprobs", async () => {
  const model = new ChatOpenAI({
    maxTokens: 50,
    modelName: "gpt-3.5-turbo",
    streaming: true,
    logprobs: true,
  });
  const res = await model.invoke("Print hello world.");
  // console.log(res.response_metadata.logprobs.content);
  expect(res.response_metadata.logprobs.content.length).toBeGreaterThan(0);
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
  const finalResponse = await chat.invoke([
    ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
    res,
    ...toolMessages,
  ]);
  // console.log(finalResponse);
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
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 1,
    cache: memoryCache,
  }).bind({
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

test("Few shotting with tool calls", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 1,
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

test("Test ChatOpenAI with raw response", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
    __includeRawResponse: true,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.invoke([message]);
  expect(res.additional_kwargs.__raw_response).toBeDefined();
});

test("Test ChatOpenAI with raw response", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
    __includeRawResponse: true,
  });
  const message = new HumanMessage("Hello!");
  const stream = await chat.stream([message]);
  for await (const chunk of stream) {
    expect(
      chunk.additional_kwargs.__raw_response || chunk.usage_metadata
    ).toBeDefined();
  }
});
