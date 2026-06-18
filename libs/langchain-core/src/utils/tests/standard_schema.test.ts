import { describe, it, expect } from "vitest";
import {
  isStandardSchema,
  isStandardJsonSchema,
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

function makeStandardJsonSchemaOnly() {
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

// Simulates callable schema libraries like ArkType where typeof === "function"
function makeCallableStandardSchema() {
  const fn = (value: unknown) => value;
  Object.defineProperty(fn, "~standard", {
    value: {
      version: 1 as const,
      vendor: "test-callable",
      validate: mockValidate,
    },
    enumerable: true,
  });
  return fn;
}

function makeCallableJsonSchema() {
  const fn = (value: unknown) => value;
  Object.defineProperty(fn, "~standard", {
    value: {
      version: 1 as const,
      vendor: "test-callable",
      jsonSchema: mockJsonSchema,
    },
    enumerable: true,
  });
  return fn;
}

function makeCallableSerializableSchema() {
  const fn = (value: unknown) => value;
  Object.defineProperty(fn, "~standard", {
    value: {
      version: 1 as const,
      vendor: "test-callable",
      validate: mockValidate,
      jsonSchema: mockJsonSchema,
    },
    enumerable: true,
  });
  return fn;
}

describe("isStandardSchema", () => {
  it("returns true for an object with ~standard.validate", () => {
    expect(isStandardSchema(makeStandardSchemaOnly())).toBe(true);
  });

  it("returns true for a serializable schema (has both validate and jsonSchema)", () => {
    expect(isStandardSchema(makeSerializableSchema())).toBe(true);
  });

  it("returns false for an object with only ~standard.jsonSchema", () => {
    expect(isStandardSchema(makeStandardJsonSchemaOnly())).toBe(false);
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

  it("returns true for a callable (function) schema with ~standard.validate", () => {
    expect(isStandardSchema(makeCallableStandardSchema())).toBe(true);
  });

  it("returns true for a callable serializable schema", () => {
    expect(isStandardSchema(makeCallableSerializableSchema())).toBe(true);
  });
});

describe("isStandardJsonSchema", () => {
  it("returns true for an object with ~standard.jsonSchema", () => {
    expect(isStandardJsonSchema(makeStandardJsonSchemaOnly())).toBe(true);
  });

  it("returns true for a serializable schema (has both validate and jsonSchema)", () => {
    expect(isStandardJsonSchema(makeSerializableSchema())).toBe(true);
  });

  it("returns false for an object with only ~standard.validate", () => {
    expect(isStandardJsonSchema(makeStandardSchemaOnly())).toBe(false);
  });

  it("returns false for a plain object", () => {
    expect(isStandardJsonSchema({ type: "object" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(isStandardJsonSchema(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isStandardJsonSchema(undefined)).toBe(false);
  });

  it("returns false for a primitive", () => {
    expect(isStandardJsonSchema("hello")).toBe(false);
    expect(isStandardJsonSchema(42)).toBe(false);
  });

  it("returns true for a callable (function) schema with ~standard.jsonSchema", () => {
    expect(isStandardJsonSchema(makeCallableJsonSchema())).toBe(true);
  });

  it("returns true for a callable serializable schema", () => {
    expect(isStandardJsonSchema(makeCallableSerializableSchema())).toBe(true);
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
    expect(isSerializableSchema(makeStandardJsonSchemaOnly())).toBe(false);
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

  it("returns false for a primitive", () => {
    expect(isSerializableSchema("hello")).toBe(false);
    expect(isSerializableSchema(42)).toBe(false);
  });

  it("returns true for a callable (function) schema with both validate and jsonSchema", () => {
    expect(isSerializableSchema(makeCallableSerializableSchema())).toBe(true);
  });

  it("returns false for a callable schema with only validate", () => {
    expect(isSerializableSchema(makeCallableStandardSchema())).toBe(false);
  });

  it("returns false for a callable schema with only jsonSchema", () => {
    expect(isSerializableSchema(makeCallableJsonSchema())).toBe(false);
  });
});
