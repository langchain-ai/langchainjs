import { test, expect } from "@jest/globals";
import { Calculator } from "../tools/calculator.js";

test("Calculator tool, sum", async () => {
  const calculator = new Calculator();
  const result = await calculator.call("1 + 1");
  expect(result).toBe("2");
});

test("Calculator tool, product", async () => {
  const calculator = new Calculator();
  const result = await calculator.call("2 * 3");
  expect(result).toBe("6");
});

test("Calculator tool, division", async () => {
  const calculator = new Calculator();
  const result = await calculator.call("7 /2");
  expect(result).toBe("3.5");
});

test("Calculator tool, exponentiation", async () => {
  const calculator = new Calculator();
  const result = await calculator.call("2 ^ 8");
  expect(result).toBe("256");
});

test("Calculator tool, complicated expression", async () => {
  const calculator = new Calculator();
  const result = await calculator.call("((2 + 3) * 4) / 2");
  expect(result).toBe("10");
});
