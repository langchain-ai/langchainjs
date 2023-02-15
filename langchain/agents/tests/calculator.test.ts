import { test, expect } from "@jest/globals";
import { Calculator } from "../tools/calculator";

test("Calculator tool, sum", async () => {
  const result = await Calculator.call("1 + 1");
  expect(result).toBe("2");
});

test("Calculator tool, product", async () => {
  const result = await Calculator.call("2 * 3");
  expect(result).toBe("6");
});

test("Calculator tool, division", async () => {
  const result = await Calculator.call("7 /2");
  expect(result).toBe("3.5");
});

test("Calculator tool, exponentiation", async () => {
  const result = await Calculator.call("2 ^ 8");
  expect(result).toBe("256");
});

test("Calculator tool, complicated expression", async () => {
  const result = await Calculator.call("((2 + 3) * 4) / 2");
  expect(result).toBe("10");
});
