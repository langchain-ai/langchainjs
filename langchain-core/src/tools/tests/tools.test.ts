import { test, expect } from "@jest/globals";
import { z } from "zod";
import { ContentAndRawOutput, tool } from "../index.js";
import { ToolCall, ToolMessage } from "../../messages/tool.js";

test("Tool should throw type error if types are wrong", () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  // @ts-expect-error - Error because responseFormat: contentAndRawOutput makes return type ContentAndRawOutput
  tool(
    (_): string => {
      return "no-op";
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "contentAndRawOutput",
    }
  );

  // @ts-expect-error - Error because responseFormat: content makes return type be a string
  tool(
    (_): ContentAndRawOutput => {
      return ["no-op", true];
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "content",
    }
  );

  // @ts-expect-error - Error because responseFormat: undefined makes return type be a string
  tool(
    (_): ContentAndRawOutput => {
      return ["no-op", true];
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );

  // Should pass because we're expecting a `ToolMessage` return type due to `responseFormat: contentAndRawOutput`
  tool(
    (_): ContentAndRawOutput => {
      return ["no-op", true];
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "contentAndRawOutput",
    }
  );

  // Should pass because we're expecting a `string` return type due to `responseFormat: content`
  tool(
    (_): string => {
      return "no-op";
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "content",
    }
  );

  // Should pass because we're expecting a `string` return type due to `responseFormat: undefined`
  tool(
    (_): string => {
      return "no-op";
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );

  tool<typeof weatherSchema, string, ToolCall>(
    // @ts-expect-error - Error because setting the third generic to `ToolCall` makes the input type of the function be `ToolCall`
    (_: z.infer<typeof weatherSchema>): string => {
      return "no-op";
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );

  // This works because not setting any generics allows it to infer the correct types
  tool(
    (_: ToolCall): string => {
      return "no-op";
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );
});

test("Tool should error if responseFormat is contentAndRawOutput but the function doesn't return a tuple", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const weatherTool = tool(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_): any => {
      return "str";
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "contentAndRawOutput",
    }
  );

  await expect(async () => {
    await weatherTool.invoke({ location: "San Francisco" });
  }).rejects.toThrow();
});

test("Tool works if responseFormat is contentAndRawOutput and returns a tuple", async () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  const weatherTool = tool(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (input): any => {
      return ["msg_content", input];
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "contentAndRawOutput",
    }
  );

  const toolResult = await weatherTool.invoke({ location: "San Francisco" });

  expect(toolResult).toBeInstanceOf(ToolMessage);
  expect(toolResult.content).toBe("msg_content");
  expect(toolResult.raw_output).toEqual({ location: "San Francisco" });
});
