import { Redis } from "ioredis";
import { test, expect } from "@jest/globals";

import { OpenAI, ChatOpenAI } from "@langchain/openai";
import { RedisCache } from "../ioredis.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any;

describe("Test RedisCache", () => {
  beforeAll(async () => {
    client = new Redis("redis://localhost:6379");
  });

  afterAll(async () => {
    await client.disconnect();
  });

  test("RedisCache with an LLM", async () => {
    const cache = new RedisCache(client, {
      ttl: 60,
    });

    const model = new OpenAI({ model: "gpt-4o-mini", cache });
    const response1 = await model.invoke("What is something random?");
    const response2 = await model.invoke("What is something random?");
    expect(response1).toEqual(response2);
  });

  test("RedisCache with a chat model", async () => {
    const cache = new RedisCache(client, {
      ttl: 60,
    });

    const model = new ChatOpenAI({ model: "gpt-4o-mini", cache });
    const response1 = await model.invoke("What is something random?");
    const response2 = await model.invoke("What is something random?");
    expect(response1).not.toBeUndefined();
    expect(JSON.stringify(response1)).toEqual(JSON.stringify(response2));
  });
});
