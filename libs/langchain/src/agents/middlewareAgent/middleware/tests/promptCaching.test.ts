/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { anthropicPromptCachingMiddleware } from "../promptCaching.js";
import { createAgent } from "../../index.js";

function createMockAnthropicModel() {
  // Mock Anthropic model
  const invokeCallback = vi
    .fn()
    .mockResolvedValue(new AIMessage("Response from model"));
  return {
    getName: () => "anthropic",
    bindTools: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: invokeCallback,
    lc_runnable: true,
    _modelType: "anthropic",
    _generate: vi.fn(),
    _llmType: () => "anthropic",
  };
}

describe("anthropicPromptCachingMiddleware", () => {
  it("should add cache_control to model settings when conditions are met", async () => {
    const mockAnthropicModel = createMockAnthropicModel();

    const middleware = anthropicPromptCachingMiddleware({
      ttl: "5m",
      minMessagesToCache: 3,
    });

    const agent = createAgent({
      llm: mockAnthropicModel as any,
      middleware: [middleware] as const,
    });

    // Test with enough messages to trigger caching
    const messages = [
      new HumanMessage("Hello"),
      new AIMessage("Hi there!"),
      new HumanMessage("How are you?"),
      new AIMessage("I'm doing well, thanks!"),
      new HumanMessage("What's the weather like?"),
    ];

    await agent.invoke({ messages });

    // Verify the model was called with cache_control in modelSettings
    expect(mockAnthropicModel.invoke).toHaveBeenCalled();
    const callArgs = mockAnthropicModel.bindTools.mock.calls[0];
    const modelOptions = callArgs[1];
    expect(modelOptions).toHaveProperty("cache_control");
    expect(modelOptions.cache_control).toEqual({
      type: "ephemeral",
      ttl: "5m",
    });
  });

  it("should not add cache_control when message count is below threshold", async () => {
    const mockAnthropicModel = createMockAnthropicModel();
    const middleware = anthropicPromptCachingMiddleware({
      ttl: "1h",
      minMessagesToCache: 5, // High threshold
    });

    const agent = createAgent({
      llm: mockAnthropicModel as any,
      middleware: [middleware] as const,
    });

    // Test with fewer messages than threshold
    const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

    await agent.invoke({ messages });

    // Verify the model was called without cache_control
    expect(mockAnthropicModel.invoke).toHaveBeenCalled();
    const callArgs = mockAnthropicModel.bindTools.mock.calls[0];
    const modelRequest = callArgs[1];

    // Should not have modelSettings or cache_control
    expect(modelRequest.modelSettings).toBeUndefined();
  });

  it("should respect enableCaching setting", async () => {
    const mockAnthropicModel = createMockAnthropicModel();
    const middleware = anthropicPromptCachingMiddleware({
      enableCaching: false, // Disabled
      ttl: "5m",
      minMessagesToCache: 1,
    });

    const agent = createAgent({
      llm: mockAnthropicModel as any,
      middleware: [middleware] as const,
    });

    const messages = [
      new HumanMessage("Hello"),
      new AIMessage("Hi there!"),
      new HumanMessage("How are you?"),
    ];

    await agent.invoke({ messages });

    // Verify no cache_control was added
    const callArgs = mockAnthropicModel.bindTools.mock.calls[0];
    const modelRequest = callArgs[1];
    expect(modelRequest.modelSettings).toBeUndefined();
  });

  it("should throw error for non-Anthropic models", async () => {
    const mockNonAnthropicModel = createMockAnthropicModel();
    mockNonAnthropicModel.getName = () => "openai"; // Not Anthropic
    const middleware = anthropicPromptCachingMiddleware();

    const agent = createAgent({
      llm: mockNonAnthropicModel as any,
      middleware: [middleware] as const,
    });

    const messages = [
      new HumanMessage("Hello"),
      new AIMessage("Hi there!"),
      new HumanMessage("How are you?"),
    ];

    // Should throw error
    await expect(agent.invoke({ messages })).rejects.toThrow(
      "Prompt caching is only supported for Anthropic models"
    );
  });

  it("should include system message in message count", async () => {
    const mockAnthropicModel = createMockAnthropicModel();
    const middleware = anthropicPromptCachingMiddleware({
      ttl: "1h",
      minMessagesToCache: 3,
    });

    const agent = createAgent({
      llm: mockAnthropicModel as any,
      prompt: "You are a helpful assistant", // Counts as 1 message
      middleware: [middleware] as const,
    });

    // Only 2 user messages, but with system message makes 3 total
    const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

    await agent.invoke({ messages });

    // Should have cache_control because total count is 3
    const callArgs = mockAnthropicModel.bindTools.mock.calls[0];
    const modelOptions = callArgs[1];
    expect(modelOptions).toHaveProperty("cache_control");
    expect(modelOptions.cache_control).toEqual({
      type: "ephemeral",
      ttl: "5m",
    });
  });

  it("should allow runtime context override", async () => {
    const mockAnthropicModel = createMockAnthropicModel();
    const middleware = anthropicPromptCachingMiddleware({
      ttl: "5m",
      minMessagesToCache: 3,
    });

    const agent = createAgent({
      llm: mockAnthropicModel as any,
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
    const callArgs = mockAnthropicModel.bindTools.mock.calls[0];
    const modelOptions = callArgs[1];
    expect(modelOptions).not.toHaveProperty("cache_control");
  });
});
