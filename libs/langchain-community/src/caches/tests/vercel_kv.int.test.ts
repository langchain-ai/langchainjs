/* eslint-disable no-process-env */
import { ChatOpenAI } from "@langchain/openai";
import { createClient } from "@vercel/kv";
import { VercelKVCache } from "../vercel_kv.js";

test("VercelKVCache works with ChatOpenAI", async () => {
  if (
    !process.env.VERCEL_KV_API_URL ||
    !process.env.VERCEL_KV_API_TOKEN ||
    !process.env.OPENAI_API_KEY
  ) {
    throw new Error("Missing Vercel KV API URL, token, or OpenAI API key");
  }

  const vercelKVCache = new VercelKVCache({
    client: createClient({
      url: process.env.VERCEL_KV_API_URL,
      token: process.env.VERCEL_KV_API_TOKEN,
    }),
    ttl: 60,
  });

  const chat = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    cache: vercelKVCache,
    maxTokens: 10,
  });

  const prompt = "What color is the sky?";
  const result1 = await chat.invoke(prompt);
  const result2 = await chat.invoke(prompt);

  expect(result1).toEqual(result2);
});
