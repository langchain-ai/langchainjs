import { test, expect, describe } from "@jest/globals";

import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { UpstashRedisChatMessageHistory } from "../message/upstash_redis.js";

const config = {
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
};

describe.skip("UpstashRedisChatMessageHistory", () => {
  test("Test Redis Upstash history store", async () => {
    const chatHistory = new UpstashRedisChatMessageHistory({
      sessionId: new Date().toISOString(),
      config,
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

  test("Test clear Redis Upstash history store", async () => {
    const chatHistory = new UpstashRedisChatMessageHistory({
      sessionId: new Date().toISOString(),
      config,
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

  test("Test Redis Upstash history with a TTL", async () => {
    const chatHistory = new UpstashRedisChatMessageHistory({
      sessionId: new Date().toISOString(),
      sessionTTL: 5,
      config,
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

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const expiredResult = await chatHistory.getMessages();
    expect(expiredResult).toStrictEqual([]);
  });
});
