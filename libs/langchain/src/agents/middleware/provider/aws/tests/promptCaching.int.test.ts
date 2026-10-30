import { describe, it, expect } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatBedrockConverse } from "@langchain/aws";

import { bedrockPromptCachingMiddleware } from "../promptCaching.js";
import { createAgent } from "../../../../index.js";
import { initChatModel } from "../../../../../chat_models/universal.js";

const MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0";
const REGION = process.env.BEDROCK_AWS_REGION ?? "us-east-1";
const credentials = {
  secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY!,
  accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID!,
};

// A large, stable prefix so the cached prefix comfortably exceeds Bedrock's
// minimum cacheable token count (~4k tokens for Haiku 4.5; below it caching is
// a silent no-op).
const longContext =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(500);

const messages = [
  new HumanMessage(longContext),
  new HumanMessage("What is the capital of France?"),
];

/**
 * Total cache tokens (read + creation) reported across the AI messages in an
 * agent result. A positive value in either of these indicates that caching
 * is engaged
 */
function cachedTokens(result: { messages: unknown[] }): number {
  return result.messages
    .filter((m): m is AIMessage => AIMessage.isInstance(m))
    .reduce((sum, m) => {
      const details = m.usage_metadata?.input_token_details;
      return sum + (details?.cache_read ?? 0) + (details?.cache_creation ?? 0);
    }, 0);
}

describe("bedrockPromptCachingMiddleware (integration)", () => {
  it("caches tokens when the model is an instance", async () => {
    const model = new ChatBedrockConverse({
      model: MODEL,
      region: REGION,
      credentials,
    });

    const agent = createAgent({
      model,
      systemPrompt: "You are a geography expert.",
      middleware: [
        bedrockPromptCachingMiddleware({
          ttl: "5m",
          minMessagesToCache: 1,
        }),
      ] as const,
    });

    const result = await agent.invoke({ messages });

    expect(cachedTokens(result)).toBeGreaterThan(1024);
  });

  it("caches tokens when the model is resolved from a `bedrock:` string", async () => {
    const model = await initChatModel(`bedrock:${MODEL}`, {
      region: REGION,
      credentials,
    });

    const agent = createAgent({
      model,
      systemPrompt: "You are a geography expert.",
      middleware: [bedrockPromptCachingMiddleware()] as const,
    });

    const result = await agent.invoke({ messages });

    expect(cachedTokens(result)).toBeGreaterThan(1024);
  });

  it("caches tokens when the model is resolved from an `aws:` string", async () => {
    const model = await initChatModel(`aws:${MODEL}`, {
      region: REGION,
      credentials,
    });

    const agent = createAgent({
      model,
      systemPrompt: "You are a geography expert.",
      middleware: [bedrockPromptCachingMiddleware()] as const,
    });

    const result = await agent.invoke({ messages });

    expect(cachedTokens(result)).toBeGreaterThan(1024);
  });

  it("short-circuits for a non-Anthropic, non-Nova Bedrock model", async () => {
    const model = new ChatBedrockConverse({
      model: "us.meta.llama3-3-70b-instruct-v1:0",
      region: REGION,
      credentials,
    });

    const agent = createAgent({
      model,
      middleware: [
        bedrockPromptCachingMiddleware({ unsupportedModelBehavior: "raise" }),
      ] as const,
    });

    await expect(
      agent.invoke({ messages: [new HumanMessage("hi")] })
    ).rejects.toThrow(/Bedrock prompt caching/);
  });
});
