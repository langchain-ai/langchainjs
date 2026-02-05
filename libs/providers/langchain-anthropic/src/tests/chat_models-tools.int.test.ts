/* eslint-disable @typescript-eslint/no-explicit-any */

import { vi, expect, test } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { StructuredTool, tool } from "@langchain/core/tools";
import { concat } from "@langchain/core/utils/stream";
import { z } from "zod/v3";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { RunnableLambda } from "@langchain/core/runnables";
import { ChatAnthropic } from "../chat_models.js";
import { AnthropicToolResponse } from "../types.js";
import { _convertMessagesToAnthropicPayload } from "../utils/message_inputs.js";

const zodSchema = z
  .object({
    location: z.string().describe("The name of city to get the weather for."),
  })
  .describe(
    "Get the weather of a specific location and return the temperature in Celsius."
  );

const weatherToolSchema = z.object({
  location: z.string().describe("The name of city to get the weather for."),
});
type WeatherToolSchema = z.infer<typeof weatherToolSchema>;

class WeatherTool extends StructuredTool {
  schema = weatherToolSchema;

  description =
    "Get the weather of a specific location and return the temperature in Celsius.";

  name = "get_weather";

  async _call(input: WeatherToolSchema) {
    return `The weather in ${input.location} is 25°C`;
  }
}

const model = new ChatAnthropic({
  modelName: "claude-3-haiku-20240307",
  temperature: 0,
});

const anthropicTool = {
  name: "get_weather",
  description:
    "Get the weather of a specific location and return the temperature in Celsius.",
  input_schema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The name of city to get the weather for.",
      },
    },
    required: ["location"],
  },
};

test("Few shotting with tool calls", async () => {
  const chat = model.bindTools([new WeatherTool()]);
  const res = await chat.invoke([
    new HumanMessage("What is the weather in SF?"),
    new AIMessage({
      content: "Let me look up the current weather.",
      tool_calls: [
        {
          id: "toolu_feiwjf9u98r389u498",
          name: "get_weather",
          args: {
            location: "SF",
          },
        },
      ],
    }),
    new ToolMessage({
      tool_call_id: "toolu_feiwjf9u98r389u498",
      content: "It is currently 24 degrees with hail in San Francisco.",
    }),
    new AIMessage(
      "It is currently 24 degrees in San Francisco with hail in San Francisco."
    ),
    new HumanMessage("What did you say the weather was?"),
  ]);
  expect(res.content).toContain("24");
});

test("Multipart ToolMessage", async () => {
  const chat = model.bindTools([new WeatherTool()]);
  const res = await chat.invoke([
    new HumanMessage("What is the weather in SF?"),
    new AIMessage({
      content: "Let me look up the current weather.",
      tool_calls: [
        {
          id: "toolu_feiwjf9u98r389u498",
          name: "get_weather",
          args: {
            location: "SF",
          },
        },
      ],
    }),
    new ToolMessage({
      tool_call_id: "toolu_feiwjf9u98r389u498",
      content: [
        {
          type: "text",
          text: "It is currently 24 degrees with hail in San Francisco.",
        },
        {
          type: "image_url",
          image_url:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA5QAAAOUBj+WbPAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAH0SURBVFiFzZcxSytBEMd/E+PL2aVNKomFpBP1K4iFvEIQrN6neGAZEUWw8xMIthZaSAR5rzPwGi0t9APIK0RBCxMsxiKzst7lLpszeA4Mt7c785//DLs7d6Kq5BURaQOo6kpujLwERKQCdO01UtVeHpxSrujGIWX8ZQTGIgkCItIQkZaI1McVRETqhtlILKrqBwV2AAVugXp8PWbbATpDbOqGpUArsT7E4QaoZYALtpFT1muGkZpQFmvneA2Us7JMwSibr0tkYDWzAGoG8ARUvfk5YA/4CzwC98A5sAs0Pbuq+V5nVjEgi6qNJ4Et4NWyGqRdYAOY8EhkVi+0nD+Af16gQ2ANmAZmgHXgyFv/A5SCsAMJbBvwf2A5w24VeDDb32MhAMx7ZV8KsF8z2xdgdhwE9g3wYIQTcGw+m8NsS9BvLCISOeWjLNjzhHBxtov+pB/DmhkAbZK7uUP/kikBzzaXepQGVKBpPnf2LoYZj9MuvBk5xhUgchrL5oI+258jVOCX+ZzG5iNPK+97QFV7qtp1GuN4Zc/VEfJytpexZLue9t4r8K2PoRZ9ERlwMVcxRTYjimzHFPlBQtGfZHyDj9IG0AoIHnmbLwog0QIa8bXP/JpF9C8bgClN3qBBUngz+gwBTRmPJOXc0VV7InLmxnlx3gDvLHwSZKNszAAAAABJRU5ErkJggg==",
        },
      ],
    }),
    new AIMessage(
      "It is currently 24 degrees in San Francisco with hail in San Francisco."
    ),
    new HumanMessage("What did you say the weather was?"),
  ]);
  expect(res.content).toContain("24");
});

test("Invalid tool calls should throw an appropriate error", async () => {
  const chat = model.bindTools([new WeatherTool()]);
  let error;
  try {
    await chat.invoke([
      new HumanMessage("What is the weather in SF?"),
      new AIMessage({
        content: "Let me look up the current weather.",
        tool_calls: [
          {
            id: "toolu_feiwjf9u98r389u498",
            name: "get_weather",
            args: {
              location: "SF",
            },
          },
        ],
      }),
      new ToolMessage({
        tool_call_id: "badbadbad",
        content: "It is currently 24 degrees with hail in San Francisco.",
      }),
    ]);
  } catch (e) {
    error = e;
  }
  expect(error).toBeDefined();
  expect((error as any).lc_error_code).toEqual("INVALID_TOOL_RESULTS");
});

test("Can bind & invoke StructuredTools", async () => {
  const tools = [new WeatherTool()];

  const modelWithTools = model.bindTools(tools);

  const result = await modelWithTools.invoke(
    "What is the weather in SF today?"
  );

  expect(Array.isArray(result.content)).toBeTruthy();
  if (!Array.isArray(result.content)) {
    throw new Error("Content is not an array");
  }
  let toolCall: AnthropicToolResponse | undefined;
  result.content.forEach((item) => {
    if (item.type === "tool_use") {
      toolCall = item as AnthropicToolResponse;
    }
  });
  if (!toolCall) {
    throw new Error("No tool call found");
  }
  expect(toolCall).toBeTruthy();
  const { name, input } = toolCall;
  expect(input).toEqual(result.tool_calls?.[0].args);
  expect(name).toBe("get_weather");
  expect(input).toBeTruthy();
  expect(input.location).toBeTruthy();
  const result2 = await modelWithTools.invoke([
    new HumanMessage("What is the weather in SF today?"),
    result,
    new ToolMessage({
      tool_call_id: result.tool_calls?.[0].id ?? "",
      content:
        "The weather in San Francisco is currently 59 degrees and sunny.",
    }),
    new AIMessage(
      "The weather in San Francisco is currently 59 degrees and sunny."
    ),
    new HumanMessage("What did you say the weather was?"),
  ]);
  // This should work, but Anthorpic is too skeptical
  expect(result2.content).toContain("59");
});

test("Can bind & invoke AnthropicTools", async () => {
  const modelWithTools = model.bindTools([anthropicTool]);

  const result = await modelWithTools.invoke(
    "What is the weather in London today?"
  );

  expect(Array.isArray(result.content)).toBeTruthy();
  if (!Array.isArray(result.content)) {
    throw new Error("Content is not an array");
  }
  let toolCall: AnthropicToolResponse | undefined;
  result.content.forEach((item) => {
    if (item.type === "tool_use") {
      toolCall = item as AnthropicToolResponse;
    }
  });
  if (!toolCall) {
    throw new Error("No tool call found");
  }
  expect(toolCall).toBeTruthy();
  const { name, input } = toolCall;
  expect(name).toBe("get_weather");
  expect(input).toBeTruthy();
  expect(input.location).toBeTruthy();
});

test("Can bind & stream AnthropicTools", async () => {
  const modelWithTools = model.bindTools([anthropicTool]).withConfig({
    tool_choice: {
      type: "tool",
      name: "get_weather",
    },
  });

  const result = await modelWithTools.stream(
    "What is the weather in London today?"
  );
  let finalMessage: AIMessageChunk | undefined;
  for await (const item of result) {
    if (!finalMessage) {
      finalMessage = item;
    } else {
      finalMessage = concat(finalMessage, item);
    }
  }

  expect(finalMessage).toBeDefined();
  if (!finalMessage) {
    throw new Error("No final message returned");
  }

  expect(Array.isArray(finalMessage.content)).toBeTruthy();
  if (!Array.isArray(finalMessage.content)) {
    throw new Error("Content is not an array");
  }

  const toolCall = finalMessage.tool_calls?.[0];
  if (toolCall === undefined) {
    throw new Error("No tool call found");
  }
  expect(toolCall).toBeTruthy();
  const { name, args } = toolCall;
  expect(name).toBe("get_weather");
  expect(args).toBeTruthy();
  expect(args.location).toBeTruthy();
});

test("stream events with no tool calls has string message content", async () => {
  const wrapper = RunnableLambda.from(async (_, config) => {
    const res = await model.invoke(
      "What is the weather in London today?",
      config
    );
    return res;
  });
  const eventStream = await wrapper.streamEvents(
    "What is the weather in London today?",
    {
      version: "v2",
    }
  );

  const chatModelStreamEvents = [];
  for await (const event of eventStream) {
    if (event.event === "on_chat_model_stream") {
      chatModelStreamEvents.push(event);
    }
  }
  expect(chatModelStreamEvents.length).toBeGreaterThan(0);
  expect(
    chatModelStreamEvents.every(
      (event) => typeof event.data.chunk.content === "string"
    )
  ).toBe(true);
});

test("stream events with tool calls has raw message content", async () => {
  const modelWithTools = model.bindTools([anthropicTool]).withConfig({
    tool_choice: {
      type: "tool",
      name: "get_weather",
    },
  });

  const wrapper = RunnableLambda.from(async (_, config) => {
    const res = await modelWithTools.invoke(
      "What is the weather in London today?",
      config
    );
    return res;
  });
  const eventStream = await wrapper.streamEvents(
    "What is the weather in London today?",
    {
      version: "v2",
    }
  );

  const chatModelStreamEvents = [];
  for await (const event of eventStream) {
    if (event.event === "on_chat_model_stream") {
      chatModelStreamEvents.push(event);
    }
  }
  expect(chatModelStreamEvents.length).toBeGreaterThan(0);
  expect(
    chatModelStreamEvents.every((event) =>
      Array.isArray(event.data.chunk.content)
    )
  ).toBe(true);
});

test("withStructuredOutput with zod schema", async () => {
  const modelWithTools = model.withStructuredOutput<{ location: string }>(
    zodSchema,
    {
      name: "get_weather",
    }
  );

  const result = await modelWithTools.invoke(
    "What is the weather in London today?"
  );
  expect(typeof result.location).toBe("string");
});

test("withStructuredOutput with AnthropicTool", async () => {
  const modelWithTools = model.withStructuredOutput<{ location: string }>(
    anthropicTool,
    {
      name: anthropicTool.name,
    }
  );

  const result = await modelWithTools.invoke(
    "What is the weather in London today?"
  );

  expect(typeof result.location).toBe("string");
});

test("withStructuredOutput JSON Schema only", async () => {
  const jsonSchema = toJsonSchema(zodSchema);
  const modelWithTools = model.withStructuredOutput<{ location: string }>(
    jsonSchema,
    {
      name: "get_weather",
    }
  );

  const result = await modelWithTools.invoke(
    "What is the weather in London today?"
  );

  expect(typeof result.location).toBe("string");
});

test("Can pass tool_choice", async () => {
  const tool1 = {
    name: "get_weather",
    description:
      "Get the weather of a specific location and return the temperature in Celsius.",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The name of city to get the weather for.",
        },
      },
      required: ["location"],
    },
  };
  const tool2 = {
    name: "calculator",
    description: "Calculate any math expression and return the result.",
    input_schema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "The math expression to calculate.",
        },
      },
      required: ["expression"],
    },
  };
  const tools = [tool1, tool2];

  const modelWithTools = model.bindTools(tools, {
    tool_choice: {
      type: "tool",
      name: "get_weather",
    },
  });

  const result = await modelWithTools.invoke(
    "What is the sum of 272818 and 281818?"
  );

  expect(Array.isArray(result.content)).toBeTruthy();
  if (!Array.isArray(result.content)) {
    throw new Error("Content is not an array");
  }
  let toolCall: AnthropicToolResponse | undefined;
  result.content.forEach((item) => {
    if (item.type === "tool_use") {
      toolCall = item as AnthropicToolResponse;
    }
  });
  if (!toolCall) {
    throw new Error("No tool call found");
  }
  expect(toolCall).toBeTruthy();
  const { name, input } = toolCall;
  expect(input).toEqual(result.tool_calls?.[0].args);
  expect(name).toBe("get_weather");
  expect(input).toBeTruthy();
  expect(input.location).toBeTruthy();
});

test("Can tool choice set none", async () => {
  const weatherTool = tool((_) => "no-op", {
    name: "get_weather",
    description: zodSchema.description,
    schema: zodSchema,
  });

  const modelWithTools = model.bindTools([weatherTool], {
    tool_choice: "none",
  });

  const result = await modelWithTools.invoke(
    "What is the weather in SF today?"
  );

  expect(result.tool_calls).toStrictEqual([]);
});

test("bindTools accepts openai formatted tool", async () => {
  const openaiTool = {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "Get the weather of a specific location and return the temperature in Celsius.",
      parameters: toJsonSchema(zodSchema),
    },
  };
  const modelWithTools = model.bindTools([openaiTool]);
  const response = await modelWithTools.invoke(
    "Whats the weather like in san francisco?"
  );
  expect(response.tool_calls).toHaveLength(1);
  const { tool_calls } = response;
  if (!tool_calls) {
    return;
  }
  expect(tool_calls[0].name).toBe("get_weather");
});

test("withStructuredOutput will always force tool usage", async () => {
  const weatherTool = z
    .object({
      location: z.string().describe("The name of city to get the weather for."),
    })
    .describe(
      "Get the weather of a specific location and return the temperature in Celsius."
    );
  const modelWithTools = model.withStructuredOutput(weatherTool, {
    name: "get_weather",
    includeRaw: true,
  });
  const response = await modelWithTools.invoke(
    "What is the sum of 271623 and 281623? It is VERY important you use a calculator tool to give me the answer."
  );

  if (!("tool_calls" in response.raw)) {
    throw new Error("Tool call not found in response");
  }
  const castMessage = response.raw as AIMessage;
  expect(castMessage.tool_calls).toHaveLength(1);
  expect(castMessage.tool_calls?.[0].name).toBe("get_weather");
});

test("Can stream tool calls", async () => {
  const weatherTool = tool((_) => "no-op", {
    name: "get_weather",
    description: zodSchema.description,
    schema: zodSchema,
  });

  const modelWithTools = model.bindTools([weatherTool], {
    tool_choice: {
      type: "tool",
      name: "get_weather",
    },
  });
  const stream = await modelWithTools.stream(
    "What is the weather in San Francisco CA?"
  );

  let realToolCallChunkStreams = 0;
  let prevToolCallChunkArgs = "";
  let finalChunk: AIMessageChunk | undefined;
  for await (const chunk of stream) {
    if (!finalChunk) {
      finalChunk = chunk;
    } else {
      finalChunk = concat(finalChunk, chunk);
    }
    if (chunk.tool_call_chunks?.[0]?.args) {
      // Check if the args have changed since the last chunk.
      // This helps count the number of unique arg updates in the stream,
      // ensuring we're receiving multiple chunks with different arg content.
      if (
        !prevToolCallChunkArgs ||
        prevToolCallChunkArgs !== chunk.tool_call_chunks[0].args
      ) {
        realToolCallChunkStreams += 1;
      }
      prevToolCallChunkArgs = chunk.tool_call_chunks[0].args;
    }
  }

  expect(finalChunk?.tool_calls?.[0]).toBeDefined();
  expect(finalChunk?.tool_calls?.[0].name).toBe("get_weather");
  expect(finalChunk?.tool_calls?.[0].args.location).toBeDefined();
  expect(realToolCallChunkStreams).toBeGreaterThan(1);
});

test("llm token callbacks can handle tool calls", async () => {
  const weatherTool = tool((_) => "no-op", {
    name: "get_weather",
    description: zodSchema.description,
    schema: zodSchema,
  });

  const modelWithTools = model.bindTools([weatherTool], {
    tool_choice: {
      type: "tool",
      name: "get_weather",
    },
  });

  let tokens = "";
  const stream = await modelWithTools.stream("What is the weather in SF?", {
    callbacks: [
      {
        handleLLMNewToken: (tok) => {
          tokens += tok;
        },
      },
    ],
  });

  let finalChunk: AIMessageChunk | undefined;
  for await (const chunk of stream) {
    finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
  }

  expect(finalChunk?.tool_calls?.[0]).toBeDefined();
  expect(finalChunk?.tool_calls?.[0].name).toBe("get_weather");
  expect(finalChunk?.tool_calls?.[0].args).toBeDefined();
  const args = finalChunk?.tool_calls?.[0].args;
  if (!args) return;
  expect(args).toEqual(JSON.parse(tokens));
});

test("streaming with structured output", async () => {
  const stream = await model
    .withStructuredOutput(zodSchema)
    .stream("weather in london");
  // Currently, streaming yields a single chunk
  let finalChunk;
  for await (const chunk of stream) {
    finalChunk = chunk;
  }
  expect(typeof finalChunk).toEqual("object");
  const stream2 = await model
    .withStructuredOutput(toJsonSchema(zodSchema))
    .stream("weather in london");
  // Currently, streaming yields a single chunk
  let finalChunk2;
  for await (const chunk of stream2) {
    finalChunk2 = chunk;
  }
  expect(typeof finalChunk2).toEqual("object");
});

test("Can bound and invoke different tool types", async () => {
  const langchainTool = {
    name: "get_weather_lc",
    description: "Get the weather of a specific location.",
    schema: zodSchema,
  };
  const openaiTool = {
    type: "function",
    function: {
      name: "get_weather_oai",
      description: "Get the weather of a specific location.",
      parameters: toJsonSchema(zodSchema),
    },
  };
  const anthropicTool = {
    name: "get_weather_ant",
    description: "Get the weather of a specific location.",
    input_schema: toJsonSchema(zodSchema),
  };
  const tools = [langchainTool, openaiTool, anthropicTool];
  const modelWithTools = model.bindTools(tools);
  const result = await modelWithTools.invoke(
    "Whats the current weather in san francisco?"
  );
  expect(result.tool_calls?.length).toBeGreaterThanOrEqual(1);
});

test("Can call and use two tool calls at once", async () => {
  const tool = {
    name: "generate_random_joke",
    description: "Generate a random joke.",
    schema: z.object({
      prompt: z.string().describe("The prompt to generate the joke for."),
    }),
  };
  const largeModel = new ChatAnthropic({
    model: "claude-3-5-sonnet-latest",
    temperature: 0,
  }).bindTools([tool]);

  const inputMessage = new HumanMessage(
    "Generate three (3) random jokes. Please use the generate_random_joke tool, and call it three times in your response to me. Ensure you call the tool three times before responding to me. This is very important."
  );

  const result = await largeModel.invoke([inputMessage]);
  expect(result.tool_calls).toHaveLength(3);

  const toolResult1 = new ToolMessage({
    tool_call_id: result.tool_calls?.[0].id || "",
    name: "generate_random_joke",
    content: [
      {
        type: "text",
        text: "This is a joke.",
      },
    ],
  });
  const toolResult2 = new ToolMessage({
    tool_call_id: result.tool_calls?.[1].id || "",
    name: "generate_random_joke",
    content: [
      {
        type: "text",
        text: "This is the second joke!!",
      },
    ],
  });
  const toolResult3 = new ToolMessage({
    tool_call_id: result.tool_calls?.[2].id || "",
    name: "generate_random_joke",
    content: "This is the third joke!!",
  });

  const responseHumanMessage = new HumanMessage(
    "Please rate all these jokes on a scale of 1-10. Rate them on how funny you think they are."
  );
  const result2 = await largeModel.invoke([
    inputMessage,
    result,
    toolResult1,
    toolResult2,
    toolResult3,
    responseHumanMessage,
  ]);

  expect(result2.content.length).toBeGreaterThan(5);
});

test("converting messages doesn't drop tool input", async () => {
  const tool = {
    name: "generate_random_joke",
    description: "Generate a random joke.",
    schema: z.object({
      prompt: z.string().describe("The prompt to generate the joke for."),
    }),
  };
  const largeModel = new ChatAnthropic({
    model: "claude-3-5-sonnet-latest",
    temperature: 0,
  }).bindTools([tool]);

  const inputMessage = new HumanMessage(
    "Generate three (3) random jokes. Please use the generate_random_joke tool, and call it three times in your response to me. Ensure you call the tool three times before responding to me. This is very important."
  );

  const result = await largeModel.invoke([inputMessage]);
  expect(result.tool_calls).toHaveLength(3);

  const converted = _convertMessagesToAnthropicPayload([result]);
  // @ts-expect-error We're forcing this type in the conversion function.
  expect(converted.messages[0].content[1].input.prompt).toBeDefined();
});

test("structured output with thinking enabled", async () => {
  const llm = new ChatAnthropic({
    modelName: "claude-3-7-sonnet-latest",
    maxTokens: 5000,
    thinking: { type: "enabled", budget_tokens: 2000 },
  });

  // Mock console.warn to check for warnings
  const originalWarn = console.warn;
  const mockWarn = vi.fn();
  console.warn = mockWarn;

  try {
    const structuredLlm = llm.withStructuredOutput(
      z
        .object({
          username: z.string().describe("The generated username"),
          theme: z.string().describe("The theme of the username"),
        })
        .describe("Generate a username based on user characteristics"),
      { name: "GenerateUsername" }
    );

    const query = "Generate a username for Sally with green hair";
    const response = await structuredLlm.invoke(query);

    expect(typeof response.username).toBe("string");
    expect(typeof response.theme).toBe("string");

    // Check that a warning was issued
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("structured output")
    );

    // Test error handling
    await expect(structuredLlm.invoke("Hello")).rejects.toThrow();

    // Test streaming
    const stream = await structuredLlm.stream(query);
    let finalChunk;
    for await (const chunk of stream) {
      finalChunk = chunk;
    }
    expect(typeof finalChunk?.username).toBe("string");
  } finally {
    console.warn = originalWarn;
  }
});

/**
 * Structured output currently relies on forced tool use, which is not supported
 * when `thinking` is enabled. When this test fails, it means that the feature
 * is supported and the workarounds in `with_structured_output` should be removed.
 */
test("structured output with thinking force tool use", async () => {
  const llm = new ChatAnthropic({
    modelName: "claude-3-7-sonnet-latest",
    maxTokens: 5000,
    thinking: { type: "enabled", budget_tokens: 2000 },
  }).bindTools(
    [
      {
        name: "GenerateUsername",
        description: "Generate a username based on user characteristics",
        schema: z.object({
          name: z.string().describe("The user's name"),
          characteristics: z.string().describe("The user's characteristics"),
        }),
      },
    ],
    {
      tool_choice: {
        type: "tool",
        name: "GenerateUsername",
      },
    }
  );

  await expect(
    llm.invoke("Generate a username for Sally with green hair")
  ).rejects.toThrow();
});

test("calling tool with no args should work", async () => {
  const llm = new ChatAnthropic({
    model: "claude-3-7-sonnet-latest",
  });
  const sfWeatherTool = tool(
    async () => "The weather is 80 degrees and sunny",
    {
      name: "sf_weather",
      description: "Get the weather in SF location",
      schema: z.object({}),
    }
  );
  const llmWithTools = llm.bindTools([sfWeatherTool]);
  const result = await llmWithTools.invoke("What is the weather in SF?");
  const nextMessage = await sfWeatherTool.invoke(result.tool_calls![0]);
  const finalResult = await llmWithTools.invoke([
    {
      role: "user",
      content: "What is the weather in SF?",
    },
    result,
    nextMessage,
  ]);
  expect(finalResult.content).toContain("80");
});

// test.skip("calling tool with no args in agent should work", async () => {
//   const { createReactAgent } = await import("@langchain/langgraph/prebuilt");
//   const llm = new ChatAnthropic({
//     model: "claude-3-7-sonnet-latest",
//   });
//   const sfWeatherTool = tool(
//     async ({}) => {
//       return "The weather is 80 degrees and sunny";
//     },
//     {
//       name: "sf_weather",
//       description: "Get the weather in SF location",
//       schema: z.object({}),
//     }
//   );
//   const agent = createReactAgent({
//     llm,
//     tools: [sfWeatherTool],
//   });
//   const result = await agent.invoke({
//     messages: [
//       {
//         role: "user",
//         content: "What is the weather in SF?",
//       },
//     ],
//   });
//   console.log(result);
//   expect(result.messages.at(-1)?.content).toContain("80");
// });

// https://docs.claude.com/en/docs/agents-and-tools/tool-use/memory-tool
test("memory tool", async () => {
  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    clientOptions: {
      defaultHeaders: {
        "anthropic-beta": "context-management-2025-06-27",
      },
    },
  });
  const llmWithTools = llm.bindTools([
    { type: "memory_20250818", name: "memory" },
  ]);
  const response = await llmWithTools.invoke("What are my interests?");
  expect(response).toBeInstanceOf(AIMessage);
  expect(response.tool_calls).toBeDefined();
  expect(response.tool_calls?.[0].name).toBe("memory");
});

// https://docs.claude.com/en/docs/build-with-claude/context-editing
test("context management", async () => {
  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
    clientOptions: {
      defaultHeaders: {
        "anthropic-beta": "context-management-2025-06-27",
      },
    },
    contextManagement: {
      edits: [
        {
          type: "clear_tool_uses_20250919",
          trigger: { type: "input_tokens", value: 10 },
          clear_at_least: { type: "input_tokens", value: 5 },
        },
      ],
    },
  });
  const llmWithTools = llm.bindTools([
    { type: "web_search_20250305", name: "web_search" },
  ]);
  const inputMessage = {
    role: "user",
    content: "Search for recent developments in AI",
  };
  const response = await llmWithTools.invoke([inputMessage]);
  expect(response.response_metadata.context_management).toBeDefined();

  // Test streaming
  let full: AIMessageChunk | undefined;
  for await (const chunk of await llmWithTools.stream([inputMessage])) {
    expect(chunk).toBeInstanceOf(AIMessageChunk);
    full = full ? concat(full, chunk) : chunk;
  }
  expect(full).toBeInstanceOf(AIMessageChunk);
  expect(full?.response_metadata.context_management).toBeDefined();
});

test("tool extras with defer_loading are merged into tool definitions", async () => {
  const getWeather = tool(
    async (input: { location: string; unit?: string }) => {
      return `The weather in ${input.location} is sunny and 72°${(input.unit ??
        "fahrenheit")[0].toUpperCase()}`;
    },
    {
      name: "get_weather",
      description: "Get the current weather for a location.",
      schema: z.object({
        location: z.string().describe("City name"),
        unit: z
          .string()
          .optional()
          .default("fahrenheit")
          .describe("Temperature unit (celsius or fahrenheit)"),
      }),
      extras: { defer_loading: true },
    }
  );

  const searchFiles = tool(
    async (input: { query: string }) => {
      return `Found 3 files matching '${input.query}'`;
    },
    {
      name: "search_files",
      description: "Search through files in the workspace.",
      schema: z.object({
        query: z.string().describe("Search query"),
      }),
      extras: { defer_loading: true },
    }
  );

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20250929",
  });

  // Verify the payload includes extras fields using formatStructuredToolToAnthropic
  const formattedTools = llm.formatStructuredToolToAnthropic([
    getWeather,
    searchFiles,
  ]);

  expect(formattedTools).toBeDefined();

  // Check that defer_loading was merged for both LangChain tools
  const weatherTool = formattedTools?.find(
    (t) => "name" in t && t.name === "get_weather"
  );
  const searchTool = formattedTools?.find(
    (t) => "name" in t && t.name === "search_files"
  );

  expect(weatherTool).toBeDefined();
  expect(weatherTool).toHaveProperty("defer_loading", true);
  expect(searchTool).toBeDefined();
  expect(searchTool).toHaveProperty("defer_loading", true);

  // Test with actual API call
  const llmWithTools = llm.bindTools([
    getWeather,
    searchFiles,
    { type: "tool_search_tool_regex_20251119", name: "tool_search_tool_regex" },
  ]);
  const inputMessage = {
    role: "user",
    content: "What's the weather in San Francisco?",
  };
  const response = await llmWithTools.invoke([inputMessage]);

  // Verify response structure
  expect(Array.isArray(response.content)).toBe(true);
  expect(
    (response.content as any[]).every(
      (block) => typeof block === "string" || typeof block === "object"
    )
  ).toBe(true);

  // Check for tool-related blocks
  const blockTypes = new Set(
    (response.content as any[])
      .filter((block) => typeof block === "object" && "type" in block)
      .map((block) => block.type)
  );

  // Should have either server_tool_use (tool search) or tool_use blocks
  expect(blockTypes.has("server_tool_use") || blockTypes.has("tool_use")).toBe(
    true
  );
});

test("partial tool input is correctly merged before calling Anthropic API", async () => {
  const messages = [
    new HumanMessage("What's the weather in Seattle tomorrow?"),
    new AIMessage({
      response_metadata: { output_version: "v2" },
      contentBlocks: [
        { index: 1, type: "text", text: "I need to call the get_weather tool" },
        {
          index: 2,
          type: "tool_use",
          name: "get_weather",
          id: "tool_call_id",
          input: "",
        },
        { index: 2, type: "input_json_delta", input: '{"city": "' },
        { index: 2, type: "input_json_delta", input: 'Seattle", "da' },
        { index: 2, type: "input_json_delta", input: 'te": "to' },
        { index: 2, type: "input_json_delta", input: 'morrow"}' },
      ],
    }),
  ];

  const {
    messages: [, aiMessagePayload],
  } = _convertMessagesToAnthropicPayload(messages);
  expect(aiMessagePayload.content).toHaveLength(2);

  const [, toolCall] = aiMessagePayload.content;
  expect(toolCall).toStrictEqual({
    type: "tool_use",
    name: "get_weather",
    id: "tool_call_id",
    input: { city: "Seattle", date: "tomorrow" },
  });
});
