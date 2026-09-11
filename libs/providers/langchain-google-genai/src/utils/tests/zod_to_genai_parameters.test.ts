import { describe, expect, test } from "vitest";
import { z } from "zod/v3";
import {
  jsonSchemaToGeminiParameters,
  schemaToGenerativeAIParameters,
} from "../zod_to_genai_parameters.js";

function pathsWithArrayValuedType(node: unknown, path = "$"): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((item, i) =>
      pathsWithArrayValuedType(item, `${path}[${i}]`)
    );
  }
  if (node === null || typeof node !== "object") {
    return [];
  }
  const obj = node as Record<string, unknown>;
  const hits = Array.isArray(obj.type) ? [path] : [];
  return hits.concat(
    Object.entries(obj).flatMap(([key, value]) =>
      pathsWithArrayValuedType(value, `${path}.${key}`)
    )
  );
}

describe("schemaToGenerativeAIParameters", () => {
  test("rewrites Zod 3 z.string().nullable() list-valued type to nullable string", () => {
    const schema = z.object({
      nickname: z.string().nullable(),
      age: z.number(),
    });
    const result = schemaToGenerativeAIParameters(schema);

    expect(result.properties?.nickname).toMatchObject({
      type: "string",
      nullable: true,
    });
    expect(result.properties?.age).toMatchObject({ type: "number" });
    expect(result.required).toEqual(["nickname", "age"]);
    expect(pathsWithArrayValuedType(result)).toEqual([]);
  });

  test("rewrites Zod 3 z.null().nullable() ['null','null'] instead of dropping type", () => {
    const schema = z.object({
      n: z.null().nullable(),
    });
    const result = schemaToGenerativeAIParameters(schema);

    expect(result.properties?.n?.type).toBe("null");
    expect(result.properties?.n?.nullable).toBe(true);
    expect(pathsWithArrayValuedType(result)).toEqual([]);
  });

  test("rewrites nullable items nested under arrays", () => {
    const schema = z.object({
      tags: z.array(z.string().nullable()),
    });
    const result = schemaToGenerativeAIParameters(schema);

    expect(result.properties?.tags).toMatchObject({
      type: "array",
      items: { type: "string", nullable: true },
    });
    expect(pathsWithArrayValuedType(result)).toEqual([]);
  });
});

describe("jsonSchemaToGeminiParameters", () => {
  test("unwraps a one-element type array", () => {
    const result = jsonSchemaToGeminiParameters({
      type: "object",
      properties: {
        name: { type: ["string"] },
      },
    });

    expect(result.properties?.name).toEqual({ type: "string" });
    expect(pathsWithArrayValuedType(result)).toEqual([]);
  });

  test("rewrites ['string','null'] to type string plus nullable", () => {
    const result = jsonSchemaToGeminiParameters({
      type: "object",
      properties: {
        nickname: { type: ["string", "null"], description: "optional nick" },
      },
    });

    expect(result.properties?.nickname).toEqual({
      type: "string",
      nullable: true,
      description: "optional nick",
    });
    expect(pathsWithArrayValuedType(result)).toEqual([]);
  });

  test("rewrites ['null','null'] to type null plus nullable", () => {
    const result = jsonSchemaToGeminiParameters({
      type: "object",
      properties: {
        n: { type: ["null", "null"] },
      },
    });

    expect(result.properties?.n).toMatchObject({
      type: "null",
      nullable: true,
    });
    expect(pathsWithArrayValuedType(result)).toEqual([]);
  });

  test("throws on a null-only one-element type array", () => {
    expect(() =>
      jsonSchemaToGeminiParameters({
        type: "object",
        properties: {
          n: { type: ["null"] },
        },
      })
    ).toThrow("Gemini cannot handle null type");
  });

  test("throws on a non-null union type array", () => {
    expect(() =>
      jsonSchemaToGeminiParameters({
        type: "object",
        properties: {
          value: { type: ["string", "number"] },
        },
      })
    ).toThrow("Gemini cannot handle union types");
  });
});
