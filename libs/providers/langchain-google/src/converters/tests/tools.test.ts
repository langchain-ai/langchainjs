import { describe, expect, test } from "vitest";
import * as z from "zod";
import {
  convertToolChoiceToGeminiConfig,
  schemaToGeminiParameters,
} from "../generate_content/tools.js";

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

  test('maps "validated" to VALIDATED mode', () => {
    const result = convertToolChoiceToGeminiConfig("validated", true);
    expect(result).toEqual({
      functionCallingConfig: { mode: "VALIDATED" },
    });
  });

  test('maps object mode "validated" to VALIDATED mode', () => {
    const result = convertToolChoiceToGeminiConfig(
      { mode: "validated" } as never,
      true
    );
    expect(result).toEqual({
      functionCallingConfig: { mode: "VALIDATED" },
    });
  });

  test.each([
    ["AUTO", "AUTO"],
    ["AuTo", "AUTO"],
    ["ANY", "ANY"],
    ["AnY", "ANY"],
    ["REQUIRED", "ANY"],
    ["ReQuIrEd", "ANY"],
    ["NONE", "NONE"],
    ["NoNe", "NONE"],
    ["VALIDATED", "VALIDATED"],
    ["VaLiDaTeD", "VALIDATED"],
  ])(
    "matches mode %s case-insensitively in string and object forms",
    (mode, expected) => {
      for (const toolChoice of [mode, { mode }]) {
        expect(convertToolChoiceToGeminiConfig(toolChoice, true)).toEqual({
          functionCallingConfig: { mode: expected },
        });
      }
    }
  );

  test.each(["getWeather", { mode: "getWeather" }])(
    "preserves the case of a function name in %o",
    (toolChoice) => {
      expect(convertToolChoiceToGeminiConfig(toolChoice, true)).toEqual({
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: ["getWeather"],
        },
      });
    }
  );

  test.each([{ name: "getWeather" }, { name: ["getWeather", "GetForecast"] }])(
    "preserves explicit function names %o when normalizing the mode",
    ({ name }) => {
      expect(
        convertToolChoiceToGeminiConfig(
          { mode: "AnY", function: { name } },
          true
        )
      ).toEqual({
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: Array.isArray(name) ? name : [name],
        },
      });
    }
  );

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

  test("inlines local $defs references, eg. from MCP tool schemas", () => {
    const schema = {
      type: "object",
      $defs: {
        address: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
      properties: {
        billing: { $ref: "#/$defs/address", description: "Billing address" },
        shipping: {
          type: "array",
          items: { anyOf: [{ $ref: "#/$defs/address" }, { type: "string" }] },
        },
      },
    };
    const result = schemaToGeminiParameters(schema);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("$ref");
    expect(serialized).not.toContain("$defs");
    expect(result.properties?.billing).toEqual({
      type: "object",
      description: "Billing address",
      properties: { city: { type: "string" } },
      required: ["city"],
    });
    expect(result.properties?.shipping?.items?.anyOf?.[0]).toMatchObject({
      type: "object",
      properties: { city: { type: "string" } },
    });
  });

  test("inlines draft-07 definitions references", () => {
    const schema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      definitions: { status: { type: "string", enum: ["open", "closed"] } },
      properties: { status: { $ref: "#/definitions/status" } },
    };
    const result = schemaToGeminiParameters(schema);

    expect(result.properties?.status).toEqual({
      type: "string",
      enum: ["open", "closed"],
    });
  });

  test("inlines references nested in referenced definitions", () => {
    const schema = {
      type: "object",
      $defs: {
        name: { type: "string" },
        person: {
          type: "object",
          properties: { first: { $ref: "#/$defs/name" } },
        },
      },
      properties: { owner: { $ref: "#/$defs/person" } },
    };
    const result = schemaToGeminiParameters(schema);

    expect(result.properties?.owner?.properties?.first).toEqual({
      type: "string",
    });
  });

  test("throws on a recursive JSON Schema $ref", () => {
    const schema = {
      type: "object",
      $defs: {
        node: {
          type: "object",
          properties: {
            children: { type: "array", items: { $ref: "#/$defs/node" } },
          },
        },
      },
      properties: { root: { $ref: "#/$defs/node" } },
    };

    expect(() => schemaToGeminiParameters(schema)).toThrow(/\$ref/);
  });

  test("throws on a non-local $ref instead of fetching it", () => {
    const schema = {
      type: "object",
      properties: { item: { $ref: "https://example.com/item.json" } },
    };

    expect(() => schemaToGeminiParameters(schema)).toThrow(/\$ref/);
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
