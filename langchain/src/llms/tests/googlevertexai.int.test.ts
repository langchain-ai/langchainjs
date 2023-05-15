import { test } from "@jest/globals";
import { GoogleVertexAiChat, GoogleVertexAiLLM } from "../googlevertexai.js";

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

test("Test Google Vertex chat", async () => {
  const model = new GoogleVertexAiChat({ maxTokens: 50 });
  const res = await model.call("1 + 1 = ");
  console.log({ res });
});

test("Test Google Vertex chat generation", async () => {
  const model = new GoogleVertexAiChat({ maxTokens: 50 });
  const res = await model.generate(["1 + 1 = "]);
  console.log(JSON.stringify(res, null, 1));
});

test("Test Google Vertex chat with prefix messages", async () => {
  const model = new GoogleVertexAiChat({
    prefixMessages: [
      { role: "user", content: "My name is John" },
      {
        role: "assistant",
        content: "Hi John, I'm Bard. It's nice to meet you.",
      },
    ],
    maxTokens: 10,
  });
  const res = await model.call("What is my name");
  console.log({ res });
});
