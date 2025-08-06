/* eslint-disable no-process-env */
import { test, expect } from "vitest";
import { castValue, isFloat, isInt, isString, isBoolean } from "../utils.js";

test("Casting values correctly", () => {
  const stringString = [
    "string",
    "test",
    "this is a string",
    "        ",
    "\n\n\n\n\n\n",
    `asdf
    zxcv`,
  ];

  const intString = [
    "1a",
    "2b",
    "3c",
    "a4",
    `123
    asdf`,
  ];

  const floatString = ["1.1a", "2.2b", "3.3c", "c4.4"];

  const intInt = ["1", 2, 3];

  const floatFloat = ["1.1", 2.2, 3.3];

  const booleanBoolean = [true, false];

  stringString.map(castValue).forEach((value) => {
    expect(typeof value).toBe("string");
    expect(isString(value)).toBe(true);
  });

  intString.map(castValue).forEach((value) => {
    expect(typeof value).toBe("string");
    expect(isString(value)).toBe(true);
    expect(isInt(value)).toBe(false);
  });

  floatString.map(castValue).forEach((value) => {
    expect(typeof value).toBe("string");
    expect(isString(value)).toBe(true);
    expect(isFloat(value)).toBe(false);
  });

  intInt.map(castValue).forEach((value) => {
    expect(typeof value).toBe("number");
    expect(isInt(value)).toBe(true);
  });

  floatFloat.map(castValue).forEach((value) => {
    expect(typeof value).toBe("number");
    expect(isFloat(value)).toBe(true);
  });

  booleanBoolean.map(castValue).forEach((value) => {
    expect(typeof value).toBe("boolean");
    expect(isBoolean(value)).toBe(true);
  });
});
