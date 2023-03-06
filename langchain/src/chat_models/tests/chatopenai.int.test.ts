import { test, expect } from "@jest/globals";
import { ChatOpenAI } from "../openai.js";
import { HumanChatMessage, SystemChatMessage } from "../../schema/index.js";
import { ChatPromptValue } from "../../prompts/chat.js";

test("Test ChatOpenAI", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", maxTokens: 10 });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([message]);
  console.log({ res });
});

test("Test ChatOpenAI with SystemChatMessage", async () => {
  const chat = new ChatOpenAI({ modelName: "gpt-3.5-turbo", maxTokens: 10 });
  const system_message = new SystemChatMessage("You are to chat with a user.");
  const message = new HumanChatMessage("Hello!");
  const res = await chat.call([system_message, message]);
  console.log({ res });
});

test("Test ChatOpenAI Generate", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.generate([[message], [message]]);
  expect(res.generations.length).toBe(2);
  for (const generation of res.generations) {
    expect(generation.length).toBe(2);
    for (const message of generation) {
      console.log(message.text);
    }
  }
  console.log({ res });
});

test("Test ChatOpenAI in streaming mode", async () => {
  let nrNewTokens = 0;
  let streamedCompletion = "";

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    streaming: true,
    callbackManager: {
      handleNewToken(token) {
        nrNewTokens += 1;
        streamedCompletion += token;
      },
    },
  });
  const message = new HumanChatMessage("Hello!");
  const res = await model.call([message]);
  console.log({ res });

  expect(nrNewTokens > 0).toBe(true);
  expect(res.text).toBe(streamedCompletion);
});

test("Test ChatOpenAI prompt value", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    maxTokens: 10,
    n: 2,
  });
  const message = new HumanChatMessage("Hello!");
  const res = await chat.generatePrompt([new ChatPromptValue([message])]);
  expect(res.generations.length).toBe(1);
  for (const generation of res.generations) {
    expect(generation.length).toBe(2);
    for (const g of generation) {
      console.log(g.text);
    }
  }
  console.log({ res });
});
