import { createClient } from "redis";
import { test, expect } from "@jest/globals";

import { OpenAI } from "../../llms/openai.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { RedisCache } from "../redis.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any;

describe.skip("Test RedisCache", () => {
  beforeAll(async () => {
    client = createClient({ url: "redis://localhost:6379" });
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  test("RedisCache with an LLM", async () => {
    const cache = new RedisCache(client);

    const model = new OpenAI({ cache });
    const response1 = await model.invoke("Do something random!");
    const response2 = await model.invoke("Do something random!");
    expect(response1).toEqual(response2);
  });

  test("RedisCache with a chat model", async () => {
    const cache = new RedisCache(client);

    const model = new ChatOpenAI({ cache });
    const response1 = await model.invoke("Do something random!");
    const response2 = await model.invoke("Do something random!");
    expect(response1).not.toBeUndefined();
    expect(response1).toEqual(response2);
  });
});
