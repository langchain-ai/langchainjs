import { test, expect } from "@jest/globals";
import { calculateMaxTokens, getModelContextSize } from "../count_tokens.js";

test("properly calculates correct max tokens", async () => {
  expect(
    await calculateMaxTokens({ prompt: "", modelName: "gpt-3.5-turbo-16k" })
  ).toBe(16384);
  expect(
    await calculateMaxTokens({
      prompt: "",
      modelName: "gpt-3.5-turbo-16k-0613",
    })
  ).toBe(16384);

  expect(
    await calculateMaxTokens({ prompt: "", modelName: "gpt-3.5-turbo" })
  ).toBe(4096);

  expect(await calculateMaxTokens({ prompt: "", modelName: "gpt-4" })).toBe(
    8192
  );
  expect(await calculateMaxTokens({ prompt: "", modelName: "gpt-4-32k" })).toBe(
    32768
  );
});

test("properly gets model context size", async () => {
  expect(await getModelContextSize("gpt-3.5-turbo-16k")).toBe(16384);
  expect(await getModelContextSize("gpt-3.5-turbo-16k-0613")).toBe(16384);
  expect(await getModelContextSize("gpt-3.5-turbo")).toBe(4096);
  expect(await getModelContextSize("gpt-4")).toBe(8192);
  expect(await getModelContextSize("gpt-4-32k")).toBe(32768);
});
