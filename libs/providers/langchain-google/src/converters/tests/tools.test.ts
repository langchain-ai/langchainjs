import { describe, expect, test } from "vitest";
import * as z from "zod";
import {
  convertToolChoiceToGeminiConfig,
  schemaToGeminiParameters,
} from "../tools.js";

describe("convertToolChoiceToGeminiConfig", () => {
  test("returns undefined when toolChoice is undefined", () => {
    const result = convertToolChoiceToGeminiConfig(undefined, true);
    expect(result).toBeUndefined();
  });

  test("returns undefined when hasTools is false", () => {
    const result = convertToolChoiceToGeminiConfig("auto", false);
    expect(result).toBeUndefined();
  });

  test('maps "auto" to AUTO mode', () => {
    const result = convertToolChoiceToGeminiConfig("auto", true);
    expect(result).toEqual({
      functionCallingConfig: { mode: "AUTO" },
    });
  });

  test('maps "any" to ANY mode', () => {
    const result = convertToolChoiceToGeminiConfig("any", true);
    expect(result).toEqual({
      functionCallingConfig: { mode: "ANY" },
    });
  });

  test('maps "required" to ANY mode', () => {
    const result = convertToolChoiceToGeminiConfig("required", true);
    expect(result).toEqual({
      functionCallingConfig: { mode: "ANY" },
    });
  });

  test('maps "none" to NONE mode', () => {
    const result = convertToolChoiceToGeminiConfig("none", true);
    expect(result).toEqual({
      functionCallingConfig: { mode: "NONE" },
    });
  });

  test("maps a function name string to ANY mode with allowedFunctionNames", () => {
    const result = convertToolChoiceToGeminiConfig("my_function", true);
    expect(result).toEqual({
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: ["my_function"],
      },
    });
  });

  test("maps object with mode to corresponding Gemini mode", () => {
    const result = convertToolChoiceToGeminiConfig(
      { mode: "auto" } as never,
      true
    );
    expect(result).toEqual({
      functionCallingConfig: { mode: "AUTO" },
    });
  });

  test("maps object with function name to ANY with allowedFunctionNames", () => {
    const result = convertToolChoiceToGeminiConfig(
      { function: { name: "get_weather" } } as never,
      true
    );
    expect(result).toEqual({
      functionCallingConfig: {
        allowedFunctionNames: ["get_weather"],
      },
    });
  });
});

describe("schemaToGeminiParameters", () => {
  test("strips propertyNames from a z.record() field", () => {
    const schema = z.object({
      input: z.number(),
      metadata: z.record(z.string(), z.string()).optional(),
    });
    const result = schemaToGeminiParameters(schema);

    expect(JSON.stringify(result)).not.toContain("propertyNames");
    expect(result.properties).toHaveProperty("metadata");
  });

  test("strips a hardcoded propertyNames regardless of the zod version's own output", () => {
    const schema = {
      type: "object",
      properties: {
        metadata: {
          type: "object",
          propertyNames: { pattern: "^[a-z]+$" },
        },
      },
    } as const;
    const result = schemaToGeminiParameters(schema);

    expect(JSON.stringify(result)).not.toContain("propertyNames");
  });

  test("preserves a property literally named __proto__", () => {
    const schema = JSON.parse(
      '{"type":"object","properties":{"__proto__":{"type":"string"}},"required":["__proto__"]}'
    );
    const result = schemaToGeminiParameters(schema);

    expect(
      Object.prototype.hasOwnProperty.call(result.properties, "__proto__")
    ).toBe(true);
    expect(result.properties?.__proto__).toEqual({ type: "string" });
  });

  test("throws on a recursive/$ref schema instead of silently emptying it", () => {
    type Node = { value: string; children?: Node[] };
    const nodeSchema: z.ZodType<Node> = z.lazy(() =>
      z.object({
        value: z.string(),
        children: z.array(nodeSchema).optional(),
      })
    );

    expect(() => schemaToGeminiParameters(nodeSchema)).toThrow(/\$ref/);
  });

  test("strips additionalProperties, exclusiveMinimum, and exclusiveMaximum", () => {
    const schema = z.object({
      count: z.number().gt(0).lt(100),
      metadata: z.record(z.string(), z.string()),
    });
    const result = schemaToGeminiParameters(schema);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("additionalProperties");
    expect(serialized).not.toContain("exclusiveMinimum");
    expect(serialized).not.toContain("exclusiveMaximum");
  });

  test("preserves property names that collide with schema keywords", () => {
    const schema = {
      type: "object",
      properties: {
        type: { type: "string" },
        properties: { type: "string" },
        required: { type: "string" },
      },
      required: ["type"],
    } as const;
    const result = schemaToGeminiParameters(schema);

    expect(result.properties).toHaveProperty("type");
    expect(result.properties).toHaveProperty("properties");
    expect(result.properties).toHaveProperty("required");
  });

  test("sanitizes nested schemas under properties, items, and anyOf", () => {
    const schema = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" } },
            additionalProperties: false,
          },
        },
        either: {
          anyOf: [
            { type: "object", additionalProperties: { type: "string" } },
            { type: "string" },
          ],
        },
      },
    } as const;
    const result = schemaToGeminiParameters(schema);

    expect(JSON.stringify(result)).not.toContain("additionalProperties");
    expect(result.properties?.tags).toHaveProperty("items");
  });

  test("still converts nullable type arrays via adjustObjectType", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
      },
    } as const;
    const result = schemaToGeminiParameters(schema);

    expect(result.properties?.name).toMatchObject({
      type: "string",
      nullable: true,
    });
  });
});
