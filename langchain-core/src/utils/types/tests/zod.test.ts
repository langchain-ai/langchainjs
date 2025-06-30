/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from "@jest/globals";
import * as z3 from "zod/v3";
import * as z4 from "zod/v4";
import {
  isZodSchemaV3,
  isZodSchemaV4,
  isShapelessZodSchema,
  isSimpleStringZodSchema,
  isInteropZodSchema,
  interopParseAsync,
  interopSafeParse,
  interopParse,
  getSchemaDescription,
  isInteropZodObject,
  getInteropZodObjectShape,
  extendInteropZodObject,
  interopZodObjectPartial,
  interopZodObjectPassthrough,
  getInteropZodDefaultGetter,
  interopZodObjectStrict,
  ZodObjectV4,
  interopZodTransformInputSchema,
} from "../zod.js";

describe("Zod utility functions", () => {
  describe("isZodSchemaV3", () => {
    it("should return true for v3 schemas", () => {
      expect(isZodSchemaV3(z3.string())).toBe(true);
      expect(isZodSchemaV3(z3.number())).toBe(true);
      expect(isZodSchemaV3(z3.object({ name: z3.string() }))).toBe(true);
      expect(isZodSchemaV3(z3.array(z3.string()))).toBe(true);
      expect(isZodSchemaV3(z3.string().optional())).toBe(true);
      expect(isZodSchemaV3(z3.string().default("test"))).toBe(true);
      expect(isZodSchemaV3(z3.string().transform((s) => s.toUpperCase()))).toBe(
        true
      );
    });

    it("should return false for v4 schemas", () => {
      expect(isZodSchemaV3(z4.string())).toBe(false);
      expect(isZodSchemaV3(z4.number())).toBe(false);
      expect(isZodSchemaV3(z4.object({ name: z4.string() }))).toBe(false);
    });

    it("should return false for non-schema values", () => {
      expect(isZodSchemaV3(null)).toBe(false);
      expect(isZodSchemaV3(undefined)).toBe(false);
      expect(isZodSchemaV3({})).toBe(false);
      expect(isZodSchemaV3({ _def: "fake" })).toBe(false);
      expect(isZodSchemaV3("string")).toBe(false);
      expect(isZodSchemaV3(123)).toBe(false);
      expect(isZodSchemaV3([])).toBe(false);
      expect(isZodSchemaV3({ _zod: "fake" })).toBe(false);
    });
  });

  describe("isZodSchemaV4", () => {
    it("should return true for v4 schemas", () => {
      expect(isZodSchemaV4(z4.string())).toBe(true);
      expect(isZodSchemaV4(z4.number())).toBe(true);
      expect(isZodSchemaV4(z4.object({ name: z4.string() }))).toBe(true);
      expect(isZodSchemaV4(z4.array(z4.string()))).toBe(true);
      expect(isZodSchemaV4(z4.string().optional())).toBe(true);
      expect(isZodSchemaV4(z4.string().default("test"))).toBe(true);
      expect(isZodSchemaV4(z4.string().transform((s) => s.toUpperCase()))).toBe(
        true
      );
    });

    it("should return false for v3 schemas", () => {
      expect(isZodSchemaV4(z3.string())).toBe(false);
      expect(isZodSchemaV4(z3.number())).toBe(false);
      expect(isZodSchemaV4(z3.object({ name: z3.string() }))).toBe(false);
    });

    it("should return false for non-schema values", () => {
      expect(isZodSchemaV4(null)).toBe(false);
      expect(isZodSchemaV4(undefined)).toBe(false);
      expect(isZodSchemaV4({})).toBe(false);
      expect(isZodSchemaV4({ _zod: "fake" })).toBe(false);
      expect(isZodSchemaV4("string")).toBe(false);
      expect(isZodSchemaV4(123)).toBe(false);
      expect(isZodSchemaV4([])).toBe(false);
      expect(isZodSchemaV4({ _def: "fake" })).toBe(false);
    });
  });

  describe("isInteropZodSchema", () => {
    it("should return true for v3 schemas", () => {
      expect(isInteropZodSchema(z3.string())).toBe(true);
      expect(isInteropZodSchema(z3.number())).toBe(true);
      expect(isInteropZodSchema(z3.object({ name: z3.string() }))).toBe(true);
      expect(isInteropZodSchema(z3.array(z3.string()))).toBe(true);
      expect(isInteropZodSchema(z3.string().optional())).toBe(true);
      expect(isInteropZodSchema(z3.string().default("test"))).toBe(true);
      expect(
        isInteropZodSchema(z3.string().transform((s) => s.toUpperCase()))
      ).toBe(true);
    });

    it("should return true for v4 schemas", () => {
      expect(isInteropZodSchema(z4.string())).toBe(true);
      expect(isInteropZodSchema(z4.number())).toBe(true);
      expect(isInteropZodSchema(z4.object({ name: z4.string() }))).toBe(true);
      expect(isInteropZodSchema(z4.array(z4.string()))).toBe(true);
      expect(isInteropZodSchema(z4.string().optional())).toBe(true);
      expect(isInteropZodSchema(z4.string().default("test"))).toBe(true);
      expect(
        isInteropZodSchema(z4.string().transform((s) => s.toUpperCase()))
      ).toBe(true);
    });

    it("should return false for non-object values", () => {
      expect(isInteropZodSchema("string")).toBe(false);
      expect(isInteropZodSchema(123)).toBe(false);
      expect(isInteropZodSchema(true)).toBe(false);
      expect(isInteropZodSchema(Symbol("test"))).toBe(false);
    });
  });

  describe("interopParseAsync", () => {
    describe("v3 schemas", () => {
      it("should successfully parse valid input", async () => {
        const schema = z3.string();
        const result = await interopParseAsync(schema, "test");
        expect(result).toBe("test");
      });

      it("should throw error for invalid input", async () => {
        const schema = z3.string();
        await expect(interopParseAsync(schema, 123)).rejects.toThrow();
      });

      it("should handle object schemas", async () => {
        const schema = z3.object({
          name: z3.string(),
          age: z3.number(),
        });
        const input = { name: "John", age: 30 };
        const result = await interopParseAsync(schema, input);
        expect(result).toEqual(input);
      });
    });

    describe("v4 schemas", () => {
      it("should successfully parse valid input", async () => {
        const schema = z4.string();
        const result = await interopParseAsync(schema, "test");
        expect(result).toBe("test");
      });

      it("should throw error for invalid input", async () => {
        const schema = z4.string();
        await expect(interopParseAsync(schema, 123)).rejects.toThrow();
      });

      it("should handle object schemas", async () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const input = { name: "John", age: 30 };
        const result = await interopParseAsync(schema, input);
        expect(result).toEqual(input);
      });
    });
  });

  describe("interopSafeParse", () => {
    describe("v3 schemas", () => {
      it("should return success for valid input", () => {
        const schema = z3.string();
        const result = interopSafeParse(schema, "test");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("test");
        }
      });

      it("should return error for invalid input", () => {
        const schema = z3.string();
        const result = interopSafeParse(schema, 123);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });

      it("should handle object schemas", () => {
        const schema = z3.object({
          name: z3.string(),
          age: z3.number(),
        });
        const input = { name: "John", age: 30 };
        const result = interopSafeParse(schema, input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(input);
        }
      });

      it("should handle partial validation failures", () => {
        const schema = z3.object({
          name: z3.string(),
          age: z3.number(),
        });
        const input = { name: "John", age: "30" }; // age should be number
        const result = interopSafeParse(schema, input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });

    describe("v4 schemas", () => {
      it("should return success for valid input", () => {
        const schema = z4.string();
        const result = interopSafeParse(schema, "test");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("test");
        }
      });

      it("should return error for invalid input", () => {
        const schema = z4.string();
        const result = interopSafeParse(schema, 123);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });

      it("should handle object schemas", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const input = { name: "John", age: 30 };
        const result = interopSafeParse(schema, input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(input);
        }
      });

      it("should handle partial validation failures", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const input = { name: "John", age: "30" }; // age should be number
        const result = interopSafeParse(schema, input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      });
    });
  });

  describe("interopParse", () => {
    describe("v3 schemas", () => {
      it("should successfully parse valid input", () => {
        const schema = z3.string();
        const result = interopParse(schema, "test");
        expect(result).toBe("test");
      });

      it("should throw error for invalid input", () => {
        const schema = z3.string();
        expect(() => interopParse(schema, 123)).toThrow();
      });

      it("should handle object schemas", () => {
        const schema = z3.object({
          name: z3.string(),
          age: z3.number(),
        });
        const input = { name: "John", age: 30 };
        const result = interopParse(schema, input);
        expect(result).toEqual(input);
      });

      it("should throw error for partial validation failures", () => {
        const schema = z3.object({
          name: z3.string(),
          age: z3.number(),
        });
        const input = { name: "John", age: "30" }; // age should be number
        expect(() => interopParse(schema, input)).toThrow();
      });
    });

    describe("v4 schemas", () => {
      it("should successfully parse valid input", () => {
        const schema = z4.string();
        const result = interopParse(schema, "test");
        expect(result).toBe("test");
      });

      it("should throw error for invalid input", () => {
        const schema = z4.string();
        expect(() => interopParse(schema, 123)).toThrow();
      });

      it("should handle object schemas", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const input = { name: "John", age: 30 };
        const result = interopParse(schema, input);
        expect(result).toEqual(input);
      });

      it("should throw error for partial validation failures", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const input = { name: "John", age: "30" }; // age should be number
        expect(() => interopParse(schema, input)).toThrow();
      });
    });
  });

  describe("getSchemaDescription", () => {
    describe("v3 schemas", () => {
      it("should return description for schema with description", () => {
        const schema = z3.string().describe("A test string");
        expect(getSchemaDescription(schema)).toBe("A test string");
      });

      it("should return undefined for schema without description", () => {
        const schema = z3.string();
        expect(getSchemaDescription(schema)).toBeUndefined();
      });
    });

    describe("v4 schemas", () => {
      it("should return description for schema with description", () => {
        const schema = z4.string().describe("A test string");
        expect(getSchemaDescription(schema)).toBe("A test string");
      });

      it("should return undefined for schema without description", () => {
        const schema = z4.string();
        expect(getSchemaDescription(schema)).toBeUndefined();
      });
    });

    describe("plain objects", () => {
      it("should return description for object with string description", () => {
        const obj = { description: "A test object" };
        expect(getSchemaDescription(obj)).toBe("A test object");
      });

      it("should return undefined for object without description", () => {
        const obj = { name: "test" };
        expect(getSchemaDescription(obj)).toBeUndefined();
      });
    });
  });

  describe("isShapelessZodSchema", () => {
    it("should return true for shapeless v3 schemas", () => {
      expect(isShapelessZodSchema(z3.string())).toBe(true);
      expect(isShapelessZodSchema(z3.number())).toBe(true);
      expect(isShapelessZodSchema(z3.boolean())).toBe(true);
      expect(isShapelessZodSchema(z3.date())).toBe(true);
      expect(isShapelessZodSchema(z3.any())).toBe(true);
      expect(isShapelessZodSchema(z3.unknown())).toBe(true);
      expect(isShapelessZodSchema(z3.null())).toBe(true);
      expect(isShapelessZodSchema(z3.undefined())).toBe(true);
      expect(isShapelessZodSchema(z3.void())).toBe(true);
      expect(isShapelessZodSchema(z3.string().optional())).toBe(true);
      expect(isShapelessZodSchema(z3.string().nullable())).toBe(true);
      expect(isShapelessZodSchema(z3.string().default("test"))).toBe(true);
      expect(
        isShapelessZodSchema(z3.string().transform((s) => s.toUpperCase()))
      ).toBe(true);
      expect(isShapelessZodSchema(z3.array(z3.string()))).toBe(true);
      expect(isShapelessZodSchema(z3.tuple([z3.string(), z3.number()]))).toBe(
        true
      );
      expect(isShapelessZodSchema(z3.union([z3.string(), z3.number()]))).toBe(
        true
      );
      expect(isShapelessZodSchema(z3.literal("test"))).toBe(true);
      expect(isShapelessZodSchema(z3.enum(["a", "b", "c"]))).toBe(true);
      // Empty objects and records are shapeless
      expect(isShapelessZodSchema(z3.object({}))).toBe(true);
      expect(isShapelessZodSchema(z3.record(z3.string()))).toBe(true);
    });

    it("should return true for shapeless v4 schemas", () => {
      expect(isShapelessZodSchema(z4.string())).toBe(true);
      expect(isShapelessZodSchema(z4.number())).toBe(true);
      expect(isShapelessZodSchema(z4.boolean())).toBe(true);
      expect(isShapelessZodSchema(z4.date())).toBe(true);
      expect(isShapelessZodSchema(z4.any())).toBe(true);
      expect(isShapelessZodSchema(z4.unknown())).toBe(true);
      expect(isShapelessZodSchema(z4.null())).toBe(true);
      expect(isShapelessZodSchema(z4.undefined())).toBe(true);
      expect(isShapelessZodSchema(z4.void())).toBe(true);
      expect(isShapelessZodSchema(z4.string().optional())).toBe(true);
      expect(isShapelessZodSchema(z4.string().nullable())).toBe(true);
      expect(isShapelessZodSchema(z4.string().default("test"))).toBe(true);
      expect(
        isShapelessZodSchema(z4.string().transform((s) => s.toUpperCase()))
      ).toBe(true);
      expect(isShapelessZodSchema(z4.array(z4.string()))).toBe(true);
      expect(isShapelessZodSchema(z4.tuple([z4.string(), z4.number()]))).toBe(
        true
      );
      expect(isShapelessZodSchema(z4.union([z4.string(), z4.number()]))).toBe(
        true
      );
      expect(isShapelessZodSchema(z4.literal("test"))).toBe(true);
      expect(isShapelessZodSchema(z4.enum(["a", "b", "c"]))).toBe(true);
      // Empty objects and records are shapeless
      expect(isShapelessZodSchema(z4.object({}))).toBe(true);
      expect(isShapelessZodSchema(z4.record(z4.string(), z4.string()))).toBe(
        true
      );
    });

    it("should return false for schemas with shape (v3)", () => {
      expect(isShapelessZodSchema(z3.object({ name: z3.string() }))).toBe(
        false
      );
      expect(
        isShapelessZodSchema(z3.object({ name: z3.string(), age: z3.number() }))
      ).toBe(false);
    });

    it("should return false for schemas with shape (v4)", () => {
      expect(isShapelessZodSchema(z4.object({ name: z4.string() }))).toBe(
        false
      );
      expect(
        isShapelessZodSchema(z4.object({ name: z4.string(), age: z4.number() }))
      ).toBe(false);
    });

    it("should return false for non-schema values", () => {
      expect(isShapelessZodSchema(null)).toBe(false);
      expect(isShapelessZodSchema(undefined)).toBe(false);
      expect(isShapelessZodSchema({})).toBe(false);
      expect(isShapelessZodSchema("string")).toBe(false);
      expect(isShapelessZodSchema(123)).toBe(false);
      expect(isShapelessZodSchema([])).toBe(false);
    });
  });

  describe("isSimpleStringZodSchema", () => {
    describe("v3 schemas", () => {
      it("should return true for basic string schemas", () => {
        expect(isSimpleStringZodSchema(z3.string())).toBe(true);
        expect(isSimpleStringZodSchema(z3.string().min(1))).toBe(true);
        expect(isSimpleStringZodSchema(z3.string().max(10))).toBe(true);
        expect(isSimpleStringZodSchema(z3.string().email())).toBe(true);
        expect(isSimpleStringZodSchema(z3.string().url())).toBe(true);
        expect(isSimpleStringZodSchema(z3.string().uuid())).toBe(true);
        expect(isSimpleStringZodSchema(z3.string().regex(/test/))).toBe(true);
      });

      it("should return false for string schemas with defaults", () => {
        expect(isSimpleStringZodSchema(z3.string().default("test"))).toBe(
          false
        );
        expect(
          isSimpleStringZodSchema(z3.string().min(1).default("test"))
        ).toBe(false);
      });

      it("should return false for string transforms (input/output types may differ)", () => {
        const stringTransform = z3.string().transform((s) => s.toUpperCase());
        expect(isSimpleStringZodSchema(stringTransform)).toBe(false);

        const objectToStringTransform = z3
          .object({ value: z3.string() })
          .transform((obj) => obj.value);
        expect(isSimpleStringZodSchema(objectToStringTransform)).toBe(false);
      });

      it("should return false for optional and nullable string schemas", () => {
        expect(isSimpleStringZodSchema(z3.string().optional())).toBe(false);
        expect(isSimpleStringZodSchema(z3.string().nullable())).toBe(false);
        expect(isSimpleStringZodSchema(z3.string().nullish())).toBe(false);
      });

      it("should return false for non-string schemas", () => {
        expect(isSimpleStringZodSchema(z3.number())).toBe(false);
        expect(isSimpleStringZodSchema(z3.boolean())).toBe(false);
        expect(isSimpleStringZodSchema(z3.date())).toBe(false);
        expect(isSimpleStringZodSchema(z3.array(z3.string()))).toBe(false);
        expect(isSimpleStringZodSchema(z3.object({ name: z3.string() }))).toBe(
          false
        );
      });
    });

    describe("v4 schemas", () => {
      it("should return true for basic string schemas", () => {
        expect(isSimpleStringZodSchema(z4.string())).toBe(true);
        expect(isSimpleStringZodSchema(z4.string().min(1))).toBe(true);
        expect(isSimpleStringZodSchema(z4.string().max(10))).toBe(true);
        expect(isSimpleStringZodSchema(z4.string().email())).toBe(true);
        expect(isSimpleStringZodSchema(z4.string().url())).toBe(true);
        expect(isSimpleStringZodSchema(z4.string().uuid())).toBe(true);
        expect(isSimpleStringZodSchema(z4.string().regex(/test/))).toBe(true);
      });

      it("should return false for string schemas with defaults", () => {
        expect(isSimpleStringZodSchema(z4.string().default("test"))).toBe(
          false
        );
        expect(
          isSimpleStringZodSchema(z4.string().min(1).default("test"))
        ).toBe(false);
      });

      it("should return false for string transforms (input/output types may differ)", () => {
        const stringTransform = z4.string().transform((s) => s.toUpperCase());
        expect(isSimpleStringZodSchema(stringTransform)).toBe(false);

        const objectToStringTransform = z4
          .object({ value: z4.string() })
          .transform((obj) => obj.value);
        expect(isSimpleStringZodSchema(objectToStringTransform)).toBe(false);
      });

      it("should return false for optional and nullable string schemas", () => {
        expect(isSimpleStringZodSchema(z4.string().optional())).toBe(false);
        expect(isSimpleStringZodSchema(z4.string().nullable())).toBe(false);
        expect(isSimpleStringZodSchema(z4.string().nullish())).toBe(false);
      });

      it("should return false for non-string schemas", () => {
        expect(isSimpleStringZodSchema(z4.number())).toBe(false);
        expect(isSimpleStringZodSchema(z4.boolean())).toBe(false);
        expect(isSimpleStringZodSchema(z4.date())).toBe(false);
        expect(isSimpleStringZodSchema(z4.array(z4.string()))).toBe(false);
        expect(isSimpleStringZodSchema(z4.object({ name: z4.string() }))).toBe(
          false
        );
      });
    });

    it("should return false for non-schema values", () => {
      expect(isSimpleStringZodSchema(null)).toBe(false);
      expect(isSimpleStringZodSchema(undefined)).toBe(false);
      expect(isSimpleStringZodSchema({})).toBe(false);
      expect(isSimpleStringZodSchema("string")).toBe(false);
      expect(isSimpleStringZodSchema(123)).toBe(false);
      expect(isSimpleStringZodSchema([])).toBe(false);
    });
  });

  describe("isInteropZodObject", () => {
    describe("v3 schemas", () => {
      it("should return true for object schemas", () => {
        expect(isInteropZodObject(z3.object({}))).toBe(true);
        expect(isInteropZodObject(z3.object({ name: z3.string() }))).toBe(true);
        expect(
          isInteropZodObject(
            z3.object({
              name: z3.string(),
              age: z3.number(),
            })
          )
        ).toBe(true);
      });

      it("should return false for non-object schemas", () => {
        expect(isInteropZodObject(z3.string())).toBe(false);
        expect(isInteropZodObject(z3.number())).toBe(false);
        expect(isInteropZodObject(z3.boolean())).toBe(false);
        expect(isInteropZodObject(z3.array(z3.string()))).toBe(false);
        expect(isInteropZodObject(z3.union([z3.string(), z3.number()]))).toBe(
          false
        );
        expect(isInteropZodObject(z3.record(z3.string()))).toBe(false);
      });
    });

    describe("v4 schemas", () => {
      it("should return true for object schemas", () => {
        expect(isInteropZodObject(z4.object({}))).toBe(true);
        expect(isInteropZodObject(z4.object({ name: z4.string() }))).toBe(true);
        expect(
          isInteropZodObject(
            z4.object({
              name: z4.string(),
              age: z4.number(),
            })
          )
        ).toBe(true);
      });

      it("should return false for non-object schemas", () => {
        expect(isInteropZodObject(z4.string())).toBe(false);
        expect(isInteropZodObject(z4.number())).toBe(false);
        expect(isInteropZodObject(z4.boolean())).toBe(false);
        expect(isInteropZodObject(z4.array(z4.string()))).toBe(false);
        expect(isInteropZodObject(z4.union([z4.string(), z4.number()]))).toBe(
          false
        );
        expect(isInteropZodObject(z4.record(z4.string(), z4.string()))).toBe(
          false
        );
      });
    });

    it("should return false for non-schema values", () => {
      expect(isInteropZodObject(null)).toBe(false);
      expect(isInteropZodObject(undefined)).toBe(false);
      expect(isInteropZodObject({})).toBe(false);
      expect(isInteropZodObject({ _def: "fake" })).toBe(false);
      expect(isInteropZodObject({ _zod: "fake" })).toBe(false);
      expect(isInteropZodObject("string")).toBe(false);
      expect(isInteropZodObject(123)).toBe(false);
      expect(isInteropZodObject([])).toBe(false);
    });

    it("should handle malformed schema objects", () => {
      // Malformed v3 schema
      expect(
        isInteropZodObject({
          _def: { typeName: "NotZodObject" },
        })
      ).toBe(false);

      // Malformed v4 schema
      expect(
        isInteropZodObject({
          _zod: { def: { type: "not-object" } },
        })
      ).toBe(false);

      // Missing required properties
      expect(
        isInteropZodObject({
          _def: {},
        })
      ).toBe(false);

      expect(
        isInteropZodObject({
          _zod: {},
        })
      ).toBe(false);
    });
  });

  describe("getInteropZodObjectShape", () => {
    describe("v3 schemas", () => {
      it("should return shape for empty object schema", () => {
        const schema = z3.object({});
        const shape = getInteropZodObjectShape(schema);
        expect(shape).toEqual({});
      });

      it("should return shape for object schema with single field", () => {
        const schema = z3.object({ name: z3.string() });
        const shape = getInteropZodObjectShape(schema);
        expect(Object.keys(shape)).toEqual(["name"]);
        expect(shape.name).toBeInstanceOf(z3.ZodString);
      });

      it("should return shape for object schema with multiple fields", () => {
        const schema = z3.object({
          name: z3.string(),
          age: z3.number(),
          isActive: z3.boolean(),
        });
        const shape = getInteropZodObjectShape(schema);
        expect(Object.keys(shape)).toEqual(["name", "age", "isActive"]);
        expect(shape.name).toBeInstanceOf(z3.ZodString);
        expect(shape.age).toBeInstanceOf(z3.ZodNumber);
        expect(shape.isActive).toBeInstanceOf(z3.ZodBoolean);
      });

      it("should return shape for nested object schema", () => {
        const schema = z3.object({
          user: z3.object({
            name: z3.string(),
            age: z3.number(),
          }),
        });
        const shape = getInteropZodObjectShape(schema);
        expect(Object.keys(shape)).toEqual(["user"]);
        expect(shape.user).toBeInstanceOf(z3.ZodObject);
        const userShape = getInteropZodObjectShape(shape.user);
        expect(Object.keys(userShape)).toEqual(["name", "age"]);
      });
    });

    describe("v4 schemas", () => {
      it("should return shape for empty object schema", () => {
        const schema = z4.object({});
        const shape = getInteropZodObjectShape(schema);
        expect(shape).toEqual({});
      });

      it("should return shape for object schema with single field", () => {
        const schema = z4.object({ name: z4.string() });
        const shape = getInteropZodObjectShape(schema);
        expect(Object.keys(shape)).toEqual(["name"]);
        expect(shape.name).toBeInstanceOf(z4.ZodString);
      });

      it("should return shape for object schema with multiple fields", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
          isActive: z4.boolean(),
        });
        const shape = getInteropZodObjectShape(schema);
        expect(Object.keys(shape)).toEqual(["name", "age", "isActive"]);
        expect(shape.name).toBeInstanceOf(z4.ZodString);
        expect(shape.age).toBeInstanceOf(z4.ZodNumber);
        expect(shape.isActive).toBeInstanceOf(z4.ZodBoolean);
      });

      it("should return shape for nested object schema", () => {
        const schema = z4.object({
          user: z4.object({
            name: z4.string(),
            age: z4.number(),
          }),
        });
        const shape = getInteropZodObjectShape(schema);
        expect(Object.keys(shape)).toEqual(["user"]);
        expect(shape.user).toBeInstanceOf(z4.ZodObject);
        const userShape = getInteropZodObjectShape(shape.user);
        expect(Object.keys(userShape)).toEqual(["name", "age"]);
      });
    });
  });

  describe("extendInteropZodObject", () => {
    describe("v3 schemas", () => {
      it("should extend empty object schema", () => {
        const schema = z3.object({});
        const extension = { name: z3.string() };
        const extended = extendInteropZodObject(schema, extension);
        expect(extended).toBeInstanceOf(z3.ZodObject);
        const shape = getInteropZodObjectShape(extended);
        expect(Object.keys(shape)).toEqual(["name"]);
        expect(shape.name).toBeInstanceOf(z3.ZodString);
      });

      it("should extend object schema with existing fields", () => {
        const schema = z3.object({ name: z3.string() });
        const extension = { age: z3.number() };
        const extended = extendInteropZodObject(schema, extension);
        expect(extended).toBeInstanceOf(z3.ZodObject);
        const shape = getInteropZodObjectShape(extended);
        expect(Object.keys(shape)).toEqual(["name", "age"]);
        expect(shape.name).toBeInstanceOf(z3.ZodString);
        expect(shape.age).toBeInstanceOf(z3.ZodNumber);
      });
    });

    describe("v4 schemas", () => {
      it("should extend empty object schema", () => {
        const schema = z4.object({});
        const extension = { name: z4.string() };
        const extended = extendInteropZodObject(schema, extension);
        expect(extended).toBeInstanceOf(z4.ZodObject);
        const shape = getInteropZodObjectShape(extended);
        expect(Object.keys(shape)).toEqual(["name"]);
        expect(shape.name).toBeInstanceOf(z4.ZodString);
      });

      it("should extend object schema with existing fields", () => {
        const schema = z4.object({ name: z4.string() });
        const extension = { age: z4.number() };
        const extended = extendInteropZodObject(schema, extension);
        expect(extended).toBeInstanceOf(z4.ZodObject);
        const shape = getInteropZodObjectShape(extended);
        expect(Object.keys(shape)).toEqual(["name", "age"]);
        expect(shape.name).toBeInstanceOf(z4.ZodString);
        expect(shape.age).toBeInstanceOf(z4.ZodNumber);
      });
    });
  });

  describe("interopZodObjectPartial", () => {
    describe("v3 schemas", () => {
      it("should make object schema with single field partial", () => {
        const schema = z3.object({ name: z3.string() });
        const partial = interopZodObjectPartial(schema);
        expect(partial).toBeInstanceOf(z3.ZodObject);
        const shape = getInteropZodObjectShape(partial);
        expect(Object.keys(shape)).toEqual(["name"]);
      });

      it("should validate partial schema correctly", () => {
        const schema = z3.object({
          name: z3.string(),
          age: z3.number(),
        });
        const partial = interopZodObjectPartial(schema);
        expect(interopParse(partial, {})).toEqual({});
        expect(interopParse(partial, { name: "John" })).toEqual({
          name: "John",
        });
        expect(interopParse(partial, { age: 30 })).toEqual({ age: 30 });
        expect(interopParse(partial, { name: "John", age: 30 })).toEqual({
          name: "John",
          age: 30,
        });
      });
    });

    describe("v4 schemas", () => {
      it("should make object schema with single field partial", () => {
        const schema = z4.object({ name: z4.string() });
        const partial = interopZodObjectPartial(schema);
        expect(partial).toBeInstanceOf(z4.ZodObject);
        const shape = getInteropZodObjectShape(partial);
        expect(Object.keys(shape)).toEqual(["name"]);
      });

      it("should validate partial schema correctly", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const partial = interopZodObjectPartial(schema);
        expect(interopParse(partial, {})).toEqual({});
        expect(interopParse(partial, { name: "John" })).toEqual({
          name: "John",
        });
        expect(interopParse(partial, { age: 30 })).toEqual({ age: 30 });
        expect(interopParse(partial, { name: "John", age: 30 })).toEqual({
          name: "John",
          age: 30,
        });
      });
    });
  });

  describe("interopZodObjectPassthrough", () => {
    describe("v3 schemas", () => {
      it("should make empty object schema passthrough", () => {
        const schema = z3.object({});
        const passthrough = interopZodObjectPassthrough(schema);
        expect(passthrough).toBeInstanceOf(z3.ZodObject);
        const shape = getInteropZodObjectShape(passthrough);
        expect(shape).toEqual({});
        expect(interopParse(passthrough, { extra: "field" })).toEqual({
          extra: "field",
        });
      });

      it("should make object schema with fields passthrough", () => {
        const schema = z3.object({
          name: z3.string(),
          age: z3.number(),
        });
        const passthrough = interopZodObjectPassthrough(schema);
        expect(passthrough).toBeInstanceOf(z3.ZodObject);
        const shape = getInteropZodObjectShape(passthrough);
        expect(Object.keys(shape)).toEqual(["name", "age"]);
        expect(shape.name).toBeInstanceOf(z3.ZodString);
        expect(shape.age).toBeInstanceOf(z3.ZodNumber);
        expect(
          interopParse(passthrough, {
            name: "John",
            age: 30,
            extra: "field",
            additional: 123,
          })
        ).toEqual({
          name: "John",
          age: 30,
          extra: "field",
          additional: 123,
        });
      });

      it("should validate required fields while allowing extra fields", () => {
        const schema = z3.object({
          name: z3.string(),
          age: z3.number(),
        });
        const passthrough = interopZodObjectPassthrough(schema);
        expect(() => interopParse(passthrough, { extra: "field" })).toThrow(); // Missing required fields
        expect(() =>
          interopParse(passthrough, { name: "John", extra: "field" })
        ).toThrow(); // Missing required age
        expect(
          interopParse(passthrough, {
            name: "John",
            age: 30,
            extra: "field",
          })
        ).toEqual({
          name: "John",
          age: 30,
          extra: "field",
        });
      });
    });

    describe("v4 schemas", () => {
      it("should make empty object schema passthrough", () => {
        const schema = z4.object({});
        const passthrough = interopZodObjectPassthrough(schema);
        expect(passthrough).toBeInstanceOf(z4.ZodObject);
        const shape = getInteropZodObjectShape(passthrough);
        expect(shape).toEqual({});
        expect(interopParse(passthrough, { extra: "field" })).toEqual({
          extra: "field",
        });
      });

      it("should make object schema with fields passthrough", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const passthrough = interopZodObjectPassthrough(schema);
        expect(passthrough).toBeInstanceOf(z4.ZodObject);
        const shape = getInteropZodObjectShape(passthrough);
        expect(Object.keys(shape)).toEqual(["name", "age"]);
        expect(shape.name).toBeInstanceOf(z4.ZodString);
        expect(shape.age).toBeInstanceOf(z4.ZodNumber);
        expect(
          interopParse(passthrough, {
            name: "John",
            age: 30,
            extra: "field",
            additional: 123,
          })
        ).toEqual({
          name: "John",
          age: 30,
          extra: "field",
          additional: 123,
        });
      });

      it("should validate required fields while allowing extra fields", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const passthrough = interopZodObjectPassthrough(schema);
        expect(() => interopParse(passthrough, { extra: "field" })).toThrow(); // Missing required fields
        expect(() =>
          interopParse(passthrough, { name: "John", extra: "field" })
        ).toThrow(); // Missing required age
        expect(
          interopParse(passthrough, {
            name: "John",
            age: 30,
            extra: "field",
          })
        ).toEqual({
          name: "John",
          age: 30,
          extra: "field",
        });
      });

      it("should handle recursive passthrough validation", () => {
        const schema = z4.object({
          user: z4.strictObject({
            name: z4.string(),
            age: z4.number(),
          }),
        });
        const passthrough = interopZodObjectPassthrough(schema, true);
        expect(
          interopParse(passthrough, {
            user: {
              name: "John",
              age: 30,
              extra: "field",
              additional: 123,
            },
            extra: "field",
          })
        ).toEqual({
          user: {
            name: "John",
            age: 30,
            extra: "field",
            additional: 123,
          },
          extra: "field",
        });
      });

      it("should not apply passthrough validation recursively by default", () => {
        const schema = z4.object({
          user: z4.strictObject({
            name: z4.string(),
            age: z4.number(),
          }),
        });
        const passthrough = interopZodObjectPassthrough(schema);
        expect(() =>
          interopParse(passthrough, {
            user: {
              name: "John",
              age: 30,
              extra: "field",
            },
          })
        ).toThrow();
      });

      it("should add `additionalProperties: {}` when serialized to JSON schema", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const passthrough = interopZodObjectPassthrough(schema) as ZodObjectV4;
        const jsonSchema = z4.toJSONSchema(passthrough, { io: "input" });
        expect(jsonSchema.additionalProperties).toEqual({});
      });

      it("should add `additionalProperties: {}` when serialized to JSON schema recursively", () => {
        const schema = z4.object({
          user: z4.object({
            name: z4.string(),
            age: z4.number(),
            locations: z4.array(
              z4.object({
                name: z4.string(),
              })
            ),
          }),
        });
        const passthrough = interopZodObjectPassthrough(
          schema,
          true
        ) as ZodObjectV4;
        const jsonSchema = z4.toJSONSchema(passthrough, { io: "input" });
        expect(jsonSchema.additionalProperties).toEqual({});
        // @ts-expect-error - JSON schema types are not generic, but we still want to check the nested object
        expect(jsonSchema.properties?.user?.additionalProperties).toEqual({});
        expect(
          // @ts-expect-error - JSON schema types are not generic, but we still want to check the nested array
          jsonSchema.properties?.user?.properties?.locations?.items
            ?.additionalProperties
        ).toEqual({});
      });

      it("should handle arrays of objects with strict validation", () => {
        const schema = z4.object({
          users: z4.array(
            z4.object({
              name: z4.string(),
              age: z4.number(),
            })
          ),
        });
        const strict = interopZodObjectStrict(schema, true);
        expect(() =>
          interopParse(strict, {
            users: [
              { name: "John", age: 30, extra: "field" },
              { name: "Jane", age: 25 },
            ],
          })
        ).toThrow();
      });

      it("should keep meta fields", () => {
        const schema = z4
          .object({
            name: z4.string().describe("The name of the author"),
          })
          .describe("The object");
        const passthrough = interopZodObjectPassthrough(
          schema,
          true
        ) as ZodObjectV4;
        expect(z4.globalRegistry.get(passthrough)).toBeDefined();
        expect(z4.globalRegistry.get(passthrough)?.description).toBe(
          "The object"
        );
      });
    });
  });

  describe("getInteropZodDefaultGetter", () => {
    describe("v3 schemas", () => {
      it("should return default getter for schema with default value", () => {
        const schema = z3.string().default("test");
        const defaultGetter = getInteropZodDefaultGetter(schema);
        expect(defaultGetter).toBeDefined();
        expect(typeof defaultGetter).toBe("function");
        expect(defaultGetter?.()).toBe("test");
      });

      it("should return default getter for schema with function default", () => {
        const schema = z3.string().default(() => "dynamic");
        const defaultGetter = getInteropZodDefaultGetter(schema);
        expect(defaultGetter).toBeDefined();
        expect(typeof defaultGetter).toBe("function");
        expect(defaultGetter?.()).toBe("dynamic");
      });

      it("should return undefined for schema without default", () => {
        const schema = z3.string();
        const defaultGetter = getInteropZodDefaultGetter(schema);
        expect(defaultGetter).toBeUndefined();
      });

      it("should handle object schema with default values", () => {
        const schema = z3
          .object({
            name: z3.string().default("John"),
            age: z3.number().default(30),
          })
          .default({
            name: "John",
            age: 30,
          });
        const defaultGetter = getInteropZodDefaultGetter(schema);
        expect(defaultGetter).toBeDefined();
        expect(typeof defaultGetter).toBe("function");
        expect(defaultGetter?.()).toEqual({
          name: "John",
          age: 30,
        });
      });
    });

    describe("v4 schemas", () => {
      it("should return default getter for schema with default value", () => {
        const schema = z4.string().default("test");
        const defaultGetter = getInteropZodDefaultGetter(schema);
        expect(defaultGetter).toBeDefined();
        expect(typeof defaultGetter).toBe("function");
        expect(defaultGetter?.()).toBe("test");
      });

      it("should return default getter for schema with function default", () => {
        const schema = z4.string().default(() => "dynamic");
        const defaultGetter = getInteropZodDefaultGetter(schema);
        expect(defaultGetter).toBeDefined();
        expect(typeof defaultGetter).toBe("function");
        expect(defaultGetter?.()).toBe("dynamic");
      });

      it("should return undefined for schema without default", () => {
        const schema = z4.string();
        const defaultGetter = getInteropZodDefaultGetter(schema);
        expect(defaultGetter).toBeUndefined();
      });

      it("should handle object schema with default values", () => {
        const schema = z4
          .object({
            name: z4.string().default("John"),
            age: z4.number().default(30),
          })
          .default({
            name: "John",
            age: 30,
          });
        const defaultGetter = getInteropZodDefaultGetter(schema);
        expect(defaultGetter).toBeDefined();
        expect(typeof defaultGetter).toBe("function");
        expect(defaultGetter?.()).toEqual({
          name: "John",
          age: 30,
        });
      });
    });
  });

  describe("interopZodObjectStrict", () => {
    describe("v3 schemas", () => {
      it("should make object schema strict", () => {
        const schema = z3.object({
          name: z3.string(),
          age: z3.number(),
        });
        const strict = interopZodObjectStrict(schema);
        expect(strict).toBeInstanceOf(z3.ZodObject);
        const shape = getInteropZodObjectShape(strict);
        expect(Object.keys(shape)).toEqual(["name", "age"]);
        expect(shape.name).toBeInstanceOf(z3.ZodString);
        expect(shape.age).toBeInstanceOf(z3.ZodNumber);
      });

      it("should reject extra properties", () => {
        const schema = z3.object({
          name: z3.string(),
          age: z3.number(),
        });
        const strict = interopZodObjectStrict(schema);
        expect(() =>
          interopParse(strict, { name: "John", age: 30, extra: "field" })
        ).toThrow();
      });
    });

    describe("v4 schemas", () => {
      it("should make object schema strict", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const strict = interopZodObjectStrict(schema);
        expect(strict).toBeInstanceOf(z4.ZodObject);
        const shape = getInteropZodObjectShape(strict);
        expect(Object.keys(shape)).toEqual(["name", "age"]);
        expect(shape.name).toBeInstanceOf(z4.ZodString);
        expect(shape.age).toBeInstanceOf(z4.ZodNumber);
      });

      it("should reject extra properties", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const strict = interopZodObjectStrict(schema);
        expect(() =>
          interopParse(strict, { name: "John", age: 30, extra: "field" })
        ).toThrow();
      });

      it("should handle recursive strict validation", () => {
        const schema = z4.object({
          user: z4.object({
            name: z4.string(),
            age: z4.number(),
          }),
        });
        const strict = interopZodObjectStrict(schema, true);
        expect(() =>
          interopParse(strict, {
            user: { name: "John", age: 30, extra: "field" },
          })
        ).toThrow();
      });

      it("should handle arrays of objects with strict validation", () => {
        const schema = z4.object({
          users: z4.array(
            z4.object({
              name: z4.string(),
              age: z4.number(),
            })
          ),
        });
        const strict = interopZodObjectStrict(schema, true);
        expect(() =>
          interopParse(strict, {
            users: [
              { name: "John", age: 30, extra: "field" },
              { name: "Jane", age: 25 },
            ],
          })
        ).toThrow();
      });

      it("should not apply strict validation recursively by default", () => {
        const schema = z4.object({
          user: z4.looseObject({
            name: z4.string(),
            age: z4.number(),
          }),
        });
        const strict = interopZodObjectStrict(schema);
        expect(
          interopParse(strict, {
            user: { name: "John", age: 30, extra: "field" },
          })
        ).toEqual({
          user: { name: "John", age: 30, extra: "field" },
        });
      });

      it("should add `additionalProperties: false` when serialized to JSON schema", () => {
        const schema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const strict = interopZodObjectStrict(schema) as ZodObjectV4;
        const jsonSchema = z4.toJSONSchema(strict, { io: "input" });
        expect(jsonSchema.additionalProperties).toBe(false);
      });

      it("should add `additionalProperties: false` when serialized to JSON schema recursively", () => {
        const schema = z4.object({
          user: z4.object({
            name: z4.string(),
            age: z4.number(),
            locations: z4.array(
              z4.object({
                name: z4.string(),
              })
            ),
          }),
        });
        const strict = interopZodObjectStrict(schema, true) as ZodObjectV4;
        const jsonSchema = z4.toJSONSchema(strict, { io: "input" });
        expect(jsonSchema.additionalProperties).toBe(false);
        // @ts-expect-error - JSON schema types are not generic, but we still want to check the nested object
        expect(jsonSchema.properties?.user?.additionalProperties).toBe(false);
        expect(
          // @ts-expect-error - JSON schema types are not generic, but we still want to check the nested array
          jsonSchema.properties?.user?.properties?.locations?.items
            ?.additionalProperties
        ).toBe(false);
      });

      it("should keep meta fields", () => {
        const schema = z4
          .object({
            name: z4.string().describe("The name of the author"),
          })
          .describe("The object");
        const strict = interopZodObjectStrict(schema, true) as ZodObjectV4;
        expect(z4.globalRegistry.get(strict)).toBeDefined();
        expect(z4.globalRegistry.get(strict)?.description).toBe("The object");
      });
    });

    it("should throw error for non-object schemas", () => {
      // @ts-expect-error - Testing invalid input
      expect(() => interopZodObjectStrict(z3.string())).toThrow();
      // @ts-expect-error - Testing invalid input
      expect(() => interopZodObjectStrict(z4.string())).toThrow();
      // @ts-expect-error - Testing invalid input
      expect(() => interopZodObjectStrict(z3.number())).toThrow();
      // @ts-expect-error - Testing invalid input
      expect(() => interopZodObjectStrict(z4.number())).toThrow();
      // @ts-expect-error - Testing invalid input
      expect(() => interopZodObjectStrict(z3.array(z3.string()))).toThrow();
      // @ts-expect-error - Testing invalid input
      expect(() => interopZodObjectStrict(z4.array(z4.string()))).toThrow();
    });

    it("should throw error for malformed schemas", () => {
      // @ts-expect-error - Testing invalid input
      expect(() => interopZodObjectStrict({})).toThrow();
      // @ts-expect-error - Testing invalid input
      expect(() => interopZodObjectStrict({ _def: "fake" })).toThrow();
      // @ts-expect-error - Testing invalid input
      expect(() => interopZodObjectStrict({ _zod: "fake" })).toThrow();
    });
  });

  describe("interopZodTransformInputSchema", () => {
    describe("v3 schemas", () => {
      it("should return input schema for transform schema", () => {
        const inputSchema = z3.string();
        const transformSchema = inputSchema.transform((s) => s.toUpperCase());
        const result = interopZodTransformInputSchema(transformSchema);
        expect(result).toBe(inputSchema);
      });

      it("should return input schema for chained transforms", () => {
        const inputSchema = z3.string();
        const transformSchema = inputSchema
          .transform((s) => s.toUpperCase())
          .transform((s) => s.toLowerCase());
        const result = interopZodTransformInputSchema(transformSchema);
        expect(result).toBe(inputSchema);
      });

      it("should return input schema for non-transform schema", () => {
        const inputSchema = z3.string();
        const result = interopZodTransformInputSchema(inputSchema);
        expect(result).toBe(inputSchema);
      });
    });

    describe("v4 schemas", () => {
      it("should return input schema for transform schema", () => {
        const inputSchema = z4.string();
        const transformSchema = inputSchema.transform((s) => s.toUpperCase());
        const result = interopZodTransformInputSchema(transformSchema);
        expect(result).toBe(inputSchema);
      });

      it("should return input schema for chained transforms", () => {
        const inputSchema = z4.string();
        const transformSchema = inputSchema
          .transform((s) => s.toUpperCase())
          .transform((s) => s.toLowerCase());
        const result = interopZodTransformInputSchema(transformSchema);
        expect(result).toBe(inputSchema);
      });

      it("should return input schema for non-transform schema", () => {
        const inputSchema = z4.string();
        const result = interopZodTransformInputSchema(inputSchema);
        expect(result).toBe(inputSchema);
      });

      it("should handle recursive processing of nested object schemas", () => {
        const nestedSchema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const inputSchema = z4.object({
          user: nestedSchema,
          metadata: z4.string(),
        });
        const transformSchema = inputSchema.transform((obj) => ({
          ...obj,
          processed: true,
        }));
        const result = interopZodTransformInputSchema(transformSchema, true);

        expect(result).toBeInstanceOf(z4.ZodObject);
        const resultShape = getInteropZodObjectShape(result as any);
        expect(Object.keys(resultShape)).toEqual(["user", "metadata"]);
        expect(resultShape.user).toBeInstanceOf(z4.ZodObject);
        expect(resultShape.metadata).toBeInstanceOf(z4.ZodString);
      });

      it("should handle recursive processing of arrays of object schemas", () => {
        const userSchema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const inputSchema = z4.object({
          users: z4.array(userSchema),
          count: z4.number(),
        });
        const transformSchema = inputSchema.transform((obj) => ({
          ...obj,
          processed: true,
        }));
        const result = interopZodTransformInputSchema(transformSchema, true);

        expect(result).toBeInstanceOf(z4.ZodObject);
        const resultShape = getInteropZodObjectShape(result as any);
        expect(Object.keys(resultShape)).toEqual(["users", "count"]);
        expect(resultShape.users).toBeInstanceOf(z4.ZodArray);
        expect(resultShape.count).toBeInstanceOf(z4.ZodNumber);
      });

      it("should not apply recursive processing by default", () => {
        const nestedSchema = z4.object({
          name: z4.string(),
          age: z4.number(),
        });
        const inputSchema = z4.object({
          user: nestedSchema,
          metadata: z4.string(),
        });
        const transformSchema = inputSchema.transform((obj) => ({
          ...obj,
          processed: true,
        }));
        const result = interopZodTransformInputSchema(transformSchema);

        // Should return the original input schema without recursive processing
        expect(result).toBe(inputSchema);
      });

      it("should handle nested transforms in object properties", () => {
        // Create a schema where inner properties are transformed
        const userSchema = z4.object({
          name: z4.string().transform((s) => s.toUpperCase()),
          age: z4.number().transform((n) => n * 2),
        });
        const inputSchema = z4.object({
          user: userSchema,
          metadata: z4.string(),
        });

        // When recursive=true, we should get the input schema with the original property types
        const result = interopZodTransformInputSchema(inputSchema, true);

        expect(result).toBeInstanceOf(z4.ZodObject);
        const resultShape = getInteropZodObjectShape(result as any);
        expect(Object.keys(resultShape)).toEqual(["user", "metadata"]);

        // The user property should be an object with untransformed schemas
        expect(resultShape.user).toBeInstanceOf(z4.ZodObject);
        const userShape = getInteropZodObjectShape(resultShape.user as any);
        expect(Object.keys(userShape)).toEqual(["name", "age"]);
        expect(userShape.name).toBeInstanceOf(z4.ZodString);
        expect(userShape.age).toBeInstanceOf(z4.ZodNumber);

        // The metadata should remain unchanged
        expect(resultShape.metadata).toBeInstanceOf(z4.ZodString);
      });

      it("should handle transforms in array elements", () => {
        // Create a schema where array elements are transformed
        const userSchema = z4.object({
          name: z4.string().transform((s) => s.toUpperCase()),
          age: z4.number(),
        });
        const inputSchema = z4.object({
          users: z4.array(userSchema),
          count: z4.number(),
        });

        const result = interopZodTransformInputSchema(inputSchema, true);

        expect(result).toBeInstanceOf(z4.ZodObject);
        const resultShape = getInteropZodObjectShape(result as any);
        expect(Object.keys(resultShape)).toEqual(["users", "count"]);

        // The users property should be an array with untransformed element schema
        expect(resultShape.users).toBeInstanceOf(z4.ZodArray);
        const arrayElement = (resultShape.users as any)._zod.def.element;
        expect(arrayElement).toBeInstanceOf(z4.ZodObject);

        const elementShape = getInteropZodObjectShape(arrayElement as any);
        expect(Object.keys(elementShape)).toEqual(["name", "age"]);
        expect(elementShape.name).toBeInstanceOf(z4.ZodString);
        expect(elementShape.age).toBeInstanceOf(z4.ZodNumber);
      });
    });

    it("should throw error for non-schema values", () => {
      expect(() => interopZodTransformInputSchema(null as any)).toThrow();
      expect(() => interopZodTransformInputSchema(undefined as any)).toThrow();
      expect(() => interopZodTransformInputSchema({} as any)).toThrow();
      expect(() => interopZodTransformInputSchema("string" as any)).toThrow();
      expect(() => interopZodTransformInputSchema(123 as any)).toThrow();
      expect(() => interopZodTransformInputSchema([] as any)).toThrow();
    });
  });
});
