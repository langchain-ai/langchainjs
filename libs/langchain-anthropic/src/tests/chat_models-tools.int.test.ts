/* eslint-disable no-process-env */

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
  modelName: "claude-3-sonnet-20240229",
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

test("Can process dual tool use and tool result", async () => {
  const weatherTool = tool((_) => "no-op", {
    name: "get_weather",
    description: "Get the weather of a specific location.",
    schema: z.object({
      location: z.string().describe("The name of city to get the weather for."),
    }),
  });
  const calculatorTool = tool((_) => "no-op", {
    name: "calculator",
    description: "Execute a math expression.",
    schema: z.object({
      expression: z.string().describe("The math expression to calculate."),
    }),
  });

  const modelWithTools = model.bindTools([weatherTool, calculatorTool]);
  const messageHistory = [
    new HumanMessage("What is the weather in SF? Also, what is 2 + 2?"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "get_weather",
          id: "weather_call",
          args: {
            location: "SF",
          },
        },
        {
          name: "calculator",
          id: "calculator_call",
          args: {
            expression: "2 + 2",
          },
        },
      ],
    }),
    new ToolMessage({
      name: "get_weather",
      tool_call_id: "weather_call",
      content: "It is currently 24 degrees with hail in San Francisco.",
    }),
    new ToolMessage({
      name: "calculator",
      tool_call_id: "calculator_call",
      content: "2 + 2 = 4",
    }),
  ];

  const result = await modelWithTools.invoke(messageHistory);
  console.dir(result, { depth: null });
});
