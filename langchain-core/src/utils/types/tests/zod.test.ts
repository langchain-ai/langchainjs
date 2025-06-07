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

    it("should return false for falsy values", () => {
      expect(isInteropZodSchema(null)).toBe(false);
      expect(isInteropZodSchema(undefined)).toBe(false);
      expect(isInteropZodSchema(false)).toBe(false);
      expect(isInteropZodSchema(0)).toBe(false);
      expect(isInteropZodSchema("")).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isInteropZodSchema("string")).toBe(false);
      expect(isInteropZodSchema(123)).toBe(false);
      expect(isInteropZodSchema(true)).toBe(false);
      expect(isInteropZodSchema(Symbol("test"))).toBe(false);
    });

    it("should return false for arrays", () => {
      expect(isInteropZodSchema([])).toBe(false);
      expect(isInteropZodSchema([1, 2, 3])).toBe(false);
      expect(isInteropZodSchema(["string"])).toBe(false);
    });

    it("should return false for plain objects", () => {
      expect(isInteropZodSchema({})).toBe(false);
      expect(isInteropZodSchema({ name: "test" })).toBe(false);
      expect(isInteropZodSchema({ _def: "fake" })).toBe(false);
      expect(isInteropZodSchema({ _zod: "fake" })).toBe(false);
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

      it("should return false for complex object schemas", () => {
        expect(isSimpleStringZodSchema(z3.object({}))).toBe(false);
        expect(isSimpleStringZodSchema(z3.object({ name: z3.string() }))).toBe(
          false
        );
        expect(isSimpleStringZodSchema(z3.record(z3.string()))).toBe(false);
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

      it("should return false for complex object schemas", () => {
        expect(isSimpleStringZodSchema(z4.object({}))).toBe(false);
        expect(isSimpleStringZodSchema(z4.object({ name: z4.string() }))).toBe(
          false
        );
        expect(
          isSimpleStringZodSchema(z4.record(z4.string(), z4.string()))
        ).toBe(false);
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
});
