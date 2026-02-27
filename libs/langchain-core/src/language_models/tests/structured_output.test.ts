import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import { z as z4 } from "zod/v4";
import {
  createContentParser,
  createFunctionCallingParser,
} from "../structured_output.js";
import { StructuredOutputParser } from "../../output_parsers/structured.js";
import { StandardSchemaOutputParser } from "../../output_parsers/standard_schema.js";
import { JsonOutputParser } from "../../output_parsers/json.js";
import { JsonOutputKeyToolsParser } from "../../output_parsers/openai_tools/json_output_tools_parsers.js";
import { BaseLLMOutputParser } from "../../output_parsers/base.js";

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

describe("createFunctionCallingParser", () => {
  it("returns JsonOutputKeyToolsParser with zodSchema for a Zod v3 schema", () => {
    const schema = z.object({ name: z.string() });
    const parser = createFunctionCallingParser(schema, "extract");
    expect(parser).toBeInstanceOf(JsonOutputKeyToolsParser);
    expect((parser as JsonOutputKeyToolsParser).keyName).toBe("extract");
    expect((parser as JsonOutputKeyToolsParser).zodSchema).toBeDefined();
  });

  it("returns JsonOutputKeyToolsParser with zodSchema for a Zod v4 schema", () => {
    const schema = z4.object({ name: z4.string() });
    const parser = createFunctionCallingParser(schema, "extract");
    expect(parser).toBeInstanceOf(JsonOutputKeyToolsParser);
    expect((parser as JsonOutputKeyToolsParser).zodSchema).toBeDefined();
  });

  it("returns JsonOutputKeyToolsParser with serializableSchema for a serializable schema", () => {
    const parser = createFunctionCallingParser(
      makeSerializableSchema(),
      "extract"
    );
    expect(parser).toBeInstanceOf(JsonOutputKeyToolsParser);
    expect(
      (parser as JsonOutputKeyToolsParser).serializableSchema
    ).toBeDefined();
    expect((parser as JsonOutputKeyToolsParser).zodSchema).toBeUndefined();
  });

  it("returns JsonOutputKeyToolsParser with no schema for a plain JSON schema", () => {
    const parser = createFunctionCallingParser(
      { type: "object", properties: { name: { type: "string" } } },
      "extract"
    );
    expect(parser).toBeInstanceOf(JsonOutputKeyToolsParser);
    expect((parser as JsonOutputKeyToolsParser).zodSchema).toBeUndefined();
    expect(
      (parser as JsonOutputKeyToolsParser).serializableSchema
    ).toBeUndefined();
  });

  it("uses the provided keyName", () => {
    const schema = z.object({ name: z.string() });
    const parser = createFunctionCallingParser(schema, "MyFunction");
    expect((parser as JsonOutputKeyToolsParser).keyName).toBe("MyFunction");
  });

  it("uses a custom parser class when provided", () => {
    class CustomParser extends BaseLLMOutputParser<Record<string, unknown>> {
      lc_namespace = ["test"];

      keyName: string;

      zodSchema?: unknown;

      serializableSchema?: unknown;

      constructor(params: {
        keyName: string;
        returnSingle?: boolean;
        zodSchema?: unknown;
        serializableSchema?: unknown;
      }) {
        super();
        this.keyName = params.keyName;
        this.zodSchema = params.zodSchema;
        this.serializableSchema = params.serializableSchema;
      }

      async parseResult() {
        return {};
      }
    }

    const schema = makeSerializableSchema();
    const parser = createFunctionCallingParser(schema, "extract", CustomParser);
    expect(parser).toBeInstanceOf(CustomParser);
    expect((parser as CustomParser).serializableSchema).toBeDefined();
  });
});
