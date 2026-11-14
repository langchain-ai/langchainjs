import { test, expect } from "vitest";
import { validatesOnlyStrings } from "../json_schema.js";

test("a non-array anyOf must not hide a valid oneOf", () => {
  expect(() =>
    validatesOnlyStrings({ anyOf: "oops", oneOf: [{ type: "string" }] })
  ).not.toThrow();
  expect(
    validatesOnlyStrings({ anyOf: "oops", oneOf: [{ type: "string" }] })
  ).toBe(true);
  expect(
    validatesOnlyStrings({ anyOf: "oops", oneOf: [{ type: "number" }] })
  ).toBe(false);
});

test("existing composition behavior is unchanged", () => {
  expect(
    validatesOnlyStrings({ anyOf: [{ type: "string" }, { type: "string" }] })
  ).toBe(true);
  expect(
    validatesOnlyStrings({ anyOf: [{ type: "string" }, { type: "number" }] })
  ).toBe(false);
  expect(validatesOnlyStrings({ oneOf: [{ type: "string" }] })).toBe(true);
  expect(validatesOnlyStrings({ allOf: [{ type: "string" }] })).toBe(true);
  expect(validatesOnlyStrings({ type: "string" })).toBe(true);
  expect(validatesOnlyStrings({})).toBe(false);
});
