import { test, expect } from "vitest";
import { parseFileConfig } from "../parse.js";

test("accepts a .yml chain config because loadFileContents supports it", () => {
  expect(parseFileConfig("a: 1", "chain.yml")).toEqual({ a: 1 });
  expect(parseFileConfig("a: 1", "chain.yaml")).toEqual({ a: 1 });
  expect(parseFileConfig('{"a":1}', "chain.json")).toEqual({ a: 1 });
});

test("still rejects unsupported suffixes", () => {
  expect(() => parseFileConfig("a: 1", "chain.toml")).toThrow(
    "Unsupported filetype"
  );
});
