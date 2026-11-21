import { test, expect } from "vitest";
import { extname } from "../extname.js";

test("matches node:path semantics for paths without an extension", () => {
  expect(extname("README")).toBe("");
  expect(extname("")).toBe("");
  expect(extname(".gitignore")).toBe("");
  expect(extname("dir.name/file")).toBe("");
  expect(extname("/tmp/dir.name/README")).toBe("");
});

test("still returns the real extension", () => {
  expect(extname("chain.json")).toBe(".json");
  expect(extname("chain.yml")).toBe(".yml");
  expect(extname("a.tar.gz")).toBe(".gz");
  expect(extname("dir.name/file.yaml")).toBe(".yaml");
  expect(extname("C:\\tmp\\chain.yaml")).toBe(".yaml");
});
