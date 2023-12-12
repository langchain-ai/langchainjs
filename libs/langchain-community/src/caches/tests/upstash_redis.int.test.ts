/* eslint-disable no-process-env */
import { ChatOpenAI } from "@langchain/openai";
import { UpstashRedisCache } from "../upstash_redis.js";

/**
 * This test is a result of the `lookup` method trying to parse an
 * incorrectly typed value Before it was being typed as a string,
 * whereas in reality it was a JSON object.
 */
test.skip("UpstashRedisCache does not parse non string cached values", async () => {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN ||
    !process.env.OPENAI_API_KEY
  ) {
    throw new Error(
      "Missing Upstash Redis REST URL // REST TOKEN or OpenAI API key"
    );
  }
  const upstashRedisCache = new UpstashRedisCache({
    config: {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    },
  });

  const chat = new ChatOpenAI({
    temperature: 0,
    cache: upstashRedisCache,
    maxTokens: 10,
  });

  const prompt = "is the sky blue";
  const result1 = await chat.predict(prompt);
  const result2 = await chat.predict(prompt);

  expect(result1).toEqual(result2);
});
