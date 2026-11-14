import { test, expect } from "vitest";
import { normalize } from "../math.js";

test("still normalizes a positive matrix by its largest value", () => {
  expect(
    normalize([
      [1, 2],
      [3, 4],
    ])
  ).toEqual([
    [0.25, 0.5],
    [0.75, 1],
  ]);
});

test("normalizes an all-negative matrix without producing Infinity", () => {
  const result = normalize([
    [-1, -2],
    [-3, -4],
  ]);
  expect(result).toEqual([
    [1, 2],
    [3, 4],
  ]);
  for (const row of result) {
    for (const value of row) expect(Number.isFinite(value)).toBe(true);
  }
});

test("normalizes an all-zero matrix without producing NaN", () => {
  const result = normalize([
    [0, 0],
    [0, 0],
  ]);
  expect(result).toEqual([
    [0, 0],
    [0, 0],
  ]);
  for (const row of result) {
    for (const value of row) expect(Number.isNaN(value)).toBe(false);
  }
});

test("empty matrix stays empty", () => {
  expect(normalize([])).toEqual([]);
});
