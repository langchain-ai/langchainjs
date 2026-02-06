import { describe, it, expect } from "vitest";
import {
  groqStrictifySchema,
  getGroqStructuredOutputMethod,
  SUPPORTED_STRUCTURED_OUTPUT_METHODS,
} from "../utils/groq-schema.js";

describe("groqStrictifySchema", () => {
  it("should set additionalProperties to false on objects", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    };

    const result = groqStrictifySchema(schema);

    expect(result.additionalProperties).toBe(false);
  });

  it("should make all properties required", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
        city: { type: "string" },
      },
      required: ["name"],
    };

    const result = groqStrictifySchema(schema);

    expect(result.required).toEqual(["name", "age", "city"]);
  });

  it("should make optional properties nullable", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    };

    const result = groqStrictifySchema(schema);

    // name was required, should remain as-is
    expect(result.properties.name.type).toBe("string");

    // age was optional, should become nullable
    expect(result.properties.age.type).toContain("null");
    expect(result.properties.age.type).toContain("number");
  });

  it("should handle enum properties that become nullable", () => {
    const schema = {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "inactive"],
        },
      },
      required: [],
    };

    const result = groqStrictifySchema(schema);

    expect(result.properties.status.enum).toContain(null);
    expect(result.properties.status.enum).toContain("active");
    expect(result.properties.status.enum).toContain("inactive");
  });

  it("should recursively process nested objects", () => {
    const schema = {
      type: "object",
      properties: {
        person: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
          },
          required: ["name"],
        },
      },
      required: ["person"],
    };

    const result = groqStrictifySchema(schema);

    // Nested object should also have additionalProperties: false
    expect(result.properties.person.additionalProperties).toBe(false);

    // Nested object should have all props required
    expect(result.properties.person.required).toEqual(["name", "email"]);

    // email was optional in nested, should be nullable
    expect(result.properties.person.properties.email.type).toContain("null");
  });

  it("should recursively process array items", () => {
    const schema = {
      type: "object",
      properties: {
        people: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "number" },
            },
            required: ["name"],
          },
        },
      },
      required: ["people"],
    };

    const result = groqStrictifySchema(schema);

    const itemSchema = result.properties.people.items;
    expect(itemSchema.additionalProperties).toBe(false);
    expect(itemSchema.required).toEqual(["name", "age"]);
    expect(itemSchema.properties.age.type).toContain("null");
  });

  it("should remove anyOf/oneOf/not at root level", () => {
    const schema = {
      anyOf: [
        { type: "object", properties: { name: { type: "string" } } },
        { type: "null" },
      ],
    };

    const result = groqStrictifySchema(schema);

    expect(result.anyOf).toBeUndefined();
    expect(result.type).toBe("object");
  });

  it("should handle $defs references", () => {
    const schema = {
      type: "object",
      properties: {
        user: { $ref: "#/$defs/User" },
      },
      required: ["user"],
      $defs: {
        User: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
          },
          required: ["name"],
        },
      },
    };

    const result = groqStrictifySchema(schema);

    expect(result.$defs.User.additionalProperties).toBe(false);
    expect(result.$defs.User.required).toEqual(["name", "email"]);
  });

  it("should throw when root anyOf has no object variant", () => {
    const schema = {
      anyOf: [
        { type: "string" },
        { type: "number" },
      ],
    };

    expect(() => groqStrictifySchema(schema)).toThrow(
      /root schema to be an object type/
    );
  });

  it("should throw when root has oneOf", () => {
    const schema = {
      oneOf: [
        { type: "object", properties: { a: { type: "string" } } },
        { type: "object", properties: { b: { type: "number" } } },
      ],
    };

    expect(() => groqStrictifySchema(schema)).toThrow(
      /does not support oneOf at the root/
    );
  });

  it("should throw when root has not", () => {
    const schema = {
      not: { type: "null" },
    };

    expect(() => groqStrictifySchema(schema)).toThrow(
      /does not support 'not' at the root/
    );
  });

  it("should return $ref schemas unchanged in makeNullable", () => {
    const schema = {
      type: "object",
      properties: {
        ref: { $ref: "#/$defs/Thing" },
      },
      required: [],
    };

    const result = groqStrictifySchema(schema);

    // $ref property was optional, but since it has no type/properties/enum/anyOf,
    // it should be returned unchanged (not assumed to be string)
    expect(result.properties.ref).toEqual({ $ref: "#/$defs/Thing" });
    expect(result.properties.ref.type).toBeUndefined();
  });

  it("should handle already nullable types", () => {
    const schema = {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
      },
      required: [],
    };

    const result = groqStrictifySchema(schema);

    // Should not duplicate null
    const types = result.properties.name.type;
    const nullCount = types.filter((t: string) => t === "null").length;
    expect(nullCount).toBe(1);
  });
});

describe("getGroqStructuredOutputMethod", () => {
  it("should return jsonSchema for gpt-oss-20b by default", () => {
    const method = getGroqStructuredOutputMethod("openai/gpt-oss-20b");
    expect(method).toBe("jsonSchema");
  });

  it("should return jsonSchema for gpt-oss-120b by default", () => {
    const method = getGroqStructuredOutputMethod("openai/gpt-oss-120b");
    expect(method).toBe("jsonSchema");
  });

  it("should return functionCalling for other models by default", () => {
    const method = getGroqStructuredOutputMethod("llama-3.3-70b-versatile");
    expect(method).toBe("functionCalling");
  });

  it("should respect explicit method override", () => {
    const method = getGroqStructuredOutputMethod(
      "openai/gpt-oss-120b",
      "functionCalling"
    );
    expect(method).toBe("functionCalling");
  });

  it("should throw for invalid method", () => {
    expect(() => {
      getGroqStructuredOutputMethod("openai/gpt-oss-120b", "invalidMethod");
    }).toThrow(/Invalid structured output method/);
  });

  it("should throw when jsonSchema requested for unsupported model", () => {
    expect(() => {
      getGroqStructuredOutputMethod("llama-3.3-70b-versatile", "jsonSchema");
    }).toThrow(/not supported for model/);
  });

  it("should return jsonSchema for new gpt-oss models via prefix matching", () => {
    const method = getGroqStructuredOutputMethod("openai/gpt-oss-256b");
    expect(method).toBe("jsonSchema");
  });

  it("should allow jsonMode for any model", () => {
    const method = getGroqStructuredOutputMethod(
      "llama-3.3-70b-versatile",
      "jsonMode"
    );
    expect(method).toBe("jsonMode");
  });

  it("should export supported methods constant", () => {
    expect(SUPPORTED_STRUCTURED_OUTPUT_METHODS).toContain("jsonSchema");
    expect(SUPPORTED_STRUCTURED_OUTPUT_METHODS).toContain("functionCalling");
    expect(SUPPORTED_STRUCTURED_OUTPUT_METHODS).toContain("jsonMode");
  });
});
