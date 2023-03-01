import { test, expect } from "@jest/globals";
import { OpenAIChat } from "../openai-chat.js";

test("Test OpenAI", async () => {
  const model = new OpenAIChat({ modelName: "gpt-3.5-turbo" });
  const res = await model.call("Print hello world");
  console.log({ res });
});

test("Test OpenAI with prefix messages", async () => {
  const model = new OpenAIChat({
    prefixMessages: [
      { role: "user", content: "My name is John" },
      { role: "assistant", content: "Hi there" },
    ],
  });
  const res = await model.call("What is my name");
  console.log({ res });
});

test("Test OpenAI in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new OpenAIChat({
    modelName: "gpt-3.5-turbo",
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
