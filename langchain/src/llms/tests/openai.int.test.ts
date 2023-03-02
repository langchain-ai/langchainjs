import { test, expect } from "@jest/globals";
import { OpenAIChat } from "../openai-chat.js";
import { OpenAI } from "../openai.js";

test("Test OpenAI", async () => {
  const model = new OpenAI({ maxTokens: 5, modelName: "text-ada-001" });
  const res = await model.call("Print hello world");
  console.log({ res });
});

test("Test OpenAI with chat model returns OpenAIChat", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo" });
  expect(model).toBeInstanceOf(OpenAIChat);
  const res = await model.call("Print hello world");
  console.log({ res });
  expect(typeof res).toBe("string");
});

test("Test OpenAI in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new OpenAI({
    maxTokens: 5,
    modelName: "text-ada-001",
    streaming: true,
    callbackManager: {
      handleNewToken(token) {
        nrNewTokens += 1;
        streamedCompletion += token;
      },
    },
  });
  const res = await model.call("Print hello world");
  console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
  expect(res).toBe(streamedCompletion);
});
