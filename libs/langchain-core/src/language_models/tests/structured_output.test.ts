import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import { createContentParser } from "../structured_output.js";
import { StructuredOutputParser } from "../../output_parsers/structured.js";
import { StandardSchemaOutputParser } from "../../output_parsers/standard_schema.js";
import { JsonOutputParser } from "../../output_parsers/json.js";

function makeSerializableSchema() {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "test",
      validate: (value: unknown) => ({
        value: value as Record<string, unknown>,
      }),
      jsonSchema: {
        input: () => ({ type: "object", properties: {} }),
        output: () => ({ type: "object", properties: {} }),
      },
    },
  };
}

describe("createContentParser", () => {
  it("returns StructuredOutputParser for a Zod v3 schema", () => {
    const schema = z.object({ name: z.string() });
    const parser = createContentParser(schema);
    expect(parser).toBeInstanceOf(StructuredOutputParser);
  });

  it("returns StructuredOutputParser for a Zod v4 schema", () => {
    const schema = z4.object({ name: z4.string() });
    const parser = createContentParser(schema);
    expect(parser).toBeInstanceOf(StructuredOutputParser);
  });

  it("returns StandardSchemaOutputParser for a serializable schema", () => {
    const parser = createContentParser(makeSerializableSchema());
    expect(parser).toBeInstanceOf(StandardSchemaOutputParser);
  });

  it("returns JsonOutputParser for a plain JSON schema object", () => {
    const parser = createContentParser({
      type: "object",
      properties: { name: { type: "string" } },
    });
    expect(parser).toBeInstanceOf(JsonOutputParser);
  });
});
