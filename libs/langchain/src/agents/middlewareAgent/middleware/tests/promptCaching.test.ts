import { describe, it, expect, vi, type MockInstance } from "vitest";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import { ChatOpenAI } from "@langchain/openai";

import { anthropicPromptCachingMiddleware } from "../promptCaching.js";
import { createAgent } from "../../index.js";

function createMockAnthropicModel() {
  // Mock Anthropic model
  const invokeCallback = vi
    .fn()
    .mockResolvedValue(new AIMessage("Response from model"));
  return {
    getName: () => "ChatAnthropic",
    bindTools: vi.fn().mockReturnThis(),
    _streamResponseChunks: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: invokeCallback,
    lc_runnable: true,
    _modelType: "anthropic",
    _generate: vi.fn(),
    _llmType: () => "anthropic",
  } as unknown as LanguageModelLike;
}

describe("anthropicPromptCachingMiddleware", () => {
  it("should add cache_control to model settings when conditions are met", async () => {
    const model = createMockAnthropicModel();

    const middleware = anthropicPromptCachingMiddleware({
      ttl: "5m",
      minMessagesToCache: 3,
    });

    const agent = createAgent({
      model,
      middleware: [middleware] as const,
    });

    // Test with enough messages to trigger caching
    const messages = [
      new SystemMessage("You are a helpful assistant"),
      new HumanMessage("Hello"),
      new AIMessage("Hi there!"),
      new HumanMessage("How are you?"),
      new AIMessage("I'm doing well, thanks!"),
      new HumanMessage("What's the weather like?"),
    ];

    await agent.invoke({ messages });

    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const lastMessage = callArgs[0].at(-1);
    expect(lastMessage.content[0]).toHaveProperty("cache_control");
    expect(lastMessage.content[0].cache_control).toEqual({
      type: "ephemeral",
      ttl: "5m",
    });
  });

  it("should not add cache_control when message count is below threshold", async () => {
    const model = createMockAnthropicModel();
    const middleware = anthropicPromptCachingMiddleware({
      ttl: "1h",
      minMessagesToCache: 5, // High threshold
    });

    const agent = createAgent({
      model,
      middleware: [middleware] as const,
    });

    // Test with fewer messages than threshold
    const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

    await agent.invoke({ messages });

    // Verify the model was called without cache_control
    expect(model.invoke).toHaveBeenCalled();
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const lastMessage = callArgs[0].at(-1);
    expect(lastMessage.content[0]).not.toHaveProperty("cache_control");
  });

  it("should respect enableCaching setting", async () => {
    const model = createMockAnthropicModel();
    const middleware = anthropicPromptCachingMiddleware({
      enableCaching: false, // Disabled
      ttl: "5m",
      minMessagesToCache: 1,
    });

    const agent = createAgent({
      model,
      middleware: [middleware] as const,
    });

    const messages = [
      new HumanMessage("Hello"),
      new AIMessage("Hi there!"),
      new HumanMessage("How are you?"),
    ];

    await agent.invoke({ messages });

    // Verify no cache_control was added
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const lastMessage = callArgs[0].at(-1);
    expect(lastMessage.content[0]).not.toHaveProperty("cache_control");
  });

  describe("non-Anthropic models", () => {
    it("should throw error if pass in a non-Anthropic chat instance", async () => {
      const middleware = anthropicPromptCachingMiddleware();

      const agent = createAgent({
        model: new ChatOpenAI({ model: "gpt-4o" }),
        middleware: [middleware] as const,
      });

      // Should throw error
      await expect(agent.invoke({ messages: [] })).rejects.toThrow(
        "Prompt caching is only supported for Anthropic models"
      );
    });

    it("should throw error if pass in a non-Anthropic model via string", async () => {
      const middleware = anthropicPromptCachingMiddleware();

      const agent = createAgent({
        model: "openai:gpt-4o",
        middleware: [middleware] as const,
      });

      // Should throw error
      await expect(agent.invoke({ messages: [] })).rejects.toThrow(
        "Prompt caching is only supported for Anthropic models"
      );
    });
  });

  it("should include system message in message count", async () => {
    const model = createMockAnthropicModel();
    const middleware = anthropicPromptCachingMiddleware({
      ttl: "1h",
      minMessagesToCache: 3,
    });

    const agent = createAgent({
      model,
      prompt: "You are a helpful assistant", // Counts as 1 message
      middleware: [middleware] as const,
    });

    // Only 2 user messages, but with system message makes 3 total
    const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

    await agent.invoke({ messages });

    // Should have cache_control because total count is 3
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const [systemMessage] = callArgs[0];
    expect(systemMessage.type).toBe("system");
    expect(systemMessage.content).toBe("You are a helpful assistant");
  });

  it("should allow runtime context override", async () => {
    const model = createMockAnthropicModel();
    const middleware = anthropicPromptCachingMiddleware({
      ttl: "5m",
      minMessagesToCache: 3,
    });

    const agent = createAgent({
      model,
      middleware: [middleware] as const,
    });

    const messages = [
      new HumanMessage("Hello"),
      new AIMessage("Hi there!"),
      new HumanMessage("How are you?"),
      new AIMessage("I'm doing well, thanks!"),
      new HumanMessage("What's the weather like?"),
    ];

    // Override at runtime to disable caching
    await agent.invoke(
      { messages },
      {
        context: {
          enableCaching: false,
        },
      }
    );

    // Should not have cache_control because caching was disabled at runtime
    const callArgs = (model.invoke as unknown as MockInstance).mock.calls[0];
    const [firstMessage] = callArgs[0];
    expect(firstMessage.content).toEqual("Hello");
  });
});
