import { test, expect } from "@jest/globals";
import { _verifyObjectIsLangChainConfig } from "../build/utils.js";

test("_verifyObjectIsLangChainConfig successfully fails an invalid object", async () => {
  const { config } = await import("./langchain.invalid.config.js");
  const isValid = _verifyObjectIsLangChainConfig(config);
  expect(isValid).toBe(false);
});

test("_verifyObjectIsLangChainConfig successfully passes a valid object", async () => {
  const { config } = await import("./langchain.valid.config.js");
  const isValid = _verifyObjectIsLangChainConfig(config);
  expect(isValid).toBe(true);
});
