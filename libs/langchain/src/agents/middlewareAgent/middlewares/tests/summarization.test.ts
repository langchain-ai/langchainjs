/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
  isSystemMessage,
  isAIMessage,
  isToolMessage,
} from "@langchain/core/messages";
import {
  summarizationMiddleware,
  countTokensApproximately,
} from "../summarization.js";
import { createAgent } from "../../index.js";
import { FakeToolCallingChatModel } from "../../../tests/utils.js";

describe("summarizationMiddleware", () => {
  // Mock summarization model
  function createMockSummarizationModel() {
    const invokeCallback = vi
      .fn()
      .mockImplementation(async (prompt: string) => {
        // Extract messages from prompt to create a realistic summary
        if (prompt.includes("Context Extraction Assistant")) {
          return {
            content:
              "Previous conversation covered: project architecture discussion, challenges with scalability, and recommendations for improvement. Key decisions: use microservices, implement caching, optimize database queries.",
          };
        }
        return { content: "Summary of previous conversation." };
      });

    return {
      invoke: invokeCallback,
      getName: () => "mock-summarizer",
      _modelType: "mock",
      lc_runnable: true,
    };
  }

  // Helper to create a mock main model
  function createMockMainModel() {
    const responses = [
      new AIMessage(
        "I understand your project. Let me analyze the architecture."
      ),
      new AIMessage({
        content: "I'll check the weather for you.",
        tool_calls: [
          { id: "call_1", name: "get_weather", args: { location: "NYC" } },
        ],
      }),
      new AIMessage("Based on the weather data, it's sunny in NYC."),
      new AIMessage(
        "Here's my recommendation based on everything we discussed."
      ),
    ];

    return new FakeToolCallingChatModel({
      responses,
    });
  }

  it("should trigger summarization when token count exceeds threshold", async () => {
    const summarizationModel = createMockSummarizationModel();
    const mainModel = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      maxTokensBeforeSummary: 200, // Low threshold to trigger easily
      messagesToKeep: 3,
      tokenCounter: countTokensApproximately,
    });

    const agent = createAgent({
      llm: mainModel,
      middlewares: [middleware] as const,
    });

    // Create a conversation with enough tokens to trigger summarization
    const messages = [
      new HumanMessage(
        `I'm working on a complex software project. ${"x".repeat(200)}`
      ),
      new AIMessage(
        `I understand your project. Let me help. ${"x".repeat(200)}`
      ),
      new HumanMessage(
        `Here are more details about the architecture. ${"x".repeat(200)}`
      ),
      new AIMessage(`That's interesting. Tell me more. ${"x".repeat(200)}`),
      new HumanMessage("What do you recommend?"),
    ];

    const result = await agent.invoke({ messages });

    // Verify summarization model was called
    expect(summarizationModel.invoke).toHaveBeenCalled();

    // Verify the result has a system message with summary
    expect(result.messages[0]).toBeInstanceOf(SystemMessage);
    const systemMessage = result.messages[0] as SystemMessage;
    expect(systemMessage.content).toContain(
      "## Previous conversation summary:"
    );
    expect(systemMessage.content).toContain("Previous conversation covered:");

    // Verify only recent messages are kept (plus the new response)
    expect(result.messages.length).toBeLessThanOrEqual(5); // system + kept messages + new response
  });

  it("should not trigger summarization when below token threshold", async () => {
    const summarizationModel = createMockSummarizationModel();
    const mainModel = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      maxTokensBeforeSummary: 5000, // High threshold
      messagesToKeep: 10,
    });

    const agent = createAgent({
      llm: mainModel,
      middlewares: [middleware] as const,
    });

    // Short conversation
    const messages = [
      new HumanMessage("Hello"),
      new AIMessage("Hi there!"),
      new HumanMessage("How are you?"),
    ];

    const result = await agent.invoke({ messages });

    // Verify summarization was NOT triggered
    expect(summarizationModel.invoke).not.toHaveBeenCalled();

    // All messages should be preserved
    expect(result.messages.length).toBe(4); // 3 original + 1 new response
  });

  it("should preserve AI/Tool message pairs together", async () => {
    const summarizationModel = createMockSummarizationModel();

    // Create a model that returns tool calls
    const toolCallMessage = new AIMessage({
      content: "Let me check the weather.",
      tool_calls: [
        { id: "call_123", name: "get_weather", args: { location: "Paris" } },
      ],
    });

    const mainModel = new FakeToolCallingChatModel({
      responses: [
        new AIMessage("Based on the weather, I recommend taking an umbrella."),
      ],
    });

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      maxTokensBeforeSummary: 400,
      messagesToKeep: 4, // Should keep the AI/Tool pair together
    });

    const agent = createAgent({
      llm: mainModel,
      middlewares: [middleware] as const,
    });

    // Create messages with AI/Tool pairs that should stay together
    const messages = [
      new HumanMessage(`Old conversation part 1. ${"x".repeat(100)}`),
      new AIMessage(`Old response 1. ${"x".repeat(100)}`),
      new HumanMessage(`Old conversation part 2. ${"x".repeat(100)}`),
      new AIMessage(`Old response 2. ${"x".repeat(100)}`),
      // This AI/Tool pair should be kept together
      toolCallMessage,
      new ToolMessage({
        content: "Weather in Paris: Rainy, 15°C",
        tool_call_id: "call_123",
      }),
      new HumanMessage("Thanks for checking the weather!"),
    ];

    const result = await agent.invoke({ messages });

    // Find the tool-related messages in the result
    const hasToolCall = result.messages.some(
      (msg) => isAIMessage(msg) && msg.tool_calls && msg.tool_calls.length > 0
    );
    const hasToolMessage = result.messages.some(
      (msg) => isToolMessage(msg) && msg.tool_call_id === "call_123"
    );

    // Both should be present or both should be absent (not split)
    expect(hasToolCall).toBe(hasToolMessage);
  });

  it("should handle existing system message with previous summary", async () => {
    const summarizationModel = createMockSummarizationModel();
    const mainModel = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      maxTokensBeforeSummary: 100,
      messagesToKeep: 2,
    });

    const agent = createAgent({
      llm: mainModel,
      middlewares: [middleware] as const,
    });

    // Messages with existing system message containing a previous summary
    const messages = [
      new SystemMessage(
        "You are a helpful assistant.\n## Previous conversation summary:\nPrevious discussion about databases."
      ),
      new HumanMessage(`Let's continue our discussion. ${"x".repeat(150)}`),
      new AIMessage(`Sure, building on what we discussed. ${"x".repeat(150)}`),
      new HumanMessage("What's your final recommendation?"),
    ];

    const result = await agent.invoke({ messages });

    // Verify system message is updated with new summary
    expect(result.messages[0]).toBeInstanceOf(SystemMessage);
    const systemMessage = result.messages[0] as SystemMessage;
    expect(systemMessage.content).toContain("You are a helpful assistant");
    expect(systemMessage.content).toContain(
      "## Previous conversation summary:"
    );

    // Should have replaced the old summary with new one
    expect(systemMessage.content).not.toContain(
      "Previous discussion about databases"
    );
    expect(systemMessage.content).toContain("Previous conversation covered:");
  });

  it("should use custom token counter when provided", async () => {
    const summarizationModel = createMockSummarizationModel();
    const mainModel = createMockMainModel();

    // Custom token counter that counts words instead
    const customTokenCounter = vi.fn((messages: any[]) => {
      let wordCount = 0;
      for (const msg of messages) {
        if (typeof msg.content === "string") {
          wordCount += msg.content.split(" ").length;
        }
      }
      return wordCount;
    });

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      maxTokensBeforeSummary: 47, // 47 words
      messagesToKeep: 2,
      tokenCounter: customTokenCounter,
    });

    const agent = createAgent({
      llm: mainModel,
      middlewares: [middleware] as const,
    });

    // Create messages with more than 50 words
    const messages = [
      new HumanMessage(
        "This is a long message with many words that should trigger the summarization because it has more than fifty words in total when combined with other messages in the conversation history."
      ),
      new AIMessage(
        "This is another long response with many words to add to the total count."
      ),
      new HumanMessage("Short question?"),
    ];

    await agent.invoke({ messages });

    // Verify custom token counter was used
    expect(customTokenCounter).toHaveBeenCalled();

    // Verify summarization was triggered
    expect(summarizationModel.invoke).toHaveBeenCalled();
  });

  it("should handle empty conversation gracefully", async () => {
    const summarizationModel = createMockSummarizationModel();
    const mainModel = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      maxTokensBeforeSummary: 100,
      messagesToKeep: 5,
    });

    const agent = createAgent({
      llm: mainModel,
      middlewares: [middleware] as const,
    });

    const result = await agent.invoke({ messages: [] });

    // Should not crash and should add a response
    expect(result.messages.length).toBeGreaterThan(0);
    expect(summarizationModel.invoke).not.toHaveBeenCalled();
  });

  it("should respect messagesToKeep setting", async () => {
    const summarizationModel = createMockSummarizationModel();
    const mainModel = createMockMainModel();

    const messagesToKeep = 2;
    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      maxTokensBeforeSummary: 200,
      messagesToKeep,
    });

    const agent = createAgent({
      llm: mainModel,
      middlewares: [middleware] as const,
    });

    // Create many messages
    const messages = [];
    for (let i = 0; i < 10; i++) {
      messages.push(new HumanMessage(`Message ${i}: ${"x".repeat(30)}`));
      messages.push(new AIMessage(`Response ${i}: ${"x".repeat(30)}`));
    }

    const result = await agent.invoke({ messages });

    // Should have system message + kept messages + new response
    // The exact count depends on where the cutoff happens
    const nonSystemMessages = result.messages.filter(
      (m) => !isSystemMessage(m)
    );
    expect(nonSystemMessages.length).toBeGreaterThanOrEqual(messagesToKeep);
    expect(nonSystemMessages.length).toBeLessThanOrEqual(messagesToKeep + 3); // Some buffer for safety
  });
});
