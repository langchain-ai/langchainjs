import { describe, expect, test } from "vitest";
import { z } from "zod/v3";
import {
  jsonSchemaToGeminiParameters,
  schemaToGenerativeAIParameters,
} from "../utils/zod_to_genai_parameters.js";

describe("schemaToGenerativeAIParameters", () => {
  test("removes exclusive numeric bounds from Zod response schemas", () => {
    const schema = z.object({
      durationMinutes: z.number().int().positive(),
      confidence: z.number().positive(),
      rating: z.number().int().lt(5),
    });

    const result = schemaToGenerativeAIParameters(schema);
    const properties = result.properties as Record<
      string,
      Record<string, unknown>
    >;

    expect(JSON.stringify(result)).not.toContain("exclusiveMinimum");
    expect(JSON.stringify(result)).not.toContain("exclusiveMaximum");
    expect(properties.durationMinutes).toMatchObject({
      type: "integer",
      minimum: 1,
    });
    expect(properties.confidence).toMatchObject({
      type: "number",
      minimum: 0,
    });
    expect(properties.rating).toMatchObject({
      type: "integer",
      maximum: 4,
    });
  });

  test("removes nested exclusive bounds from plain JSON schemas", () => {
    const result = jsonSchemaToGeminiParameters({
      type: "object",
      properties: {
        activity: {
          type: "object",
          properties: {
            durationMinutes: {
              type: "integer",
              exclusiveMinimum: 0,
            },
          },
        },
      },
    });

    const activity = (
      result.properties as Record<string, Record<string, unknown>>
    ).activity;
    const durationMinutes = (
      activity.properties as Record<string, Record<string, unknown>>
    ).durationMinutes;

    expect(JSON.stringify(result)).not.toContain("exclusiveMinimum");
    expect(durationMinutes).toMatchObject({
      type: "integer",
      minimum: 1,
    });
  });
});
