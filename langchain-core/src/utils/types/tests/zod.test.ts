/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect } from "@jest/globals";
import * as z3 from "zod/v3";
import * as z4 from "zod/v4";
import {
  isZodSchemaV3,
  isZodSchemaV4,
  isZodSchema,
  isShapelessZodSchema,
  isSimpleStringZodSchema,
  getZodSafeParseIssues,
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

  describe("isZodSchema", () => {
    it("should return true for v3 schemas", () => {
      expect(isZodSchema(z3.string())).toBe(true);
      expect(isZodSchema(z3.number())).toBe(true);
      expect(isZodSchema(z3.object({ name: z3.string() }))).toBe(true);
      expect(isZodSchema(z3.array(z3.string()))).toBe(true);
      expect(isZodSchema(z3.string().optional())).toBe(true);
      expect(isZodSchema(z3.string().default("test"))).toBe(true);
      expect(isZodSchema(z3.string().transform((s) => s.toUpperCase()))).toBe(
        true
      );
    });

    it("should return true for v4 schemas", () => {
      expect(isZodSchema(z4.string())).toBe(true);
      expect(isZodSchema(z4.number())).toBe(true);
      expect(isZodSchema(z4.object({ name: z4.string() }))).toBe(true);
      expect(isZodSchema(z4.array(z4.string()))).toBe(true);
      expect(isZodSchema(z4.string().optional())).toBe(true);
      expect(isZodSchema(z4.string().default("test"))).toBe(true);
      expect(isZodSchema(z4.string().transform((s) => s.toUpperCase()))).toBe(
        true
      );
    });

    it("should return false for falsy values", () => {
      expect(isZodSchema(null)).toBe(false);
      expect(isZodSchema(undefined)).toBe(false);
      expect(isZodSchema(false)).toBe(false);
      expect(isZodSchema(0)).toBe(false);
      expect(isZodSchema("")).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isZodSchema("string")).toBe(false);
      expect(isZodSchema(123)).toBe(false);
      expect(isZodSchema(true)).toBe(false);
      expect(isZodSchema(Symbol("test"))).toBe(false);
    });

    it("should return false for arrays", () => {
      expect(isZodSchema([])).toBe(false);
      expect(isZodSchema([1, 2, 3])).toBe(false);
      expect(isZodSchema(["string"])).toBe(false);
    });

    it("should return false for plain objects", () => {
      expect(isZodSchema({})).toBe(false);
      expect(isZodSchema({ name: "test" })).toBe(false);
      expect(isZodSchema({ _def: "fake" })).toBe(false);
      expect(isZodSchema({ _zod: "fake" })).toBe(false);
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

      it("should return true for string schemas with defaults", () => {
        expect(isSimpleStringZodSchema(z3.string().default("test"))).toBe(true);
        expect(
          isSimpleStringZodSchema(z3.string().min(1).default("test"))
        ).toBe(true);
      });

      it("should return true for string transforms that are shapeless", () => {
        const stringTransform = z3.string().transform((s) => s.toUpperCase());
        expect(isSimpleStringZodSchema(stringTransform)).toBe(true);

        const objectToStringTransform = z3
          .object({ value: z3.string() })
          .transform((obj) => obj.value);
        expect(isSimpleStringZodSchema(objectToStringTransform)).toBe(true);
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

      it("should return true for string schemas with defaults", () => {
        expect(isSimpleStringZodSchema(z4.string().default("test"))).toBe(true);
        expect(
          isSimpleStringZodSchema(z4.string().min(1).default("test"))
        ).toBe(true);
      });

      it("should return true for string transforms that are shapeless", () => {
        const stringTransform = z4.string().transform((s) => s.toUpperCase());
        expect(isSimpleStringZodSchema(stringTransform)).toBe(true);

        const objectToStringTransform = z4
          .object({ value: z4.string() })
          .transform((obj) => obj.value);
        expect(isSimpleStringZodSchema(objectToStringTransform)).toBe(true);
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

  describe("getZodSafeParseIssues", () => {
    it("should return issues from v3 failed parse results", () => {
      const schema = z3.object({ name: z3.string(), age: z3.number() });
      const result = schema.safeParse({ name: "John", age: "not a number" });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = getZodSafeParseIssues(result);
        expect(issues).toHaveLength(1);
        expect(issues[0].code).toBe("invalid_type");
        expect(issues[0].path).toEqual(["age"]);
      }
    });

    it("should return issues from v4 failed parse results", () => {
      const schema = z4.object({ name: z4.string(), age: z4.number() });
      const result = schema.safeParse({ name: "John", age: "not a number" });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = getZodSafeParseIssues(result);
        expect(issues).toHaveLength(1);
        expect(issues[0].code).toBe("invalid_type");
        expect(issues[0].path).toEqual(["age"]);
      }
    });

    it("should return empty array for successful parse results", () => {
      const schema = z3.object({ name: z3.string(), age: z3.number() });
      const result = schema.safeParse({ name: "John", age: 25 });

      expect(result.success).toBe(true);
      const issues = getZodSafeParseIssues(result);
      expect(issues).toEqual([]);
    });

    it("should return empty array for v4 successful parse results", () => {
      const schema = z4.object({ name: z4.string(), age: z4.number() });
      const result = schema.safeParse({ name: "John", age: 25 });

      expect(result.success).toBe(true);
      const issues = getZodSafeParseIssues(result);
      expect(issues).toEqual([]);
    });

    it("should handle multiple validation issues", () => {
      const schema = z3.object({
        name: z3.string().min(2),
        age: z3.number().min(0),
        email: z3.string().email(),
      });
      const result = schema.safeParse({
        name: "J",
        age: -5,
        email: "invalid-email",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = getZodSafeParseIssues(result);
        expect(issues.length).toBeGreaterThan(0);
        expect(issues.some((issue) => issue.path.includes("name"))).toBe(true);
        expect(issues.some((issue) => issue.path.includes("age"))).toBe(true);
        expect(issues.some((issue) => issue.path.includes("email"))).toBe(true);
      }
    });

    it("should handle nested object validation issues", () => {
      const schema = z3.object({
        user: z3.object({
          profile: z3.object({
            name: z3.string().min(1),
          }),
        }),
      });
      const result = schema.safeParse({ user: { profile: { name: "" } } });

      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = getZodSafeParseIssues(result);
        expect(issues).toHaveLength(1);
        expect(issues[0].path).toEqual(["user", "profile", "name"]);
      }
    });

    it("should handle array validation issues", () => {
      const schema = z3.array(z3.number());
      const result = schema.safeParse([1, "not a number", 3]);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = getZodSafeParseIssues(result);
        expect(issues).toHaveLength(1);
        expect(issues[0].path).toEqual([1]);
      }
    });
  });

  describe("edge cases and type compatibility", () => {
    it("should handle mixed v3 and v4 schema detection", () => {
      const v3Schema = z3.string();
      const v4Schema = z4.string();

      expect(isZodSchema(v3Schema)).toBe(true);
      expect(isZodSchema(v4Schema)).toBe(true);
      expect(isZodSchemaV3(v3Schema)).toBe(true);
      expect(isZodSchemaV3(v4Schema)).toBe(false);
      expect(isZodSchemaV4(v3Schema)).toBe(false);
      expect(isZodSchemaV4(v4Schema)).toBe(true);
    });

    it("should handle complex nested schemas", () => {
      const complexV3Schema = z3.object({
        users: z3.array(
          z3.object({
            name: z3.string(),
            settings: z3
              .object({
                theme: z3.enum(["light", "dark"]),
                notifications: z3.boolean().default(true),
              })
              .optional(),
          })
        ),
      });

      const complexV4Schema = z4.object({
        users: z4.array(
          z4.object({
            name: z4.string(),
            settings: z4
              .object({
                theme: z4.enum(["light", "dark"]),
                notifications: z4.boolean().default(true),
              })
              .optional(),
          })
        ),
      });

      expect(isZodSchema(complexV3Schema)).toBe(true);
      expect(isZodSchema(complexV4Schema)).toBe(true);
      expect(isShapelessZodSchema(complexV3Schema)).toBe(false);
      expect(isShapelessZodSchema(complexV4Schema)).toBe(false);
      expect(isSimpleStringZodSchema(complexV3Schema)).toBe(false);
      expect(isSimpleStringZodSchema(complexV4Schema)).toBe(false);
    });

    it("should handle union and intersection types", () => {
      const unionV3 = z3.union([z3.string(), z3.number()]);
      const unionV4 = z4.union([z4.string(), z4.number()]);

      expect(isZodSchema(unionV3)).toBe(true);
      expect(isZodSchema(unionV4)).toBe(true);
      expect(isShapelessZodSchema(unionV3)).toBe(true);
      expect(isShapelessZodSchema(unionV4)).toBe(true);
      expect(isSimpleStringZodSchema(unionV3)).toBe(false);
      expect(isSimpleStringZodSchema(unionV4)).toBe(false);
    });

    it("should handle recursive schemas", () => {
      type Category = {
        name: string;
        subcategories?: Category[];
      };

      const categorySchemaV3: z3.ZodType<Category> = z3.lazy(() =>
        z3.object({
          name: z3.string(),
          subcategories: z3.array(categorySchemaV3).optional(),
        })
      );

      expect(isZodSchema(categorySchemaV3)).toBe(true);
      expect(isShapelessZodSchema(categorySchemaV3)).toBe(true); // lazy schemas are shapeless
      expect(isSimpleStringZodSchema(categorySchemaV3)).toBe(false);
    });

    it("should handle branded types", () => {
      const brandedV3 = z3.string().brand<"UserId">();

      expect(isZodSchema(brandedV3)).toBe(true);
      expect(isShapelessZodSchema(brandedV3)).toBe(true);
      expect(isSimpleStringZodSchema(brandedV3)).toBe(true);
    });

    it("should handle catch and pipe operations", () => {
      const catchSchemaV3 = z3.string().catch("default");

      expect(isZodSchema(catchSchemaV3)).toBe(true);
      expect(isShapelessZodSchema(catchSchemaV3)).toBe(true);
      expect(isSimpleStringZodSchema(catchSchemaV3)).toBe(true);
    });
  });
});
