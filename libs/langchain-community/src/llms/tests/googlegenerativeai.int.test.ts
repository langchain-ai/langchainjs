import { test } from "@jest/globals";
import { GoogleGenerativeAI } from "../googlegenerativeai.js";

test.skip("Test Google AI", async () => {
  const model = new GoogleGenerativeAI();
  const res = await model.call("what is 1 + 1?");
  console.log({ res });
  expect(res).toBeTruthy();
});

test.skip("Test Google AI generation", async () => {
  const model = new GoogleGenerativeAI();
  const res = await model.generate(["what is 1 + 1?"]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
});

test.skip("Test Google AI generation", async () => {
  const model = new GoogleGenerativeAI();
  const res = await model.generate(["Print hello world."]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
});

test.skip("Test Google Palm generation", async () => {
  const model = new GoogleGenerativeAI();
  const res = await model.generate([
    `Translate "I love programming" into Korean.`,
  ]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
});
