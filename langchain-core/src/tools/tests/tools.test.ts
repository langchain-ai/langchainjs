import { z } from "zod";
import { tool } from "../base.js";
import { ToolCall, ToolMessage } from "../../messages/tool.js";

test("Tool should throw type error if responseFormat does not match func input type", () => {
  const weatherSchema = z.object({
    location: z.string(),
  });

  // @ts-expect-error - Error because responseFormat: contentAndRawOutput makes return type be an instance of ToolMessage
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
    (_): ToolMessage => {
      return new ToolMessage({
        content: "no-op",
        tool_call_id: "no-op",
      });
    },
    {
      name: "weather",
      schema: weatherSchema,
      responseFormat: "content",
    }
  );

  // @ts-expect-error - Error because responseFormat: undefined makes return type be a string
  tool(
    (_): ToolMessage => {
      return new ToolMessage({
        content: "no-op",
        tool_call_id: "no-op",
      });
    },
    {
      name: "weather",
      schema: weatherSchema,
    }
  );

  // Should pass because we're expecting a `ToolMessage` return type due to `responseFormat: contentAndRawOutput`
  tool(
    (_): ToolMessage => {
      return new ToolMessage({
        content: "no-op",
        tool_call_id: "no-op",
      });
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
