import { test, expect } from "@jest/globals";
import { LLMResult } from "../../schema/index.js";
import { OpenAIChat } from "../openai-chat.js";
import { OpenAI } from "../openai.js";
import { StringPromptValue } from "../../prompts/index.js";
import { BaseCallbackHandler, CallbackManager } from "../../callbacks/index.js";

test("Test OpenAI", async () => {
  const model = new OpenAI({ maxTokens: 5, modelName: "text-ada-001" });
  const res = await model.call("Print hello world");
  console.log({ res });
});

test("Test OpenAI with concurrency == 1", async () => {
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "text-ada-001",
    maxConcurrency: 1,
  });
  const res = await Promise.all([
    model.call("Print hello world"),
    model.call("Print hello world"),
  ]);
  console.log({ res });
});

test("Test OpenAI with maxTokens -1", async () => {
  const model = new OpenAI({ maxTokens: -1, modelName: "text-ada-001" });
  const res = await model.call("Print hello world", ["world"]);
  console.log({ res });
});

test("Test OpenAI with chat model returns OpenAIChat", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo" });
  expect(model).toBeInstanceOf(OpenAIChat);
  const res = await model.call("Print hello world");
  console.log({ res });
  expect(typeof res).toBe("string");
});

test("Test ChatOpenAI tokenUsage", async () => {
  let tokenUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };

  const model = new OpenAI({
    maxTokens: 5,
    modelName: "text-ada-001",
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMEnd(output: LLMResult) {
        tokenUsage = output.llmOutput?.tokenUsage;
      },
    }),
  });
  const res = await model.call("Hello");
  console.log({ res });

  expect(tokenUsage.promptTokens).toBe(1);
});

test("Test OpenAI in streaming mode", async () => {
  class StreamCallbackHandler extends BaseCallbackHandler {
    nrNewTokens = 0;

    streamedCompletion = "";

    async handleLLMNewToken(token: string) {
      this.nrNewTokens += 1;
      this.streamedCompletion += token;
    }
  }

  const streamCallbackHandler = new StreamCallbackHandler();
  const callbackManager = new CallbackManager();
  callbackManager.addHandler(streamCallbackHandler);
  const model = new OpenAI({
    maxTokens: 5,
    modelName: "text-ada-001",
    streaming: true,
    callbackManager,
  });
  const res = await model.call("Print hello world");
  console.log({ res });

  expect(streamCallbackHandler.nrNewTokens > 0).toBe(true);
  expect(res).toBe(streamCallbackHandler.streamedCompletion);
});

test("Test OpenAI prompt value", async () => {
  const model = new OpenAI({ maxTokens: 5, modelName: "text-ada-001" });
  const res = await model.generatePrompt([
    new StringPromptValue("Print hello world"),
  ]);
  expect(res.generations.length).toBe(1);
  for (const generation of res.generations) {
    expect(generation.length).toBe(1);
    for (const g of generation) {
      console.log(g.text);
    }
  }
  console.log({ res });
});
