import { test } from "@jest/globals";
import { GooglePalm } from "../googlepalm.js";

test("Test Google Palm", async () => {
  const model = new GooglePalm();
  const res = await model.call("what is 1 + 1?");
  console.log({ res });
  expect(res).toBeTruthy();
}, 50000);

test("Test Google Palm generation", async () => {
  const model = new GooglePalm();
  const res = await model.generate(["what is 1 + 1?"]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
}, 50000);

test("Test Google Palm generation", async () => {
  const model = new GooglePalm();
  const res = await model.generate(["Print hello world."]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
}, 50000);

test("Test Google Palm generation", async () => {
  const model = new GooglePalm();
  const res = await model.generate([
    `Translate "I love programming" into Korean.`,
  ]);
  console.log(JSON.stringify(res, null, 2));
  expect(res).toBeTruthy();
}, 50000);
