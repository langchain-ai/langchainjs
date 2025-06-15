import { test, expect } from "@jest/globals";
import { z } from "zod";

import { DynamicStructuredTool, tool } from "../index.js";
import { ToolMessage } from "../../messages/tool.js";
import { RunnableConfig } from "../../runnables/types.js";

test("Tool should error if responseFormat is content_and_artifact but the function doesn't return a tuple", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const weatherTool = tool(
    // Should be able to type this as base RunnableConfig without issue,
    // though true type is more specific
    (_, _config: RunnableConfig) => {
      return "str";
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "content_and_artifact",
    }
  );

  await expect(async () => {
    await weatherTool.invoke({ location: "San Francisco" });
  }).rejects.toThrow();
});

test("Tool works if responseFormat is content_and_artifact and returns a tuple", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const weatherTool = tool(
    (input) => {
      return ["msg_content", input];
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "content_and_artifact",
    }
  );

  const toolResult = await weatherTool.invoke({ location: "San Francisco" });

  expect(toolResult).not.toBeInstanceOf(ToolMessage);
  expect(toolResult).toBe("msg_content");
});

test("Does not return tool message if responseFormat is content_and_artifact and returns a tuple and a tool call with no id is passed in", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });
  const toolCall = {
    args: { location: "San Francisco" },
    name: "weather",
    type: "tool_call",
  } as const;

  const weatherTool = tool(
    (input, config) => {
      expect(config.toolCall).toEqual(toolCall);
      return ["msg_content", input];
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "content_and_artifact",
    }
  );

  const toolResult = await weatherTool.invoke(toolCall);

  expect(toolResult).toBe("msg_content");
});

test("Returns tool message if responseFormat is content_and_artifact and returns a tuple and a tool call with id is passed in", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const toolCall = {
    id: "testid",
    args: { location: "San Francisco" },
    name: "weather",
    type: "tool_call",
  } as const;

  const weatherTool = tool(
    (input, config) => {
      expect(config.toolCall).toEqual(toolCall);
      return ["msg_content", input];
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "content_and_artifact",
    }
  );

  const toolResult = await weatherTool.invoke(toolCall);

  expect(toolResult).toBeInstanceOf(ToolMessage);
  expect(toolResult.content).toBe("msg_content");
  expect(toolResult.artifact).toEqual({ location: "San Francisco" });
  expect(toolResult.name).toBe("weather");
});

test("Does not double wrap a returned tool message even if a tool call with id is passed in", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const toolCall = {
    id: "testid",
    args: { location: "San Francisco" },
    name: "weather",
    type: "tool_call",
  } as const;

  const weatherTool = tool(
    (_, config) => {
      expect(config.toolCall).toEqual(toolCall);
      return new ToolMessage({
        tool_call_id: "not_original",
        content: "bar",
        name: "baz",
      });
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );

  const toolResult = await weatherTool.invoke(toolCall);

  expect(toolResult).toBeInstanceOf(ToolMessage);
  expect(toolResult.tool_call_id).toBe("not_original");
  expect(toolResult.content).toBe("bar");
  expect(toolResult.name).toBe("baz");
});

test("Tool can accept single string input", async () => {
  const toolCall = {
    id: "testid",
    args: { input: "b" },
    name: "string_tool",
    type: "tool_call",
  } as const;

  const stringTool = tool<z.ZodString>(
    (input: string, config): string => {
      expect(config).toMatchObject({ configurable: { foo: "bar" } });
      if (config.configurable.usesToolCall) {
        expect(config.toolCall).toEqual(toolCall);
      }
      return `${input}a`;
    },
    {
      name: "string_tool",
      description: "A tool that appends 'a' to the input string",
      schema: z.string(),
    }
  );

  const result = await stringTool.invoke("b", { configurable: { foo: "bar" } });
  expect(result).toBe("ba");

  const result2 = await stringTool.invoke(toolCall, {
    configurable: { foo: "bar", usesToolCall: true },
  });
  expect(result2).toBeInstanceOf(ToolMessage);
  expect(result2.content).toBe("ba");
  expect(result2.name).toBe("string_tool");
});

test("Tool declared with JSON schema", async () => {
  const weatherSchema = {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "A place",
      },
    },
    required: ["location"],
  };
  const weatherTool = tool(
    (input) => {
      // even without validation expect input to be passed
      expect(input).toEqual({
        somethingSilly: true,
      });
      return "Sunny";
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );
  expect(weatherTool).toBeInstanceOf(DynamicStructuredTool);

  const weatherTool2 = new DynamicStructuredTool({
    name: "weather",
    description: "get the weather",
    func: async (input) => {
      // even without validation expect input to be passed
      expect(input).toEqual({
        somethingSilly: true,
      });
      return "Sunny";
    },
    schema: weatherSchema,
  });

  // No validation on JSON schema tools
  await weatherTool.invoke({
    somethingSilly: true,
  });
  await weatherTool2.invoke({
    somethingSilly: true,
  });
});

test("Tool input typing is enforced", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const weatherTool = tool(
    (_) => {
      return "Sunny";
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );

  const weatherTool2 = new DynamicStructuredTool({
    name: "weather",
    description: "get the weather",
    func: async (_) => {
      return "Sunny";
    },
    schema: weatherSchema,
  });

  const weatherTool3 = tool(
    async (_) => {
      return "Sunny";
    },
    {
      name: "weather",
      description: "get the weather",
      schema: z.string(),
    }
  );

  await expect(async () => {
    await weatherTool.invoke({
      // @ts-expect-error Invalid argument
      badval: "someval",
    });
  }).rejects.toThrow();
  const res = await weatherTool.invoke({
    location: "somewhere",
  });
  expect(res).toEqual("Sunny");
  await expect(async () => {
    await weatherTool2.invoke({
      // @ts-expect-error Invalid argument
      badval: "someval",
    });
  }).rejects.toThrow();
  const res2 = await weatherTool2.invoke({
    location: "someval",
  });
  expect(res2).toEqual("Sunny");
  const res3 = await weatherTool3.invoke("blah");
  expect(res3).toEqual("Sunny");
});

test("Tool can throw detailed errors", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const stringTool = tool(
    (input) => {
      return JSON.stringify(input);
    },
    {
      name: "string_tool",
      description: "A tool that appends 'a' to the input string",
      schema: weatherSchema,
      verboseParsingErrors: true,
    }
  );

  await expect(
    stringTool.invoke({
      // @ts-expect-error Testing parsing errors
      location: 8,
    })
  ).rejects.toThrow(`Received tool input did not match expected schema
Details: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "number",
    "path": [
      "location"
    ],
    "message": "Expected string, received number"
  }
]`);
});
