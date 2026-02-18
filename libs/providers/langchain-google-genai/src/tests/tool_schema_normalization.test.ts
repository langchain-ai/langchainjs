import { describe, expect, test } from "@jest/globals";
import { convertToolsToGenAI } from "../utils/tools.js";
import { removeAdditionalProperties } from "../utils/zod_to_genai_parameters.js";

type NormalizedTool = {
  functionDeclarations?: Array<{
    parameters?: {
      properties?: Record<
        string,
        {
          type?: unknown;
          nullable?: unknown;
        }
      >;
    };
  }>;
};

describe("Gemini tool schema normalization", () => {
  test("converts type array nullable schema to type + nullable", () => {
    const parsed = removeAdditionalProperties({
      type: "object",
      properties: {
        value: {
          type: ["string", "null"],
        },
      },
    });

    expect(parsed.properties?.value?.type).toBe("string");
    expect(parsed.properties?.value?.nullable).toBe(true);
  });

  test("converts anyOf nullable schema to type + nullable", () => {
    const parsed = removeAdditionalProperties({
      anyOf: [{ type: "number", description: "A number value" }, { type: "null" }],
    });

    expect(parsed.type).toBe("number");
    expect(parsed.nullable).toBe(true);
    expect("anyOf" in parsed).toBe(false);
  });

  test("throws for unsupported non-null union schemas", () => {
    expect(() =>
      removeAdditionalProperties({
        anyOf: [{ type: "number" }, { type: "string" }],
      })
    ).toThrow(/Gemini cannot handle union types/);
  });

  test("normalizes direct functionDeclarations tool parameters", () => {
    const inputTool = {
      functionDeclarations: [
        {
          name: "lookup_weather",
          description: "Get weather by city",
          parameters: {
            type: "object",
            properties: {
              city: {
                type: ["string", "null"],
              },
            },
          },
        },
      ],
    } as unknown as Parameters<typeof convertToolsToGenAI>[0][number];

    const { tools } = convertToolsToGenAI([
      inputTool,
    ]);

    const normalizedTool = tools[0] as NormalizedTool;
    const citySchema =
      normalizedTool.functionDeclarations?.[0]?.parameters?.properties?.city;
    expect(citySchema?.type).toBe("string");
    expect(citySchema?.nullable).toBe(true);
  });
});
