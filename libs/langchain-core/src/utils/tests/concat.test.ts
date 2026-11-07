import { test, expect } from "vitest";
import { concat } from "../stream.js";

test("concatenates array fields inside object chunks instead of replacing them", () => {
  expect(concat({ content: ["a"] }, { content: ["b"] })).toEqual({
    content: ["a", "b"],
  });
  expect(
    concat({ content: ["a"], n: 1, s: "x" }, { content: ["b"], n: 2, s: "y" })
  ).toEqual({ content: ["a", "b"], n: 3, s: "xy" });
});

test("keeps the existing behavior for other shapes", () => {
  expect(concat([1, 2], [3])).toEqual([1, 2, 3]);
  expect(concat("a", "b")).toBe("ab");
  expect(concat(1, 2)).toBe(3);
  expect(concat({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
});
