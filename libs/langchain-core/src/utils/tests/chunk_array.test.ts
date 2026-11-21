import { test, expect } from "vitest";
import { chunkArray } from "../chunk_array.js";

test("keeps every input element when chunking", () => {
  expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(chunkArray([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  expect(chunkArray([], 3)).toEqual([]);
});

test("rejects a chunkSize that cannot produce a lossless partition", () => {
  for (const bad of [0, -1, 1.5, NaN, Infinity, -Infinity]) {
    expect(() => chunkArray([1, 2, 3], bad)).toThrow(RangeError);
  }
});
