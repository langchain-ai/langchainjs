/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test, describe } from "@jest/globals";
import { z } from "zod";
import { schemaToGeminiParameters } from "../utils/zod_to_gemini_parameters.js";

describe("schemaToGeminiParameters - edge cases", () => {
  test("should throw error for discriminatedUnion", () => {
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

    expect(() => schemaToGeminiParameters(zodSchema)).toThrow(
      "zod_to_gemini_parameters: Gemini cannot handle union types"
    );
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

  test("should handle nullable union type", () => {
    const zodSchema = z.object({
      optionalField: z.string().nullable(),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result.properties?.optionalField?.type).toBe("string");
    expect(result.properties?.optionalField?.nullable).toBe(true);
  });

  test("should handle nullish (nullable and optional)", () => {
    const zodSchema = z.object({
      optionalField: z.string().nullish(),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result.properties?.optionalField?.type).toBe("string");
    expect(result.properties?.optionalField?.nullable).toBe(true);
  });

  test("should handle nullable object type via anyOf", () => {
    const zodSchema = z.object({
      answer: z
        .object({
          value: z.string(),
        })
        .nullable(),
      reasoning: z.string(),
    });

    const result = schemaToGeminiParameters(zodSchema);
    expect(result.properties?.answer?.type).toBe("object");
    expect(result.properties?.answer?.nullable).toBe(true);
    expect(result.properties?.answer).not.toHaveProperty("anyOf");
    expect(result.properties?.answer).not.toHaveProperty(
      "additionalProperties"
    );
    expect(result.properties?.answer?.properties?.value?.type).toBe("string");
  });

  test("should handle nested nullable objects", () => {
    const zodSchema = z.object({
      outer: z.object({
        inner: z
          .object({
            name: z.string(),
          })
          .nullable(),
      }),
    });

    const result = schemaToGeminiParameters(zodSchema);
    const inner = result.properties?.outer?.properties?.inner;
    expect(inner?.type).toBe("object");
    expect(inner?.nullable).toBe(true);
    expect(inner).not.toHaveProperty("anyOf");
  });

  test("should still throw for real union types (non-nullable)", () => {
    const zodSchema = z.object({
      value: z.union([z.string(), z.number()]),
    });

    expect(() => schemaToGeminiParameters(zodSchema)).toThrow(
      "Gemini cannot handle union types"
    );
  });

  test("should provide helpful error message for discriminatedUnion", () => {
    const zodSchema = z.object({
      data: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("a"), value: z.string() }),
        z.object({ kind: z.literal("b"), value: z.number() }),
      ]),
    });

    expect(() => schemaToGeminiParameters(zodSchema)).toThrow(
      "Consider using a flat object structure with optional fields instead"
    );
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
