import { test, expect } from "@jest/globals";
import { ChatBaiduWenxin, WenxinModelName } from "../baiduwenxin.js";
import { HumanChatMessage, LLMResult } from "../../schema/index.js";
import { CallbackManager } from "../../callbacks/index.js";

test("Test ChatBaiduWenxin default model", async () => {
  const chat = new ChatBaiduWenxin();
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatBaiduWenxin ERNIE-Bot", async () => {
  const chat = new ChatBaiduWenxin({ modelName: WenxinModelName.ERNIE_BOT });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatBaiduWenxin ERNIE-Bot with temperature", async () => {
  const chat = new ChatBaiduWenxin({
    modelName: WenxinModelName.ERNIE_BOT,
    temperature: 1,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatBaiduWenxin ERNIE-Bot with topP", async () => {
  const chat = new ChatBaiduWenxin({
    modelName: WenxinModelName.ERNIE_BOT,
    topP: 1,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatBaiduWenxin ERNIE-Bot with penaltyScore", async () => {
  const chat = new ChatBaiduWenxin({
    modelName: WenxinModelName.ERNIE_BOT,
    penaltyScore: 1,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatBaiduWenxin ERNIE-Bot in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatBaiduWenxin({
    modelName: WenxinModelName.ERNIE_BOT,
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

test("Test ChatBaiduWenxin ERNIE-Bot-turbo", async () => {
  const chat = new ChatBaiduWenxin({
    modelName: WenxinModelName.ERNIE_BOT_TURBO,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatBaiduWenxin ERNIE-Bot-turbo in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatBaiduWenxin({
    modelName: WenxinModelName.ERNIE_BOT_TURBO,
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

test("Test ChatBaiduWenxin tokenUsage", async () => {
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
