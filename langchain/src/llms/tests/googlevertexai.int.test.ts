import { test } from "@jest/globals";
import { GoogleVertexAiLLM } from "../googlevertexai.js";

test("Test Google Vertex", async () => {
  const model = new GoogleVertexAiLLM({ maxTokens: 50 });
  const res = await model.call("1 + 1 = ");
  console.log({ res });
});

test("Test Google Vertex generation", async () => {
  const model = new GoogleVertexAiLLM({ maxTokens: 50 });
  const res = await model.generate(["1 + 1 = "]);
  console.log(JSON.stringify(res, null, 1));
});
