import { expect, test } from "@jest/globals";
import { z } from "zod";
import { zodToGeminiParameters } from "../utils/zod_to_gemini_parameters.js";

test("zodToGeminiParameters can convert zod schema to gemini schema", () => {
  const zodSchema = z
    .object({
      operation: z
        .enum(["add", "subtract", "multiply", "divide"])
        .describe("The type of operation to execute"),
      number1: z.number().describe("The first number to operate on."),
      number2: z.number().describe("The second number to operate on."),
      childObject: z.object({}),
    })
    .describe("A simple calculator tool");

  const convertedSchema = zodToGeminiParameters(zodSchema);

  expect(convertedSchema.type).toBe("object");
  expect(convertedSchema.description).toBe("A simple calculator tool");
  expect(convertedSchema).not.toContain("additionalProperties");
  expect(convertedSchema.properties).toEqual({
    operation: {
      type: "string",
      enum: ["add", "subtract", "multiply", "divide"],
      description: "The type of operation to execute",
    },
    number1: {
      type: "number",
      description: "The first number to operate on.",
    },
    number2: {
      type: "number",
      description: "The second number to operate on.",
    },
    childObject: {
      type: "object",
      properties: {},
    },
  });
  expect(convertedSchema.required).toEqual([
    "operation",
    "number1",
    "number2",
    "childObject",
  ]);
});
