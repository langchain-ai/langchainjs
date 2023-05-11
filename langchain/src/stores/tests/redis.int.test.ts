/* eslint-disable no-promise-executor-return */

import { test, expect } from "@jest/globals";
import { createClient } from "redis";
import { RedisChatMessageHistory } from "../message/redis.js";
import { HumanChatMessage, AIChatMessage } from "../../schema/index.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { ConversationChain } from "../../chains/conversation.js";
import { BufferMemory } from "../../memory/buffer_memory.js";

afterAll(async () => {
  const client = createClient();
  await client.connect();
  await client.flushDb();
  await client.disconnect();
});

test.skip("Test Redis history store", async () => {
  const chatHistory = new RedisChatMessageHistory({
    sessionId: new Date().toISOString(),
  });

  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIChatMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanChatMessage("Who is the best vocalist?"),
    new AIChatMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);
});

test.skip("Test clear Redis history store", async () => {
  const chatHistory = new RedisChatMessageHistory({
    sessionId: new Date().toISOString(),
  });

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIChatMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanChatMessage("Who is the best vocalist?"),
    new AIChatMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);

  await chatHistory.clear();

  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);
});

test.skip("Test Redis history with a TTL", async () => {
  const chatHistory = new RedisChatMessageHistory({
    sessionId: new Date().toISOString(),
    sessionTTL: 5,
  });

  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIChatMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanChatMessage("Who is the best vocalist?"),
    new AIChatMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);

  await new Promise((resolve) => setTimeout(resolve, 5000));

  const expiredResult = await chatHistory.getMessages();
  expect(expiredResult).toStrictEqual([]);
});

test.skip("Test Redis memory with Buffer Memory", async () => {
  const memory = new BufferMemory({
    returnMessages: true,
    chatHistory: new RedisChatMessageHistory({
      sessionId: new Date().toISOString(),
    }),
  });

  await memory.saveContext(
    { input: "Who is the best vocalist?" },
    { response: "Ozzy Osbourne" }
  );

  const expectedHistory = [
    new HumanChatMessage("Who is the best vocalist?"),
    new AIChatMessage("Ozzy Osbourne"),
  ];

  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedHistory });
});

test.skip("Test Redis memory with LLM Chain", async () => {
  const memory = new BufferMemory({
    chatHistory: new RedisChatMessageHistory({
      sessionId: new Date().toISOString(),
    }),
  });

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0,
  });
  const chain = new ConversationChain({ llm: model, memory });

  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  console.log({ res1 });

  const res2 = await chain.call({ input: "What did I just say my name was?" });
  console.log({ res2 });
});
