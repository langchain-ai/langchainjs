import { test, expect } from "@jest/globals";
import { z } from "zod";
import { tool } from "../index.js";
import { ToolMessage } from "../../messages/tool.js";

test("Tool should error if responseFormat is content_and_artifact but the function doesn't return a tuple", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const weatherTool = tool(
    (_) => {
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

  const toolResult = await weatherTool.invoke({
    args: { location: "San Francisco" },
    name: "weather",
    type: "tool_call",
  });

  expect(toolResult).toBe("msg_content");
});

test("Returns tool message if responseFormat is content_and_artifact and returns a tuple and a tool call with id is passed in", async () => {
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

  const toolResult = await weatherTool.invoke({
    id: "testid",
    args: { location: "San Francisco" },
    name: "weather",
    type: "tool_call",
  });

  expect(toolResult).toBeInstanceOf(ToolMessage);
  expect(toolResult.content).toBe("msg_content");
  expect(toolResult.artifact).toEqual({ location: "San Francisco" });
  expect(toolResult.name).toBe("weather");
});

test("Tool can accept single string input", async () => {
  const stringTool = tool((input: string): string => {
    return `${input}a`;
  }, {
    name: "string_tool",
    description: "A tool that appends 'a' to the input string",
  });

  const result = await stringTool.invoke("b");
  expect(result).toBe("ba");
});