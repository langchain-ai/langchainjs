import { expect, test, describe } from "vitest";
import { z } from "zod";
import { z as z4 } from "zod/v4";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  jsonSchemaToGeminiParameters,
  schemaToGeminiParameters,
} from "../utils/zod_to_gemini_parameters.js";
import { convertToGeminiTools } from "../utils/common.js";

describe("Gemini anyOf tool schemas", () => {
  const schema = {
    type: "object" as const,
    properties: {
      ids: {
        anyOf: [
          { type: "string" as const },
          { type: "array" as const, items: { type: "string" as const } },
        ],
        description: "One ID or a list of IDs",
      },
    },
    required: ["ids"],
  };

  test.each([
    ["LangChain", schemaToGeminiParameters],
    ["OpenAI", jsonSchemaToGeminiParameters],
  ] as const)(
    "preserves MCP anyOf parameters through the %s converter",
    (_, convert) => {
      expect(convert(schema)).toEqual(schema);
    }
  );

  test.each([
    ["Zod 3", z.object({ ids: z.union([z.string(), z.array(z.string())]) })],
    [
      "Zod 4",
      z4.object({ ids: z4.union([z4.string(), z4.array(z4.string())]) }),
    ],
  ] as const)("preserves string or array unions from %s", (_, input) => {
    const parameters = schemaToGeminiParameters(input);
    expect(parameters.properties?.ids).toEqual({
      anyOf: schema.properties.ids.anyOf,
    });
  });

  test("preserves anyOf with more than two branches", () => {
    const input = {
      type: "object",
      properties: {
        value: {
          anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
        },
      },
    };
    expect(jsonSchemaToGeminiParameters(input)).toEqual(input);
  });

  test("normalizes nested anyOf branches without mutating the input", () => {
    const input = {
      type: "object",
      properties: {
        values: {
          type: "array",
          items: {
            anyOf: [
              {
                type: "object",
                properties: { value: { type: ["string", "null"] } },
                additionalProperties: false,
              },
              { type: "number" },
            ],
          },
        },
      },
      additionalProperties: false,
    };
    const original = structuredClone(input);
    expect(jsonSchemaToGeminiParameters(input)).toEqual({
      type: "object",
      properties: {
        values: {
          type: "array",
          items: {
            anyOf: [
              {
                type: "object",
                properties: { value: { type: "string", nullable: true } },
              },
              { type: "number" },
            ],
          },
        },
      },
    });
    expect(input).toEqual(original);
  });

  test("converts an MCP-style structured tool", () => {
    const tool = new DynamicStructuredTool({
      name: "lookup_ids",
      description: "Look up one or more IDs",
      schema,
      func: async () => "result",
    });
    expect(convertToGeminiTools([tool])).toEqual([
      {
        functionDeclarations: [
          {
            name: tool.name,
            description: tool.description,
            parameters: schema,
          },
        ],
      },
    ]);
  });

  test("still rejects non-nullable oneOf schemas", () => {
    expect(() =>
      jsonSchemaToGeminiParameters({
        type: "object",
        properties: {
          value: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
      })
    ).toThrow("oneOf");
  });
});

describe("schemaToGeminiParameters - edge cases", () => {
  test("should preserve discriminatedUnion and normalize its branches", () => {
    const zodSchema = z.object({
      expiration: z.discriminatedUnion("type", [
        z.object({
          type: z.literal("relative"),
          relativeSeconds: z
            .number()
            .positive()
            .describe("Number of seconds from now until expiration"),
        }),
        z.object({
          type: z.literal("exact"),
          exactDate: z
            .string()
            .describe(
              "Exact expiration date/time in ISO 8601 format (e.g., '2025-06-01T00:00:00Z')"
            ),
        }),
      ]),
    });

    expect(
      schemaToGeminiParameters(zodSchema).properties?.expiration
    ).toMatchObject({
      anyOf: [
        {
          type: "object",
          properties: { relativeSeconds: { type: "number", minimum: 0.01 } },
        },
        { type: "object", properties: { exactDate: { type: "string" } } },
      ],
    });
  });

  test("should handle positive() refinement", () => {
    const zodSchema = z.object({
      amount: z.number().positive().describe("A positive number"),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result).toBeDefined();
    expect(result.properties?.amount).toBeDefined();

    // Check that it's converted to number type with minimum constraint
    expect(result.properties?.amount?.type).toBe("number");
    // Check that exclusiveMinimum: 0 is converted to minimum: 0.01
    // TODO: infer proper types for GeminiFunctionSchema
    // @ts-expect-error GeminiFunctionSchema is poorly typed
    expect(result.properties?.amount?.minimum).toBe(0.01);
    // @ts-expect-error GeminiFunctionSchema is poorly typed
    expect(result.properties?.amount?.exclusiveMinimum).toBeUndefined();
  });

  test("should handle min() constraint", () => {
    const zodSchema = z.object({
      amount: z.number().min(0.01).describe("A positive number"),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result).toBeDefined();
    expect(result.properties?.amount).toBeDefined();
    expect(result.properties?.amount?.type).toBe("number");
  });

  test("should handle required fields", () => {
    const zodSchema = z.object({
      requiredField: z.string(),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result.required).toEqual(["requiredField"]);
    expect(result.properties?.requiredField?.type).toBe("string");
    expect(result.properties?.requiredField?.nullable).toBeUndefined();
  });

  test("should handle nullable union type", () => {
    const zodSchema = z.object({
      nullableField: z.string().nullable(),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result.required).toEqual(["nullableField"]);
    expect(result.properties?.nullableField?.type).toBe("string");
    expect(result.properties?.nullableField?.nullable).toBe(true);
  });

  test("should handle optional union type", () => {
    const zodSchema = z.object({
      optionalField: z.string().optional(),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result.required).toBeUndefined();
    expect(result.properties?.optionalField?.type).toBe("string");
    expect(result.properties?.optionalField?.nullable).toBeUndefined();
  });

  test("should handle nullish (nullable and optional)", () => {
    const zodSchema = z.object({
      nullishField: z.string().nullish(),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result.required).toBeUndefined();
    expect(result.properties?.nullishField?.type).toBe("string");
    expect(result.properties?.nullishField?.nullable).toBe(true);
  });

  test("should handle nullable object type", () => {
    // nullable object type will use oneOf like:
    // { required: ["nullableField"], properties: { nullableField: { anyOf: [{ type: "object", ... }, { type: "null" }] } } }
    const zodSchema = z.object({
      nullableField: z
        .object({
          name: z.string(),
        })
        .nullable(),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result).toBeDefined();
    expect(result.required).toEqual(["nullableField"]);
    expect(result.properties?.nullableField?.type).toBe("object");
    expect(result.properties?.nullableField?.nullable).toBe(true);
  });

  test("should handle optional object type", () => {
    const zodSchema = z.object({
      optionalField: z
        .object({
          name: z.string(),
        })
        .optional(),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result).toBeDefined();
    expect(result.required).toBeUndefined();
    expect(result.properties?.optionalField?.type).toBe("object");
    expect(result.properties?.optionalField?.nullable).toBeUndefined();
  });

  test("should handle nullish object type", () => {
    const zodSchema = z.object({
      nullishField: z
        .object({
          name: z.string(),
        })
        .nullish(),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result).toBeDefined();
    expect(result.required).toBeUndefined();
    expect(result.properties?.nullishField?.type).toBe("object");
    expect(result.properties?.nullishField?.nullable).toBe(true);
  });

  test("should continue to normalize nullable oneOf schemas", () => {
    const result = jsonSchemaToGeminiParameters({
      type: "object",
      properties: {
        data: { oneOf: [{ type: "string" }, { type: "null" }] },
      },
    });
    expect(result.properties?.data).toEqual({ type: "string", nullable: true });
  });

  test("should handle exclusiveMinimum conversion", () => {
    const zodSchema = z.object({
      temperature: z.number().min(100), // This creates exclusiveMinimum in some cases
      percentage: z.number().int().min(0).max(100),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result).toBeDefined();
    // Verify no exclusiveMinimum properties remain
    const stringified = JSON.stringify(result);
    expect(stringified).not.toContain("exclusiveMinimum");
  });
});
