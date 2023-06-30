import { test, expect } from "@jest/globals";
import { ChatBaiduWenxin } from "../baiduwenxin.js";
import { HumanChatMessage, LLMResult } from "../../schema/index.js";
import { CallbackManager } from "../../callbacks/index.js";

test.skip("Test ChatBaiduWenxin default model", async () => {
  const chat = new ChatBaiduWenxin();
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test.skip("Test ChatBaiduWenxin ERNIE-Bot", async () => {
  const chat = new ChatBaiduWenxin({ modelName: "ERNIE-Bot" });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test.skip("Test ChatBaiduWenxin ERNIE-Bot with temperature", async () => {
  const chat = new ChatBaiduWenxin({
    modelName: "ERNIE-Bot",
    temperature: 1,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test.skip("Test ChatBaiduWenxin ERNIE-Bot with topP", async () => {
  const chat = new ChatBaiduWenxin({
    modelName: "ERNIE-Bot",
    topP: 1,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test.skip("Test ChatBaiduWenxin ERNIE-Bot with penaltyScore", async () => {
  const chat = new ChatBaiduWenxin({
    modelName: "ERNIE-Bot",
    penaltyScore: 1,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test.skip("Test ChatBaiduWenxin ERNIE-Bot in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatBaiduWenxin({
    modelName: "ERNIE-Bot",
    streaming: true,
    callbacks: [
      {
        async handleLLMNewToken(token: string) {
          nrNewTokens += 1;
          streamedCompletion += token;
        },
      },
    ],
  });
  const message = new HumanChatMessage("Hello!");
  const res = await model.call([message]);
  console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
  expect(res.text).toBe(streamedCompletion);
});

test.skip("Test ChatBaiduWenxin ERNIE-Bot-turbo", async () => {
  const chat = new ChatBaiduWenxin({
    modelName: "ERNIE-Bot-turbo",
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test.skip("Test ChatBaiduWenxin ERNIE-Bot-turbo in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatBaiduWenxin({
    modelName: "ERNIE-Bot-turbo",
    streaming: true,
    callbacks: [
      {
        async handleLLMNewToken(token: string) {
          nrNewTokens += 1;
          streamedCompletion += token;
        },
      },
    ],
  });
  const message = new HumanChatMessage("Hello!");
  const res = await model.call([message]);
  console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
  expect(res.text).toBe(streamedCompletion);
});

test.skip("Test ChatBaiduWenxin tokenUsage", async () => {
  let tokenUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };

  const model = new ChatBaiduWenxin({
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMEnd(output: LLMResult) {
        tokenUsage = output.llmOutput?.tokenUsage;
      },
    }),
  });
  const message = new HumanChatMessage("Hello");
  const res = await model.call([message]);
  console.log({ res });

  expect(tokenUsage.promptTokens).toBeGreaterThan(0);
});
