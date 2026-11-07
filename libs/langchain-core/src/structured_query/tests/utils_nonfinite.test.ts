import { test, expect } from "vitest";
import { castValue, isFloat, isString } from "../utils.js";

test("non-finite numeric strings are not floats and stay strings", () => {
  for (const value of ["Infinity", "-Infinity"]) {
    expect(isFloat(value)).toBe(false);
    expect(isString(value)).toBe(true);
    expect(castValue(value)).toBe(value);
  }
  expect(isFloat(Infinity)).toBe(false);
  expect(isFloat(NaN)).toBe(false);
});

test("ordinary numeric strings keep their existing casting", () => {
  expect(isFloat("1.1")).toBe(true);
  expect(castValue("1.1")).toBe(1.1);
  expect(castValue("12")).toBe(12);
  expect(castValue("hello")).toBe("hello");
  expect(isString("        ")).toBe(true);
});
