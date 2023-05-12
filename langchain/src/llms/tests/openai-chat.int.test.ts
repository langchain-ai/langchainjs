import { expect, test } from "@jest/globals";
import { OpenAIChat } from "../openai-chat.js";
import { CallbackManager } from "../../callbacks/index.js";

test("Test OpenAI", async () => {
  const model = new OpenAIChat({ modelName: "gpt-3.5-turbo", maxTokens: 10 });
  const res = await model.call("Print hello world");
  console.log({ res });
});

test("Test OpenAI with prefix messages", async () => {
  const model = new OpenAIChat({
    prefixMessages: [
      { role: "user", content: "My name is John" },
      { role: "assistant", content: "Hi there" },
    ],
    maxTokens: 10,
  });
  const res = await model.call("What is my name");
  console.log({ res });
});

test("Test OpenAI in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new OpenAIChat({
    maxTokens: 10,
    modelName: "gpt-3.5-turbo",
    streaming: true,
    callbackManager: CallbackManager.fromHandlers({
      async handleLLMNewToken(token: string) {
        nrNewTokens += 1;
        streamedCompletion += token;
      },
    }),
  });
  const res = await model.call("Print hello world");
  console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
  expect(res).toBe(streamedCompletion);
}, 30000);

test("Test OpenAI with stop", async () => {
  const model = new OpenAIChat({ maxTokens: 5 });
  const res = await model.call("Print hello world", ["world"]);
  console.log({ res });
});

test("Test OpenAI with stop in object", async () => {
  const model = new OpenAIChat({ maxTokens: 5 });
  const res = await model.call("Print hello world", { stop: ["world"] });
  console.log({ res });
});

test("Test OpenAI with timeout in call options", async () => {
  const model = new OpenAIChat({ maxTokens: 5 });
  await expect(() =>
    model.call("Print hello world", {
      timeout: 10,
    })
  ).rejects.toThrow();
}, 5000);

test("Test OpenAI with timeout in call options and node adapter", async () => {
  const model = new OpenAIChat({ maxTokens: 5 });
  await expect(() =>
    model.call("Print hello world", {
      timeout: 10,
      options: { adapter: undefined },
    })
  ).rejects.toThrow();
}, 5000);

test("Test OpenAI with signal in call options", async () => {
  const model = new OpenAIChat({ maxTokens: 5 });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.call("Print hello world", {
      signal: controller.signal,
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);

test("Test OpenAI with signal in call options and node adapter", async () => {
  const model = new OpenAIChat({ maxTokens: 5 });
  const controller = new AbortController();
  await expect(() => {
    const ret = model.call("Print hello world", {
      signal: controller.signal,
      options: { adapter: undefined },
    });

    controller.abort();

    return ret;
  }).rejects.toThrow();
}, 5000);
