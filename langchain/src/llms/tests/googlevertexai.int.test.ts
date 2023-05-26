import { test } from "@jest/globals";
import { GoogleVertexAI } from "../googlevertexai.js";

test("Test Google Vertex", async () => {
  const model = new GoogleVertexAI({ maxOutputTokens: 50 });
  const res = await model.call("1 + 1 = ");
  console.log({ res });
});

test("Test Google Vertex generation", async () => {
  const model = new GoogleVertexAI({ maxOutputTokens: 50 });
  const res = await model.generate(["1 + 1 = "]);
  console.log(JSON.stringify(res, null, 2));
});

test("Test Google Vertex generation", async () => {
  const model = new GoogleVertexAI({ maxOutputTokens: 50 });
  const res = await model.generate(["Print hello world."]);
  console.log(JSON.stringify(res, null, 2));
});

test("Test Google Vertex generation", async () => {
  const model = new GoogleVertexAI({ maxOutputTokens: 50 });
  const res = await model.generate([
    `Translate "I love programming" into Korean.`,
  ]);
  console.log(JSON.stringify(res, null, 2));
});
