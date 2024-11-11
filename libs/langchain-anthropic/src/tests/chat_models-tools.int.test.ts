/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect, test } from "@jest/globals";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { StructuredTool, tool } from "@langchain/core/tools";
import { concat } from "@langchain/core/utils/stream";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { RunnableLambda } from "@langchain/core/runnables";
import { ChatAnthropic } from "../chat_models.js";
import { AnthropicToolResponse } from "../types.js";

const zodSchema = z
  .object({
    location: z.string().describe("The name of city to get the weather for."),
  })
  .describe(
    "Get the weather of a specific location and return the temperature in Celsius."
  );

class WeatherTool extends StructuredTool {
  schema = z.object({
    location: z.string().describe("The name of city to get the weather for."),
  });

  description =
    "Get the weather of a specific location and return the temperature in Celsius.";

  name = "get_weather";

  async _call(input: z.infer<typeof this.schema>) {
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
  const modelWithTools = model.bind({
    tools: [anthropicTool],
  });

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
  const modelWithTools = model.bind({
    tools: [anthropicTool],
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const modelWithTools = model.bind({
    tools: [anthropicTool],
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
      console.log(event);
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
  const jsonSchema = zodToJsonSchema(zodSchema);
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

test("bindTools accepts openai formatted tool", async () => {
  const openaiTool = {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "Get the weather of a specific location and return the temperature in Celsius.",
      parameters: zodToJsonSchema(zodSchema),
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
    .withStructuredOutput(zodToJsonSchema(zodSchema))
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
      parameters: zodToJsonSchema(zodSchema),
    },
  };
  const anthropicTool = {
    name: "get_weather_ant",
    description: "Get the weather of a specific location.",
    input_schema: zodToJsonSchema(zodSchema),
  };
  const tools = [langchainTool, openaiTool, anthropicTool];
  const modelWithTools = model.bindTools(tools);
  const result = await modelWithTools.invoke(
    "Whats the current weather in san francisco?"
  );
  expect(result.tool_calls?.length).toBeGreaterThanOrEqual(1);
});
