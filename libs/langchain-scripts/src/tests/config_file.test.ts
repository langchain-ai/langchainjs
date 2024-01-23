import { test, expect } from "@jest/globals";
import { verifyObjectIsLangChainConfig } from "../utils.js";

test("verifyObjectIsLangChainConfig successfully fails an invalid object", async () => {
  const { config } = await import("./langchain.invalid.config.js");
  const isValid = verifyObjectIsLangChainConfig(config);
  expect(isValid).toBe(false);
});

test("verifyObjectIsLangChainConfig successfully passes a valid object", async () => {
  const { config } = await import("./langchain.valid.config.js");
  const isValid = verifyObjectIsLangChainConfig(config);
  expect(isValid).toBe(true);
});