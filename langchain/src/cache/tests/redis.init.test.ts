/* eslint-disable no-process-env */
/* eslint-disable no-promise-executor-return */

import { test, expect } from "@jest/globals";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { RedisSemanticCache } from "../redis.js";

describe("RedisVectorStore", () => {
  let semanticCache: RedisSemanticCache;
  let redisURL: string;

  beforeEach(async () => {
    if (!process.env.REDIS_URL) {
      throw new Error("REDIS_URL must be set");
    }
    redisURL = process.env.REDIS_URL;

    semanticCache = new RedisSemanticCache(
      redisURL,
      new OpenAIEmbeddings(),
      0.01
    );
  });

  test.only("can perform an update with new generations", async () => {
    const llmKey = "llm:key";
    const prompt = "Who killed John F. Kennedy?";
    const generation = {
      text: "Lee Harvey Oswald",
    };

    await semanticCache.update(prompt, llmKey, [generation]);

    // Check with the exact same prompt. This test is not checking
    // similarity search, but rather that the cache is working.
    const results = await semanticCache.lookup(prompt, llmKey);

    expect(results).toHaveLength(1);
    expect(results).toEqual(
      expect.arrayContaining([expect.objectContaining(generation)])
    );
  });

  test("can perform a semantic search cache lookup", async () => {
    const llmKey = "llm:key";
    const initialPrompt = "Who killed John F. Kennedy?";
    const searchPrompt = "Who was John F. Kennedy's murderer?";
    const initialGeneration = {
      text: "Lee Harvey Oswald",
    };

    // Add two to ensure it's not just returning the same generation.
    await semanticCache.update(initialPrompt, llmKey, [initialGeneration]);
    await semanticCache.update("Is TypeScript better than Python?", llmKey, [
      {
        text: "Yes, TypeScript is better than Python.",
      },
    ]);

    const results = await semanticCache.lookup(searchPrompt, llmKey);

    expect(results).toHaveLength(1);
    expect(results).toEqual(
      expect.arrayContaining([expect.objectContaining(initialGeneration)])
    );
  });

  test("can clear cache", async () => {
    const llmKey = "llm:key";

    await Promise.all([
      semanticCache.update("prompt test 1", llmKey, [
        { text: "generation test 1" },
      ]),
      semanticCache.update("prompt test 1", llmKey, [
        { text: "generation test 1" },
      ]),
      semanticCache.update("prompt test 1", llmKey, [
        { text: "generation test 1" },
      ]),
    ]);

    await semanticCache.clear(llmKey);

    const results = await semanticCache.lookup("prompt test 1", llmKey);

    expect(results).toBeNull();
  });
});
