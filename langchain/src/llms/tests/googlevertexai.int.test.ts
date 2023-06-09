import { expect, test } from "@jest/globals";
import { GoogleVertexAI, GoogleVertexAICode } from "../googlevertexai.js";

test.skip("Test Google Vertex", async () => {
  const model = new GoogleVertexAI({ maxOutputTokens: 50 });
  const res = await model.call("1 + 1 = ");
  console.log({ res });
});

test.skip("Test Google Vertex generation", async () => {
  const model = new GoogleVertexAI({ maxOutputTokens: 50 });
  const res = await model.generate(["1 + 1 = "]);
  console.log(JSON.stringify(res, null, 2));
});

test.skip("Test Google Vertex generation", async () => {
  const model = new GoogleVertexAI({ maxOutputTokens: 50 });
  const res = await model.generate(["Print hello world."]);
  console.log(JSON.stringify(res, null, 2));
});

test.skip("Test Google Vertex generation", async () => {
  const model = new GoogleVertexAI({ maxOutputTokens: 50 });
  const res = await model.generate([
    `Translate "I love programming" into Korean.`,
  ]);
  console.log(JSON.stringify(res, null, 2));
});

test("Test Google Vertex Codey gecko model", async () => {
  const model = new GoogleVertexAICode();
  expect(model.model).toEqual("code-gecko");

  const res = await model.call("for( let co = 0");
  console.log(res);
});

test("Test Google Vertex Codey bison model", async () => {
  const model = new GoogleVertexAICode({
    model: "code-bison",
    maxOutputTokens: 2048,
  });
  expect(model.model).toEqual("code-bison");

  const res = await model.call("Count to 10 in JavaScript.");
  console.log(res);
});
