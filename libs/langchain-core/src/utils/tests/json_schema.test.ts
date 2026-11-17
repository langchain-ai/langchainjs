import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import { toJsonSchema } from "../json_schema.js";

describe("toJsonSchema", () => {
  describe("with zod v4 schemas", () => {
    // https://github.com/langchain-ai/langchainjs/issues/8367
    it("should allow transformed v4 zod schemas", () => {
      const schema = z4
        .object({
          name: z4.string(),
          age: z4.number(),
        })
        .transform((data) => ({
          ...data,
          upperName: data.name.toUpperCase(),
          doubledAge: data.age * 2,
        }))
        .describe("Object description");
      const jsonSchema = toJsonSchema(schema);
      expect(jsonSchema).toEqual({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        description: "Object description",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
        additionalProperties: false,
      });
    });
    it("should allow v4 zod schemas with inner transforms", () => {
      const userSchema = z4.object({
        name: z4.string().transform((name) => Math.random() * name.length),
        age: z4.number(),
      });
      const schema = z4
        .object({
          users: z4.array(userSchema).transform((users) => users.length),
          count: z4.number().transform((count) => String(count * 2)),
        })
        .transform((data) => JSON.stringify(data));
      const jsonSchema = toJsonSchema(schema);
      expect(jsonSchema).toEqual({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: {
          users: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { name: { type: "string" }, age: { type: "number" } },
              required: ["name", "age"],
            },
          },
          count: { type: "number" },
        },
        required: ["users", "count"],
        additionalProperties: false,
      });
    });
  });

  describe("with Standard JSON Schema", () => {
    it("should extract JSON schema via ~standard.jsonSchema.input()", () => {
      const standardSchema = {
        "~standard": {
          version: 1 as const,
          vendor: "test",
          jsonSchema: {
            input: () => ({
              type: "object",
              properties: {
                name: { type: "string" },
                age: { type: "number" },
              },
              required: ["name", "age"],
            }),
            output: () => ({
              type: "object",
              properties: {
                name: { type: "string" },
                age: { type: "number" },
              },
              required: ["name", "age"],
            }),
          },
        },
      };
      const jsonSchema = toJsonSchema(standardSchema);
      expect(jsonSchema).toEqual({
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name", "age"],
      });
    });

    it("should pass target draft-07 to the input function", () => {
      let receivedTarget: string | undefined;
      const standardSchema = {
        "~standard": {
          version: 1 as const,
          vendor: "test",
          jsonSchema: {
            input: (params: { target: string }) => {
              receivedTarget = params.target;
              return { type: "object" };
            },
            output: () => ({ type: "object" }),
          },
        },
      };
      toJsonSchema(standardSchema);
      expect(receivedTarget).toBe("draft-07");
    });
  });

  describe("caching", () => {
    it("should return the same reference for repeated calls with a zod v3 schema", () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const result1 = toJsonSchema(schema);
      const result2 = toJsonSchema(schema);
      expect(result1).toBe(result2);
    });

    it("should return the same reference for repeated calls with a zod v4 schema", () => {
      const schema = z4.object({ name: z4.string(), age: z4.number() });
      const result1 = toJsonSchema(schema);
      const result2 = toJsonSchema(schema);
      expect(result1).toBe(result2);
    });

    it("should return different results for different schemas", () => {
      const schema1 = z.object({ name: z.string() });
      const schema2 = z.object({ age: z.number() });
      const result1 = toJsonSchema(schema1);
      const result2 = toJsonSchema(schema2);
      expect(result1).not.toBe(result2);
      expect(result1).not.toEqual(result2);
    });

    it("should bypass cache when params are provided", () => {
      const schema = z4.object({ x: z4.number() });
      const resultDefault = toJsonSchema(schema);
      const resultWithParams = toJsonSchema(schema, {
        target: "draft-2020-12",
      });
      // With params should not return the cached reference
      expect(resultDefault).not.toBe(resultWithParams);
    });

    it("should return correct results after caching (not stale data)", () => {
      const schema = z.object({
        title: z.string(),
        count: z.number(),
        active: z.boolean(),
      });
      const result1 = toJsonSchema(schema);
      const result2 = toJsonSchema(schema);
      // Both should be the same reference
      expect(result1).toBe(result2);
      // And the content should be correct
      expect(result1).toMatchObject({
        type: "object",
        properties: {
          title: { type: "string" },
          count: { type: "number" },
          active: { type: "boolean" },
        },
        required: ["title", "count", "active"],
      });
    });

    it("should cache Standard JSON Schema results", () => {
      const standardSchema = {
        "~standard": {
          version: 1 as const,
          vendor: "test",
          jsonSchema: {
            input: () => ({
              type: "object",
              properties: { x: { type: "number" } },
            }),
            output: () => ({
              type: "object",
              properties: { x: { type: "number" } },
            }),
          },
        },
      };
      const result1 = toJsonSchema(standardSchema);
      const result2 = toJsonSchema(standardSchema);
      expect(result1).toBe(result2);
    });

    it("should handle many repeated calls efficiently", () => {
      const schemas = Array.from({ length: 10 }, (_, i) =>
        z.object({ [`field_${i}`]: z.string() })
      );

      // First pass: cold (populates cache)
      const cold = schemas.map((s) => toJsonSchema(s));

      // Second pass: should return same references
      const warm = schemas.map((s) => toJsonSchema(s));

      for (let i = 0; i < schemas.length; i++) {
        expect(cold[i]).toBe(warm[i]);
      }
    });

    it("should not allocate new objects on cache hit (v3)", () => {
      const schema = z.object({
        a: z.string(),
        b: z.number(),
        c: z.boolean(),
      });

      // Cold call to populate cache
      const first = toJsonSchema(schema);

      // Collect all unique object references from 1000 repeated calls
      const refs = new Set<object>();
      for (let i = 0; i < 1000; i++) {
        refs.add(toJsonSchema(schema));
      }

      // Every call should have returned the exact same object
      expect(refs.size).toBe(1);
      expect(refs.has(first)).toBe(true);
    });

    it("should not allocate new objects on cache hit (v4)", () => {
      const schema = z4.object({
        a: z4.string(),
        b: z4.number(),
        c: z4.boolean(),
      });

      const first = toJsonSchema(schema);

      const refs = new Set<object>();
      for (let i = 0; i < 1000; i++) {
        refs.add(toJsonSchema(schema));
      }

      expect(refs.size).toBe(1);
      expect(refs.has(first)).toBe(true);
    });

    it("should produce only N unique objects for N distinct schemas", () => {
      const schemas = Array.from({ length: 20 }, (_, i) =>
        z.object({ [`field_${i}`]: z.string() })
      );

      // Call each schema 50 times
      const allResults: object[] = [];
      for (let rep = 0; rep < 50; rep++) {
        for (const s of schemas) {
          allResults.push(toJsonSchema(s));
        }
      }

      // Should be exactly 20 unique references, not 1000
      const uniqueRefs = new Set(allResults);
      expect(uniqueRefs.size).toBe(20);
      expect(allResults).toHaveLength(1000);
    });

    it("should cache the convertToOpenAIFunction path end-to-end", async () => {
      // This tests the real hot path: convertToOpenAIFunction calls
      // toJsonSchema(tool.schema) on every LLM invocation for every tool
      const { convertToOpenAIFunction } =
        await import("../function_calling.js");

      const toolLike = {
        name: "get_weather",
        description: "Get weather for a city",
        schema: z.object({
          city: z.string().describe("City name"),
          units: z.enum(["celsius", "fahrenheit"]).optional(),
        }),
      };

      const result1 = convertToOpenAIFunction(toolLike);
      const result2 = convertToOpenAIFunction(toolLike);

      // The parameters (JSON schema) should be the same reference
      // because both calls go through toJsonSchema(tool.schema) which
      // hits the cache on the second call
      expect(result1.parameters).toBe(result2.parameters);
    });
  });

  // https://github.com/langchain-ai/langchainjs/issues/12137
  describe("strips redundant Zod format patterns", () => {
    it("drops pattern next to uuid/date/date-time/email formats", () => {
      const schema = z4.object({
        id: z4.uuid(),
        day: z4.iso.date(),
        at: z4.iso.datetime(),
        mail: z4.email(),
      });
      const jsonSchema = toJsonSchema(schema) as {
        properties: Record<string, { format?: string; pattern?: string }>;
      };
      expect(jsonSchema.properties.id).toEqual({
        type: "string",
        format: "uuid",
      });
      expect(jsonSchema.properties.day).toEqual({
        type: "string",
        format: "date",
      });
      expect(jsonSchema.properties.at).toEqual({
        type: "string",
        format: "date-time",
      });
      expect(jsonSchema.properties.mail).toEqual({
        type: "string",
        format: "email",
      });
    });

    it("keeps custom regex patterns without those formats", () => {
      const schema = z4.object({
        code: z4.string().regex(/^ABC-\d+$/),
      });
      const jsonSchema = toJsonSchema(schema) as {
        properties: { code: { pattern?: string; format?: string } };
      };
      expect(jsonSchema.properties.code.pattern).toBe("^ABC-\\d+$");
      expect(jsonSchema.properties.code.format).toBeUndefined();
    });

    it("keeps patterns for non-standard formats like cuid", () => {
      const schema = z4.object({ id: z4.cuid() });
      const jsonSchema = toJsonSchema(schema) as {
        properties: { id: { format?: string; pattern?: string } };
      };
      expect(jsonSchema.properties.id.format).toBe("cuid");
      expect(jsonSchema.properties.id.pattern).toBeDefined();
    });

    it("strips nested properties and array items", () => {
      const schema = z4.object({
        items: z4.array(
          z4.object({
            id: z4.uuid(),
            nested: z4.object({ mail: z4.email() }),
          })
        ),
      });
      const jsonSchema = toJsonSchema(schema) as {
        properties: {
          items: {
            items: {
              properties: {
                id: { format?: string; pattern?: string };
                nested: {
                  properties: { mail: { format?: string; pattern?: string } };
                };
              };
            };
          };
        };
      };
      expect(jsonSchema.properties.items.items.properties.id).toEqual({
        type: "string",
        format: "uuid",
      });
      expect(
        jsonSchema.properties.items.items.properties.nested.properties.mail
      ).toEqual({
        type: "string",
        format: "email",
      });
    });

    it("does not rewrite raw JSON schemas passed through", () => {
      const raw = {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            pattern: "^custom-uuid-pattern$",
          },
        },
      };
      const jsonSchema = toJsonSchema(raw as never) as typeof raw;
      expect(jsonSchema.properties.id.pattern).toBe("^custom-uuid-pattern$");
      expect(jsonSchema).toBe(raw);
    });

    it("caches the stripped schema for repeated Zod conversions", () => {
      const schema = z4.object({ id: z4.uuid() });
      const a = toJsonSchema(schema) as {
        properties: { id: { pattern?: string } };
      };
      const b = toJsonSchema(schema) as {
        properties: { id: { pattern?: string } };
      };
      expect(a).toBe(b);
      expect(a.properties.id.pattern).toBeUndefined();
    });
  });
});
