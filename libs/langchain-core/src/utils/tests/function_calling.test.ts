import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import { test, expect } from "vitest";
import {
  convertToOpenAIFunction,
  convertToOpenAITool,
} from "../function_calling.js";
import { FakeTool } from "../testing/index.js";

test("Can convert tool to OpenAI Functions format", async () => {
  const tool = new FakeTool({
    name: "faketesttool",
    description: "A fake test tool",
    schema: z.object({
      prop1: z.string(),
      prop2: z.number().describe("Some desc"),
      optionalProp: z.optional(
        z.array(
          z.object({
            nestedRequired: z.string(),
            nestedOptional: z.optional(z.string()),
          })
        )
      ),
    }),
  });
  const result = convertToOpenAIFunction(tool);
  expect(result).toEqual({
    name: "faketesttool",
    description: "A fake test tool",
    parameters: {
      type: "object",
      properties: {
        prop1: {
          type: "string",
        },
        prop2: {
          type: "number",
          description: "Some desc",
        },
        optionalProp: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nestedRequired: {
                type: "string",
              },
              nestedOptional: {
                type: "string",
              },
            },
            required: ["nestedRequired"],
            additionalProperties: false,
          },
        },
      },
      required: ["prop1", "prop2"],
      additionalProperties: false,
      $schema: "http://json-schema.org/draft-07/schema#",
    },
  });
});

test("Can convert tool to OpenAI Tool format", async () => {
  const tool = new FakeTool({
    name: "faketesttool",
    description: "A fake test tool",
    schema: z.object({
      prop1: z.string(),
      prop2: z.number().describe("Some desc"),
      optionalProp: z.optional(
        z.array(
          z.object({
            nestedRequired: z.string(),
            nestedOptional: z.optional(z.string()),
          })
        )
      ),
    }),
  });
  const result = convertToOpenAITool(tool);
  expect(result).toEqual({
    type: "function",
    function: {
      name: "faketesttool",
      description: "A fake test tool",
      parameters: {
        type: "object",
        properties: {
          prop1: {
            type: "string",
          },
          prop2: {
            type: "number",
            description: "Some desc",
          },
          optionalProp: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nestedRequired: {
                  type: "string",
                },
                nestedOptional: {
                  type: "string",
                },
              },
              required: ["nestedRequired"],
              additionalProperties: false,
            },
          },
        },
        required: ["prop1", "prop2"],
        additionalProperties: false,
        $schema: "http://json-schema.org/draft-07/schema#",
      },
    },
  });
});

// https://github.com/langchain-ai/langchainjs/issues/12137
test("convertToOpenAITool strips redundant Zod format patterns from parameters", () => {
  const result = convertToOpenAITool({
    name: "read_thing",
    description: "Read a thing",
    schema: z4.object({
      id: z4.uuid(),
      mail: z4.email(),
      code: z4.string().regex(/^ABC-\d+$/),
    }),
  });
  const props = (
    result.function.parameters as {
      properties: Record<string, { format?: string; pattern?: string }>;
    }
  ).properties;
  expect(props.id).toEqual({ type: "string", format: "uuid" });
  expect(props.mail).toEqual({ type: "string", format: "email" });
  expect(props.code.pattern).toBe("^ABC-\\d+$");
  expect(props.code.format).toBeUndefined();
});
