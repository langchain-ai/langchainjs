import { test, expect } from "@jest/globals";
import type { RedisClientType } from "redis";
import { createClient } from "redis";
import { RedisMemory } from "../redis_memory.js";
import { HumanChatMessage, AIChatMessage } from "../../schema/index.js";

test("Test Redis memory without messages", async () => {
  const client = createClient();

  const memory = new RedisMemory(client as RedisClientType, {
    sessionId: "one",
  });
  await memory.init();
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: "" });

  await memory.saveContext(
    { input: "Who is the best vocalist?" },
    { response: "Ozzy Osbourne" }
  );
  const expectedString = "Human: Who is the best vocalist?\nAI: Ozzy Osbourne";
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: expectedString });
  await client.flushDb();
  await client.disconnect();
});

test("Test Redis memory with messages", async () => {
  const client = createClient();

  const memory = new RedisMemory(client as RedisClientType, {
    returnMessages: true,
    sessionId: "two",
  });
  await memory.init();
  const result1 = await memory.loadMemoryVariables({});
  expect(result1).toStrictEqual({ history: [] });

  await memory.saveContext(
    { input: "Who is the best vocalist?" },
    { response: "Ozzy Osbourne" }
  );
  const expectedHuman = new HumanChatMessage("Who is the best vocalist?");
  const expectedAI = new AIChatMessage("Ozzy Osbourne");
  const result2 = await memory.loadMemoryVariables({});
  expect(result2).toStrictEqual({ history: [expectedHuman, expectedAI] });
  await client.flushDb();
  await client.disconnect();
});

test("Test Redis memory with pre-loaded history", async () => {
  const sessionIdentifier = "three";
  const client = createClient();
  await client.connect();
  const pastMessages = [
    JSON.stringify({ role: "Human", content: "My name is Ozzy" }),
    JSON.stringify({ role: "AI", content: "Nice to meet you, Ozzy!" }),
  ];
  await client.lPush(`history${sessionIdentifier}`, pastMessages);
  await client.disconnect();

  const memory = new RedisMemory(client as RedisClientType, {
    returnMessages: true,
    sessionId: sessionIdentifier,
  });

  await memory.init();
  const result = await memory.loadMemoryVariables({});
  const expectedHuman = new HumanChatMessage("My name is Ozzy");
  const expectedAI = new AIChatMessage("Nice to meet you, Ozzy!");
  expect(result).toStrictEqual({ history: [expectedHuman, expectedAI] });
  await client.flushDb();
  await client.disconnect();
});
