/* eslint-disable no-process-env */

import { expect, test } from "@jest/globals";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
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
    console.log(`WeatherTool called with input: ${input}`);
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
  console.log(res);
  expect(res.content).toContain("24");
});

test("Can bind & invoke StructuredTools", async () => {
  const tools = [new WeatherTool()];

  const modelWithTools = model.bindTools(tools);

  const result = await modelWithTools.invoke(
    "What is the weather in SF today?"
  );
  console.log(
    {
      tool_calls: JSON.stringify(result.content, null, 2),
    },
    "Can bind & invoke StructuredTools"
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
  expect(toolCall.input).toEqual(result.tool_calls?.[0].args);
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
  console.log(result2);
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
  console.log(
    {
      tool_calls: JSON.stringify(result.content, null, 2),
    },
    "Can bind & invoke StructuredTools"
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
  });

  const result = await modelWithTools.stream(
    "What is the weather in London today?"
  );
  let finalMessage;
  for await (const item of result) {
    console.log("item", JSON.stringify(item, null, 2));
    finalMessage = item;
  }

  if (!finalMessage) {
    throw new Error("No final message returned");
  }

  console.log(
    {
      tool_calls: JSON.stringify(finalMessage.content, null, 2),
    },
    "Can bind & invoke StructuredTools"
  );
  expect(Array.isArray(finalMessage.content)).toBeTruthy();
  if (!Array.isArray(finalMessage.content)) {
    throw new Error("Content is not an array");
  }
  let toolCall: AnthropicToolResponse | undefined;
  finalMessage.content.forEach((item) => {
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
  console.log(
    {
      result,
    },
    "withStructuredOutput with zod schema"
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
  console.log(
    {
      result,
    },
    "withStructuredOutput with AnthropicTool"
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
  console.log(
    {
      result,
    },
    "withStructuredOutput JSON Schema only"
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
  console.log(
    {
      tool_calls: JSON.stringify(result.content, null, 2),
    },
    "Can bind & invoke StructuredTools"
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
  expect(toolCall.input).toEqual(result.tool_calls?.[0].args);
  expect(name).toBe("get_weather");
  expect(input).toBeTruthy();
  expect(input.location).toBeTruthy();
});
