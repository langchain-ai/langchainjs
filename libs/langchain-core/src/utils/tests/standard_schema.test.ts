import { describe, it, expect } from "vitest";
import {
  isStandardSchema,
  isStandardJSONSchema,
  isSerializableSchema,
} from "../standard_schema.js";

const mockValidate = (value: unknown) => ({ value });

const mockJsonSchema = {
  input: () => ({ type: "object", properties: {} }),
  output: () => ({ type: "object", properties: {} }),
};

function makeStandardSchemaOnly() {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "test",
      validate: mockValidate,
    },
  };
}

function makeStandardJSONSchemaOnly() {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "test",
      jsonSchema: mockJsonSchema,
    },
  };
}

function makeSerializableSchema() {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "test",
      validate: mockValidate,
      jsonSchema: mockJsonSchema,
    },
  };
}

describe("isStandardSchema", () => {
  it("returns true for an object with ~standard.validate", () => {
    expect(isStandardSchema(makeStandardSchemaOnly())).toBe(true);
  });

  it("returns true for a serializable schema (has both validate and jsonSchema)", () => {
    expect(isStandardSchema(makeSerializableSchema())).toBe(true);
  });

  it("returns false for an object with only ~standard.jsonSchema", () => {
    expect(isStandardSchema(makeStandardJSONSchemaOnly())).toBe(false);
  });

  it("returns false for a plain object", () => {
    expect(isStandardSchema({ type: "object" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isStandardSchema(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isStandardSchema(undefined)).toBe(false);
  });

  it("returns false for a primitive", () => {
    expect(isStandardSchema("hello")).toBe(false);
    expect(isStandardSchema(42)).toBe(false);
  });

  it("returns false when ~standard is null", () => {
    expect(isStandardSchema({ "~standard": null })).toBe(false);
  });

  it("returns false when ~standard is not an object", () => {
    expect(isStandardSchema({ "~standard": "string" })).toBe(false);
  });
});

describe("isStandardJSONSchema", () => {
  it("returns true for an object with ~standard.jsonSchema", () => {
    expect(isStandardJSONSchema(makeStandardJSONSchemaOnly())).toBe(true);
  });

  it("returns true for a serializable schema (has both validate and jsonSchema)", () => {
    expect(isStandardJSONSchema(makeSerializableSchema())).toBe(true);
  });

  it("returns false for an object with only ~standard.validate", () => {
    expect(isStandardJSONSchema(makeStandardSchemaOnly())).toBe(false);
  });

  it("returns false for a plain object", () => {
    expect(isStandardJSONSchema({ type: "object" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isStandardJSONSchema(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isStandardJSONSchema(undefined)).toBe(false);
  });
});

describe("isSerializableSchema", () => {
  it("returns true when both validate and jsonSchema are present", () => {
    expect(isSerializableSchema(makeSerializableSchema())).toBe(true);
  });

  it("returns false for standard schema without jsonSchema", () => {
    expect(isSerializableSchema(makeStandardSchemaOnly())).toBe(false);
  });

  it("returns false for standard JSON schema without validate", () => {
    expect(isSerializableSchema(makeStandardJSONSchemaOnly())).toBe(false);
  });

  it("returns false for a plain object", () => {
    expect(isSerializableSchema({ type: "object" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSerializableSchema(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isSerializableSchema(undefined)).toBe(false);
  });
});
