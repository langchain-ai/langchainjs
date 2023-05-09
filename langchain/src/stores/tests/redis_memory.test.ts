import { test, expect } from "@jest/globals";
import { createClient, RedisClientType } from "redis";
import { RedisChatMemory } from "../message/redis.js";
import { HumanChatMessage, AIChatMessage } from "../../schema/index.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { ConversationChain } from "../../chains/conversation.js";
import { BufferMemory } from "../../memory/buffer_memory.js";

test("Test Redis history store", async () => {
  const client = createClient();

  const memory = new RedisChatMemory(client as RedisClientType, {
    sessionId: "one",
  });

  const blankResult = await memory.getMessages();
  expect(blankResult).toStrictEqual([]);

  await memory.addUserMessage("Who is the best vocalist?");
  await memory.addAIChatMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanChatMessage("Who is the best vocalist?"),
    new AIChatMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await memory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);

  await client.flushDb();
  await client.disconnect();
});

test("Clear Redis history store", async () => {
  const client = createClient();

  const memory = new RedisChatMemory(client as RedisClientType, {
    sessionId: "two",
  });

  await memory.addUserMessage("Who is the best vocalist?");
  await memory.addAIChatMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanChatMessage("Who is the best vocalist?"),
    new AIChatMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await memory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);

  await memory.clear();

  const blankResult = await memory.getMessages();
  expect(blankResult).toStrictEqual([]);

  await client.flushDb();
  await client.disconnect();
});

test("Test Redis memory with Buffer Memory", async () => {
  const client = createClient();

  const memory = new BufferMemory({
    returnMessages: true,
    chatHistory: new RedisChatMemory(client as RedisClientType, {
      sessionId: "three",
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

  await client.flushDb();
  await client.disconnect();
});

test("Test Redis memory with LLM Chain", async () => {
  const client = createClient();

  const memory = new BufferMemory({
    chatHistory: new RedisChatMemory(client as RedisClientType, {
      sessionId: "four",
    }),
  });

  const model = new ChatOpenAI();
  const chain = new ConversationChain({ llm: model, memory });

  const res1 = await chain.call({ input: "Hi! I'm Jim." });
  console.log({ res1 });

  const res2 = await chain.call({ input: "What did I just say my name was?" });
  console.log({ res2 });

  await client.flushDb();
  await client.disconnect();
});
