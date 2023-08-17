import { test, expect } from "@jest/globals";
import { calculateMaxTokens } from "../count_tokens.js";

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
