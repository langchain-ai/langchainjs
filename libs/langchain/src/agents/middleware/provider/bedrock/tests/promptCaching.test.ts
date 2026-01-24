import { test, expect, describe, vi } from "vitest";
import { bedrockPromptCachingMiddleware } from "../promptCaching";

// --- FIXED MOCK SETUP ---
const createMockRunnable = () => {
  return {
    // FIX: Added a check "if (!input)" to prevent crashing on undefined
    invoke: vi.fn(async (input: any) => {
      if (!input) return input;
      return input.messages || input;
    }),
    bind: function () {
      return this;
    },
    clone: function () {
      return { ...this };
    },
  } as any;
};

const createMsg = (type: "human" | "ai" | "system" | "tool", content: any) => ({
  _getType: () => type,
  type,
  content,
  additional_kwargs: {},
});

describe("Bedrock Prompt Caching Middleware (Edge Case Stress Test)", () => {
  test("✅ HAPPY PATH: Should cache the last message when threshold is met", async () => {
    const model = createMockRunnable();
    const middleware = bedrockPromptCachingMiddleware({
      minMessagesToCache: 2,
    });
    const runnable = middleware(model);

    const messages = [
      createMsg("system", "You are a bot"),
      createMsg("human", "Hello"),
      createMsg("ai", "Hi there"),
      createMsg("human", "Cache this please!"),
    ];

    await runnable.invoke({ messages });

    const lastMsg = messages[3];
    expect(lastMsg.additional_kwargs.cache_control).toEqual({
      type: "ephemeral",
    });
  });

  test("🛑 THRESHOLD CHECK: Should NOT cache if message count is too low", async () => {
    const model = createMockRunnable();
    const middleware = bedrockPromptCachingMiddleware({
      minMessagesToCache: 5,
    });
    const runnable = middleware(model);

    const messages = [
      createMsg("human", "Just one message"),
      createMsg("ai", "And a response"),
    ];

    await runnable.invoke({ messages });

    expect(messages[0].additional_kwargs.cache_control).toBeUndefined();
  });

  test("🔌 DISABLE SWITCH: Should do nothing if enableCaching is false", async () => {
    const model = createMockRunnable();
    const middleware = bedrockPromptCachingMiddleware({ enableCaching: false });
    const runnable = middleware(model);

    const messages = [
      createMsg("human", "Hello"),
      createMsg("ai", "Hi"),
      createMsg("human", "Don't cache me"),
    ];

    await runnable.invoke({ messages });

    expect(messages[2].additional_kwargs.cache_control).toBeUndefined();
  });

  test("🛡️ SAFETY CHECK: Should handle empty or undefined inputs gracefully", async () => {
    const model = createMockRunnable();
    const middleware = bedrockPromptCachingMiddleware();
    const runnable = middleware(model);

    // 1. Empty array
    await expect(runnable.invoke([])).resolves.not.toThrow();

    // 2. Undefined input (This was failing because the Mock was bad)
    await expect(runnable.invoke(undefined)).resolves.not.toThrow();

    // 3. Object without messages
    await expect(runnable.invoke({ unrelated: "data" })).resolves.not.toThrow();
  });
  
  test("🧱 NON-TEXT CONTENT: Should skip messages with complex content", async () => {
    const model = createMockRunnable();
    const middleware = bedrockPromptCachingMiddleware({
      minMessagesToCache: 1,
    });
    const runnable = middleware(model);

    const messages = [
      createMsg("human", "Text message"),
      createMsg("human", [{ type: "image_url", url: "..." }]),
    ];

    await runnable.invoke({ messages });

    // Should skip the image (index 1) and cache the text (index 0)
    expect(messages[1].additional_kwargs.cache_control).toBeUndefined();
    expect(messages[0].additional_kwargs.cache_control).toEqual({
      type: "ephemeral",
    });
  });

  test("🔧 TOOL MESSAGES: Should skip Tool/Function messages", async () => {
    const model = createMockRunnable();
    const middleware = bedrockPromptCachingMiddleware({
      minMessagesToCache: 1,
    });
    const runnable = middleware(model);

    const messages = [
      createMsg("human", "Please help"),
      createMsg("tool", "Tool Output Result"),
    ];

    await runnable.invoke({ messages });

    expect(messages[1].additional_kwargs.cache_control).toBeUndefined();
    expect(messages[0].additional_kwargs.cache_control).toEqual({
      type: "ephemeral",
    });
  });

  test("📦 ARRAY INPUT: Should handle raw array input", async () => {
    const model = createMockRunnable();
    const middleware = bedrockPromptCachingMiddleware({
      minMessagesToCache: 1,
    });
    const runnable = middleware(model);

    const messages = [createMsg("human", "Raw array input")];

    await runnable.invoke(messages);

    expect(messages[0].additional_kwargs.cache_control).toEqual({
      type: "ephemeral",
    });
  });
});
