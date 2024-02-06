/* eslint-disable no-promise-executor-return */

import { test, expect } from "@jest/globals";
import { createClient } from "redis";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { RedisChatMessageHistory } from "../chat_histories.js";

afterAll(async () => {
  const client = createClient();
  await client.connect();
  await client.flushDb();
  await client.disconnect();
});

/**
 * To run this integration test, you need to have a Redis server running locally.
 *
 * `docker run -p 6379:6379 -p 8001:8001 redis/redis-stack:latest`
 */

test("Test Redis history store", async () => {
  const chatHistory = new RedisChatMessageHistory({
    sessionId: new Date().toISOString(),
  });

  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIChatMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);
});

test("Test clear Redis history store", async () => {
  const chatHistory = new RedisChatMessageHistory({
    sessionId: new Date().toISOString(),
  });

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIChatMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);

  await chatHistory.clear();

  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);
});

test("Test Redis history with a TTL", async () => {
  const chatHistory = new RedisChatMessageHistory({
    sessionId: new Date().toISOString(),
    sessionTTL: 5,
  });

  const blankResult = await chatHistory.getMessages();
  expect(blankResult).toStrictEqual([]);

  await chatHistory.addUserMessage("Who is the best vocalist?");
  await chatHistory.addAIChatMessage("Ozzy Osbourne");

  const expectedMessages = [
    new HumanMessage("Who is the best vocalist?"),
    new AIMessage("Ozzy Osbourne"),
  ];

  const resultWithHistory = await chatHistory.getMessages();
  expect(resultWithHistory).toEqual(expectedMessages);

  await new Promise((resolve) => setTimeout(resolve, 6000));

  const expiredResult = await chatHistory.getMessages();
  expect(expiredResult).toStrictEqual([]);
});
