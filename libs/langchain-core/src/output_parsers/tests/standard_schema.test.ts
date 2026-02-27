import { describe, it, expect } from "vitest";
import { StandardSchemaV1 } from "@standard-schema/spec";
import { StandardSchemaOutputParser } from "../standard_schema.js";
import { OutputParserException } from "../base.js";

function makeValidatingSchema<T extends Record<string, unknown>>(
  validator: (
    value: unknown
  ) => StandardSchemaV1.Result<T> | Promise<StandardSchemaV1.Result<T>>
): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: validator,
    },
  };
}

describe("StandardSchemaOutputParser", () => {
  describe("fromStandardSchema", () => {
    it("creates a parser instance", () => {
      const schema = makeValidatingSchema((v) => ({
        value: v as Record<string, unknown>,
      }));
      const parser = StandardSchemaOutputParser.fromStandardSchema(schema);
      expect(parser).toBeInstanceOf(StandardSchemaOutputParser);
    });
  });

  describe("parse", () => {
    it("parses valid JSON text", async () => {
      const schema = makeValidatingSchema((v) => ({
        value: v as Record<string, unknown>,
      }));
      const parser = new StandardSchemaOutputParser(schema);

      const result = await parser.parse('{"name": "Alice", "age": 30}');
      expect(result).toEqual({ name: "Alice", age: 30 });
    });

    it("parses JSON wrapped in markdown code fences", async () => {
      const schema = makeValidatingSchema((v) => ({
        value: v as Record<string, unknown>,
      }));
      const parser = new StandardSchemaOutputParser(schema);

      const result = await parser.parse('```json\n{"name": "Bob"}\n```');
      expect(result).toEqual({ name: "Bob" });
    });

    it("supports async validation", async () => {
      const schema = makeValidatingSchema(async (v) => ({
        value: v as Record<string, unknown>,
      }));
      const parser = new StandardSchemaOutputParser(schema);

      const result = await parser.parse('{"valid": true}');
      expect(result).toEqual({ valid: true });
    });

    it("throws OutputParserException when validation fails with issues", async () => {
      const schema = makeValidatingSchema(() => ({
        issues: [{ message: "name is required", path: [{ key: "name" }] }],
      }));
      const parser = new StandardSchemaOutputParser(schema);

      await expect(parser.parse('{"wrong": "field"}')).rejects.toThrow(
        OutputParserException
      );
    });

    it("throws OutputParserException for invalid JSON", async () => {
      const schema = makeValidatingSchema((v) => ({
        value: v as Record<string, unknown>,
      }));
      const parser = new StandardSchemaOutputParser(schema);

      await expect(parser.parse("not json at all")).rejects.toThrow(
        OutputParserException
      );
    });

    it("includes the original text in the error", async () => {
      const schema = makeValidatingSchema(() => ({
        issues: [{ message: "bad" }],
      }));
      const parser = new StandardSchemaOutputParser(schema);

      try {
        await parser.parse('{"test": true}');
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(OutputParserException);
        expect((e as OutputParserException).llmOutput).toBe('{"test": true}');
      }
    });
  });

  describe("getFormatInstructions", () => {
    it("returns an empty string", () => {
      const schema = makeValidatingSchema((v) => ({
        value: v as Record<string, unknown>,
      }));
      const parser = new StandardSchemaOutputParser(schema);
      expect(parser.getFormatInstructions()).toBe("");
    });
  });
});
