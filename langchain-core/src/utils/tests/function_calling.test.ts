import { z } from "zod/v3";
import { test, expect } from "@jest/globals";
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
