import { test } from "@jest/globals";
import { GooglePalm } from "../googlepalm.js";

test("Test Google Palm", async () => {
  const model = new GooglePalm({ maxOutputTokens: 50 });
  const res = await model.call("1 + 1 = ");
  console.log({ res });
  expect(model.temperature).toEqual(0.7);
});

test("Test Google Palm generation", async () => {
  const model = new GooglePalm({ maxOutputTokens: 50 });
  const res = await model.generate(["1 + 1 = "]);
  console.log(JSON.stringify(res, null, 2));
  expect(model.temperature).toEqual(0.7);
});

test("Test Google Palm generation", async () => {
  const model = new GooglePalm({ maxOutputTokens: 50 });
  const res = await model.generate(["Print hello world."]);
  console.log(JSON.stringify(res, null, 2));
  expect(model.temperature).toEqual(0.7);
});

test("Test Google Palm generation", async () => {
  const model = new GooglePalm({ maxOutputTokens: 50 });
  const res = await model.generate([
    `Translate "I love programming" into Korean.`,
  ]);
  console.log(JSON.stringify(res, null, 2));
  expect(model.temperature).toEqual(0.7);
});
