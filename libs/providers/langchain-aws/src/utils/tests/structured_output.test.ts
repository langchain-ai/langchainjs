import { describe, expect, test } from "vitest";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import {
  convertToConverseOutputConfig,
  throwIfOutputIncomplete,
  toolsFromMessageHistory,
} from "../structured_output.js";

const convertedSchema = (schema: object) => {
  const { textFormat } = convertToConverseOutputConfig("extract", schema);
  const structure = textFormat?.structure;
  if (!structure || !("jsonSchema" in structure) || !structure.jsonSchema) {
    throw new Error("Expected a JSON schema structure");
  }
  return JSON.parse(structure.jsonSchema.schema ?? "");
};

describe("convertToConverseOutputConfig", () => {
  test("sends the name and the schema as a JSON string", () => {
    const schema = { type: "string" };

    expect(convertToConverseOutputConfig("answer", schema)).toEqual({
      textFormat: {
        type: "json_schema",
        structure: {
          jsonSchema: { name: "answer", schema: JSON.stringify(schema) },
        },
      },
    });
  });

  test("sends the description next to the schema", () => {
    const { textFormat } = convertToConverseOutputConfig(
      "answer",
      { type: "string" },
      "The final answer"
    );

    expect(textFormat?.structure).toHaveProperty(
      "jsonSchema.description",
      "The final answer"
    );
  });

  test("closes an object that has properties and no type", () => {
    const schema = convertedSchema({
      properties: { owner: { properties: {} } },
      required: ["owner"],
    });

    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.owner.additionalProperties).toBe(false);
  });

  test("leaves a branch that only lists required properties open", () => {
    const schema = convertedSchema({
      type: "object",
      properties: { a: { type: "string" }, b: { type: "string" } },
      anyOf: [{ required: ["a"] }, { required: ["b"] }],
    });

    expect(schema.anyOf).toEqual([{ required: ["a"] }, { required: ["b"] }]);
  });

  test("closes every object, including nested and referenced ones", () => {
    const schema = convertedSchema({
      type: "object",
      properties: {
        owner: { type: "object", properties: {} },
        items: {
          type: "array",
          items: { type: "object", properties: {} },
        },
        choice: { anyOf: [{ type: "object", properties: {} }] },
        linked: { $ref: "#/$defs/linked" },
        nullable: { type: ["object", "null"], properties: {} },
      },
      $defs: { linked: { type: "object", properties: {} } },
      definitions: { legacy: { type: "object", properties: {} } },
    });

    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.owner.additionalProperties).toBe(false);
    expect(schema.properties.items.items.additionalProperties).toBe(false);
    expect(schema.properties.choice.anyOf[0].additionalProperties).toBe(false);
    expect(schema.properties.nullable.additionalProperties).toBe(false);
    expect(schema.$defs.linked.additionalProperties).toBe(false);
    expect(schema.definitions.legacy.additionalProperties).toBe(false);
  });

  test("keeps a property named like an unsupported keyword inside definitions", () => {
    const schema = convertedSchema({
      type: "object",
      definitions: { minimum: { type: "number" } },
    });

    expect(schema.definitions).toEqual({ minimum: { type: "number" } });
  });

  test("closes an object that allows any extra property", () => {
    const schema = convertedSchema({
      type: "object",
      properties: {},
      additionalProperties: true,
    });

    expect(schema.additionalProperties).toBe(false);
  });

  test("keeps a schema-valued additionalProperties for Bedrock to reject", () => {
    const schema = convertedSchema({
      type: "object",
      additionalProperties: { type: "string" },
    });

    expect(schema.additionalProperties).toEqual({ type: "string" });
  });

  test("removes the constraints Bedrock rejects", () => {
    const schema = convertedSchema({
      type: "object",
      properties: {
        rating: {
          type: "number",
          minimum: 1,
          maximum: 10,
          exclusiveMinimum: 0,
          exclusiveMaximum: 11,
          multipleOf: 2,
        },
        label: { type: "string", minLength: 1, maxLength: 5 },
        tags: { type: "array", items: { type: "string" }, maxItems: 3 },
      },
    });

    expect(schema.properties).toEqual({
      rating: { type: "number" },
      label: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    });
  });

  test("keeps minItems only for the values Bedrock accepts", () => {
    const schema = convertedSchema({
      type: "object",
      properties: {
        none: { type: "array", minItems: 0 },
        one: { type: "array", minItems: 1 },
        two: { type: "array", minItems: 2 },
      },
    });

    expect(schema.properties.none.minItems).toBe(0);
    expect(schema.properties.one.minItems).toBe(1);
    expect(schema.properties.two).not.toHaveProperty("minItems");
  });

  test("keeps a property whose name matches an unsupported keyword", () => {
    const schema = convertedSchema({
      type: "object",
      properties: {
        minimum: { type: "number" },
        maxLength: { type: "number" },
      },
      required: ["minimum", "maxLength"],
    });

    expect(schema.properties).toEqual({
      minimum: { type: "number" },
      maxLength: { type: "number" },
    });
    expect(schema.required).toEqual(["minimum", "maxLength"]);
  });

  test("leaves literal values untouched", () => {
    const literal = { type: "object", minimum: 1 };
    const schema = convertedSchema({
      type: "object",
      properties: {
        fixed: { const: literal },
        fallback: { type: "object", default: literal },
        choice: { enum: [literal] },
        sample: { type: "object", examples: [literal] },
      },
    });

    expect(schema.properties.fixed.const).toEqual(literal);
    expect(schema.properties.fallback.default).toEqual(literal);
    expect(schema.properties.choice.enum).toEqual([literal]);
    expect(schema.properties.sample.examples).toEqual([literal]);
  });
});

describe("toolsFromMessageHistory", () => {
  test("declares each called tool once", () => {
    const toolCall = (id: string) => ({
      id,
      name: "search",
      args: {},
      type: "tool_call" as const,
    });
    const tools = toolsFromMessageHistory([
      new HumanMessage("Hello"),
      new AIMessage({
        content: "",
        tool_calls: [toolCall("1"), toolCall("2")],
      }),
      new ToolMessage({ content: "Found", tool_call_id: "1" }),
      new ToolMessage({ content: "Found", tool_call_id: "2" }),
    ]);

    expect(tools.map((tool) => tool.toolSpec?.name)).toEqual(["search"]);
  });

  test("declares nothing for a history without tool calls", () => {
    const tools = toolsFromMessageHistory([
      new HumanMessage("Hello"),
      new AIMessage("Hi"),
    ]);

    expect(tools).toEqual([]);
  });
});

describe("throwIfOutputIncomplete", () => {
  test.each([
    ["content_filtered", "refused"],
    ["max_tokens", "token limit"],
  ])("throws on %s in a Converse response", (stopReason, error) => {
    const message = new AIMessage({
      content: "",
      response_metadata: { stopReason },
    });

    expect(() => throwIfOutputIncomplete(message)).toThrow(error);
  });

  test.each([
    ["content_filtered", "refused"],
    ["max_tokens", "token limit"],
  ])("throws on %s in a ConverseStream response", (stopReason, error) => {
    const message = new AIMessage({
      content: "",
      response_metadata: { messageStop: { stopReason } },
    });

    expect(() => throwIfOutputIncomplete(message)).toThrow(error);
  });

  test("accepts any other stop reason", () => {
    const message = new AIMessage({
      content: "{}",
      response_metadata: { stopReason: "end_turn" },
    });

    expect(() => throwIfOutputIncomplete(message)).not.toThrow();
  });
});
