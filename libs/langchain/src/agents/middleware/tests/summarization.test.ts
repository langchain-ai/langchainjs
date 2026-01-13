/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";

import { summarizationMiddleware } from "../summarization.js";
import { createAgent } from "../../index.js";
import { hasToolCalls } from "../../utils.js";
import { FakeToolCallingChatModel } from "../../tests/utils.js";

vi.mock(
  "@langchain/anthropic",
  () => import("./__mocks__/@langchain/anthropic.js")
);

// Mock summarization model
function createMockSummarizationModel() {
  const invokeCallback = vi.fn().mockImplementation(async (prompt: string) => {
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
    new AIMessage("Here's my recommendation based on everything we discussed."),
  ];

  return new FakeToolCallingChatModel({
    responses,
  });
}

describe("summarizationMiddleware", () => {
  it("should trigger summarization when token count exceeds threshold", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 50 }, // Lower threshold to trigger easily
      keep: { messages: 2 }, // Keep 2 messages (similar ratio to working test: 7 messages, keep 4)
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create a conversation with enough tokens to trigger summarization
    // countTokensApproximately uses 1 token = 4 chars, so 50 tokens = 200 chars
    // Use 6 messages (similar ratio to working test: 7 messages, keep 4)
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
      new HumanMessage(`More information here. ${"x".repeat(200)}`),
      new AIMessage(`Got it. ${"x".repeat(200)}`),
      new HumanMessage("What do you recommend?"),
    ];

    const result = await agent.invoke({ messages });

    // Verify summarization model was called
    expect(summarizationModel.invoke).toHaveBeenCalled();

    // Verify the result has a summary message
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
    const summaryMessage = result.messages[0] as HumanMessage;
    expect(summaryMessage.content).toContain(
      "Here is a summary of the conversation to date"
    );
    expect(summaryMessage.content).toContain("Previous conversation covered:");
    expect(summaryMessage.additional_kwargs).toStrictEqual({
      lc_source: "summarization",
    });

    // Verify only recent messages are kept (plus the new response)
    expect(result.messages.length).toBeLessThanOrEqual(4); // summary + kept messages + new response
  });

  it("should trigger summarization when token count exceeds threshold (deprecated syntax)", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      maxTokensBeforeSummary: 50, // Lower threshold to trigger easily
      messagesToKeep: 2, // Keep 2 messages (similar ratio to working test: 7 messages, keep 4)
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create a conversation with enough tokens to trigger summarization
    // countTokensApproximately uses 1 token = 4 chars, so 50 tokens = 200 chars
    // Use 6 messages (similar ratio to working test: 7 messages, keep 4)
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
      new HumanMessage(`More information here. ${"x".repeat(200)}`),
      new AIMessage(`Got it. ${"x".repeat(200)}`),
      new HumanMessage("What do you recommend?"),
    ];

    const result = await agent.invoke({ messages });

    // Verify summarization model was called
    expect(summarizationModel.invoke).toHaveBeenCalled();

    // Verify the result has a summary message
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
    const summaryMessage = result.messages[0] as HumanMessage;
    expect(summaryMessage.content).toContain(
      "Here is a summary of the conversation to date"
    );
    expect(summaryMessage.additional_kwargs).toStrictEqual({
      lc_source: "summarization",
    });

    // Verify only recent messages are kept (plus the new response)
    expect(result.messages.length).toBeLessThanOrEqual(4);
  });

  it("should not trigger summarization when below token threshold", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 5000 }, // High threshold
      keep: { messages: 10 },
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
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

  it("should trigger summarization with multiple trigger conditions (OR logic)", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: [
        { messages: 3 }, // Trigger if messages >= 3 (will be satisfied with 5 messages)
        { tokens: 3000, messages: 6 }, // Trigger if tokens >= 3000 AND messages >= 6 (won't be satisfied)
      ], // Should trigger because first condition is met (OR logic)
      keep: { messages: 2 }, // Keep 2 messages (similar ratio to working test)
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create conversation with 5 messages (should trigger based on first condition: messages >= 3)
    // Use 5 messages to ensure we have enough to summarize (similar ratio to working test)
    const messages = [
      new HumanMessage("Message 1"),
      new AIMessage("Response 1"),
      new HumanMessage("Message 2"),
      new AIMessage("Response 2"),
      new HumanMessage("Message 3"),
    ];

    const result = await agent.invoke({ messages });

    // Should trigger based on first condition (messages >= 3)
    expect(summarizationModel.invoke).toHaveBeenCalled();
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
    expect((result.messages[0] as HumanMessage).content).toContain(
      "Here is a summary of the conversation to date"
    );
    expect(
      (result.messages[0] as HumanMessage).additional_kwargs
    ).toStrictEqual({
      lc_source: "summarization",
    });
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

    const model = new FakeToolCallingChatModel({
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
      model,
      middleware: [middleware],
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
      (msg) =>
        AIMessage.isInstance(msg) && msg.tool_calls && msg.tool_calls.length > 0
    );
    const hasToolMessage = result.messages.some(
      (msg) => ToolMessage.isInstance(msg) && msg.tool_call_id === "call_123"
    );

    // Both should be present or both should be absent (not split)
    expect(hasToolCall).toBe(true);
    expect(hasToolMessage).toBe(true);
  });

  it("should handle token-based keep configuration", async () => {
    const summarizationModel = createMockSummarizationModel();

    // Create a mock model that implements bindTools
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 50 }, // Lower threshold to trigger easily
      keep: { tokens: 50 }, // Keep 50 tokens worth of messages (less than total)
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create messages with enough tokens to trigger and summarize
    // Each message ~100 chars = ~25 tokens, so 6 messages = ~150 tokens total
    // Keep 50 tokens = keep ~2 messages, summarize ~4 messages
    const messages = [
      new HumanMessage(`Message 1: ${"x".repeat(100)}`),
      new AIMessage(`Response 1: ${"x".repeat(100)}`),
      new HumanMessage(`Message 2: ${"x".repeat(100)}`),
      new AIMessage(`Response 2: ${"x".repeat(100)}`),
      new HumanMessage(`Message 3: ${"x".repeat(100)}`),
      new AIMessage(`Response 3: ${"x".repeat(100)}`),
      new HumanMessage("Final question"),
    ];

    const result = await agent.invoke({ messages });

    // Should trigger summarization
    expect(summarizationModel.invoke).toHaveBeenCalled();
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
    expect((result.messages[0] as HumanMessage).content).toContain(
      "Here is a summary of the conversation to date"
    );
    expect(
      (result.messages[0] as HumanMessage).additional_kwargs
    ).toStrictEqual({
      lc_source: "summarization",
    });
    expect(result.messages[1]).toBeInstanceOf(AIMessage);
    expect((result.messages[1] as AIMessage).content).toContain(
      "Response 3: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    );
    expect(result.messages[2]).toBeInstanceOf(HumanMessage);
    expect((result.messages[2] as HumanMessage).content).toContain(
      "Final question"
    );
    expect(result.messages[3]).toBeInstanceOf(AIMessage);
    expect((result.messages[3] as AIMessage).content).toContain("Response");
  });

  it("should handle fraction-based trigger and keep with model profile", async () => {
    const summarizationModel = createMockSummarizationModel();
    (summarizationModel as any).profile = {
      maxInputTokens: 8192,
    };

    // Create a mock model with profile that implements bindTools
    const modelWithProfile = new FakeToolCallingChatModel({
      responses: [new AIMessage("Response")],
    });
    // Set both model and modelName properties for getProfileLimits to work
    (modelWithProfile as any).model = "gpt-5";
    (modelWithProfile as any).modelName = "gpt-5";

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { fraction: 0.1 }, // Trigger at 10% of context window (819 tokens) - lower threshold
      keep: { fraction: 0.05 }, // Keep 5% of context window (409 tokens) - ensure we have something to summarize
    });

    const agent = createAgent({
      model: modelWithProfile,
      middleware: [middleware],
    });

    // Create messages that exceed 10% of 8192 tokens (~819)
    // With countTokensApproximately (1 token = 4 chars), we need ~3276 characters
    const messages = [];
    for (let i = 0; i < 10; i++) {
      messages.push(new HumanMessage(`Message ${i}: ${"x".repeat(200)}`));
      messages.push(new AIMessage(`Response ${i}: ${"x".repeat(200)}`));
    }

    const result = await agent.invoke({ messages });

    // Should trigger summarization
    expect(summarizationModel.invoke).toHaveBeenCalled();
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
  });

  it("should handle fraction-based trigger and keep without model profile", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();
    (summarizationModel as any).model = "claude-sonnet-4-20250514";

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { fraction: 0.5 }, // Trigger at 50% of context window (4096 tokens)
      keep: { fraction: 0.05 }, // Keep 5% of context window (409 tokens) - ensure we have something to summarize
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create messages that exceed 10% of 8192 tokens (~819)
    // With countTokensApproximately (1 token = 4 chars), we need ~3276 characters
    const messages = [];
    for (let i = 0; i < 100; i++) {
      messages.push(new HumanMessage(`Message ${i}: ${"x".repeat(200)}`));
      messages.push(new AIMessage(`Response ${i}: ${"x".repeat(200)}`));
    }

    const result = await agent.invoke({ messages });

    // Should trigger summarization
    expect(summarizationModel.invoke).toHaveBeenCalled();
    expect(result.messages.length).toBe(5);
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
    expect((result.messages[0] as HumanMessage).content).toContain(
      "Here is a summary of the conversation to date"
    );
    expect(
      (result.messages[0] as HumanMessage).additional_kwargs
    ).toStrictEqual({
      lc_source: "summarization",
    });
    expect(result.messages[1]).toBeInstanceOf(AIMessage);
    expect((result.messages[1] as AIMessage).content).toContain(
      "Response 98: xxxxxxxxxx"
    );
    expect(result.messages[2]).toBeInstanceOf(HumanMessage);
    expect((result.messages[2] as HumanMessage).content).toContain(
      "Message 99: xxxxxxxxxxx"
    );
    expect(result.messages[3]).toBeInstanceOf(AIMessage);
    expect((result.messages[3] as AIMessage).content).toContain(
      "Response 99: xxxxxxxxxxx"
    );
    expect(result.messages[4]).toBeInstanceOf(AIMessage);
    expect((result.messages[4] as AIMessage).content).toBe(
      "I understand your project. Let me analyze the architecture."
    );
  });

  it("should throw error when fraction-based config used without model profile", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { fraction: 0.5 },
      keep: { messages: 10 },
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Error should be thrown during invocation, not creation
    await expect(
      agent.invoke({
        messages: [new HumanMessage("Test message")],
      })
    ).rejects.toThrow("Model profile information is required");
  });

  it("should handle trimTokensToSummarize parameter", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 50 }, // Lower threshold
      keep: { messages: 3 }, // Keep 3 messages
      trimTokensToSummarize: 100, // Limit tokens sent to summarization model
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // countTokensApproximately uses 1 token = 4 chars, so 50 tokens = 200 chars
    // Use 6 messages (similar ratio to working test)
    const messages = [
      new HumanMessage(`Message 1: ${"x".repeat(200)}`),
      new AIMessage(`Response 1: ${"x".repeat(200)}`),
      new HumanMessage(`Message 2: ${"x".repeat(200)}`),
      new AIMessage(`Response 2: ${"x".repeat(200)}`),
      new HumanMessage(`Message 3: ${"x".repeat(200)}`),
      new AIMessage(`Response 3: ${"x".repeat(200)}`),
      new HumanMessage("Final question"),
    ];

    const result = await agent.invoke({ messages });

    // Should trigger summarization
    expect(summarizationModel.invoke).toHaveBeenCalledTimes(1);
    const summaryPrompt = summarizationModel.invoke.mock.calls[0][0];
    expect(summaryPrompt).toContain("Messages to summarize:");
    // Uses getBufferString format (Human:, AI:) instead of JSON format
    expect(summaryPrompt).not.toContain("Human: Message 1: xxxxxxxxxxxxxxx");
    expect(summaryPrompt).toContain("AI: Response 2: xxxxxxxxxxxxxxx");
    expect(summaryPrompt).not.toContain("Human: Message 3: xxxxxxxxxxxxxxx");

    // Should trigger summarization
    expect(result.messages.length).toBe(5);
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
    expect((result.messages[0] as HumanMessage).content).toContain(
      "Here is a summary of the conversation to date"
    );
    expect(
      (result.messages[0] as HumanMessage).additional_kwargs
    ).toStrictEqual({
      lc_source: "summarization",
    });
    expect(result.messages[1]).toBeInstanceOf(HumanMessage);
    expect((result.messages[1] as HumanMessage).content).toContain(
      "Message 3: xxxxxxxxxx"
    );
    expect(result.messages[2]).toBeInstanceOf(AIMessage);
    expect((result.messages[2] as AIMessage).content).toContain(
      "Response 3: xxxxxxxxxxx"
    );
    expect(result.messages[3]).toBeInstanceOf(HumanMessage);
    expect((result.messages[3] as HumanMessage).content).toContain(
      "Final question"
    );
    expect(result.messages[4]).toBeInstanceOf(AIMessage);
    expect((result.messages[4] as AIMessage).content).toBe(
      "I understand your project. Let me analyze the architecture."
    );
  });

  it("should handle trimTokensToSummarize set to undefined (no trimming)", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 50 }, // Lower threshold
      keep: { messages: 2 }, // Keep 2 messages (similar ratio to working test)
      // trimTokensToSummarize not specified (undefined) - Don't trim messages for summarization
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // countTokensApproximately uses 1 token = 4 chars, so 50 tokens = 200 chars
    // Use 6 messages (similar ratio to working test)
    const messages = [
      new HumanMessage(`Message 1: ${"x".repeat(200)}`),
      new AIMessage(`Response 1: ${"x".repeat(200)}`),
      new HumanMessage(`Message 2: ${"x".repeat(200)}`),
      new AIMessage(`Response 2: ${"x".repeat(200)}`),
      new HumanMessage(`Message 3: ${"x".repeat(200)}`),
      new AIMessage(`Response 3: ${"x".repeat(200)}`),
      new HumanMessage("Final question"),
    ];

    const result = await agent.invoke({ messages });

    // Should trigger summarization
    expect(summarizationModel.invoke).toHaveBeenCalledTimes(1);
    const summaryPrompt = summarizationModel.invoke.mock.calls[0][0];
    expect(summaryPrompt).toContain("Messages to summarize:");
    // Uses getBufferString format (Human:, AI:) instead of JSON format
    expect(summaryPrompt).toContain("Human: Message 1: xxxxxxxxxxxxxxx");
    expect(summaryPrompt).toContain("AI: Response 2: xxxxxxxxxxxxxxx");
    expect(summaryPrompt).toContain("Human: Message 3: xxxxxxxxxxxxxxx");
    expect(summaryPrompt).not.toContain("AI: Response 3: xxxxxxxxxxxxxxx");

    // Should trigger summarization
    expect(result.messages.length).toBe(4);
    expect(result.messages[0]).toBeInstanceOf(HumanMessage);
    expect((result.messages[0] as HumanMessage).content).toContain(
      "Here is a summary of the conversation to date"
    );
    expect(
      (result.messages[0] as HumanMessage).additional_kwargs
    ).toStrictEqual({
      lc_source: "summarization",
    });
    expect(result.messages[1]).toBeInstanceOf(AIMessage);
    expect((result.messages[1] as AIMessage).content).toContain(
      "Response 3: xxxxxxxxxxx"
    );
    expect(result.messages[2]).toBeInstanceOf(HumanMessage);
    expect((result.messages[2] as HumanMessage).content).toContain(
      "Final question"
    );
    expect(result.messages[3]).toBeInstanceOf(AIMessage);
    expect((result.messages[3] as AIMessage).content).toBe(
      "I understand your project. Let me analyze the architecture."
    );
  });

  it("should use custom token counter when provided", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    // Custom token counter that counts words instead (treating 1 word = 1 token for simplicity)
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
      trigger: { tokens: 50 }, // 50 words
      keep: { messages: 2 }, // Keep 2 messages (similar ratio to working test)
      tokenCounter: customTokenCounter,
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create messages with more than 50 words total
    // Use 5 messages to ensure we have enough to summarize (similar ratio to working test)
    const messages = [
      new HumanMessage(
        "This is a long message with many words that should trigger the summarization because it has more than fifty words in total when combined with other messages in the conversation history and this sentence adds even more words to ensure we exceed the threshold."
      ),
      new AIMessage(
        "This is another long response with many words to add to the total count and make sure we definitely exceed the threshold for summarization to occur and this adds even more words."
      ),
      new HumanMessage("Another message with some words."),
      new AIMessage("Another response with some words."),
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
    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      maxTokensBeforeSummary: 100,
      messagesToKeep: 5,
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const result = await agent.invoke({ messages: [] });

    // Should not crash and should add a response
    expect(result.messages.length).toBeGreaterThan(0);
    expect(summarizationModel.invoke).not.toHaveBeenCalled();
  });

  it("should validate context size schema correctly", async () => {
    const summarizationModel = createMockSummarizationModel();

    // Valid configurations
    expect(() => {
      summarizationMiddleware({
        model: summarizationModel as any,
        trigger: { tokens: 1000 },
        keep: { messages: 10 },
      });
    }).not.toThrow();

    expect(() => {
      summarizationMiddleware({
        model: summarizationModel as any,
        trigger: { fraction: 0.8 },
        keep: { tokens: 5000 },
      });
    }).not.toThrow();

    // Invalid: fraction > 1 - should throw during invocation
    expect(() =>
      summarizationMiddleware({
        model: summarizationModel as any,
        trigger: { fraction: 1.5 },
        keep: { messages: 10 },
      })
    ).toThrow();

    // Invalid: tokens <= 0 - should throw during invocation
    expect(() =>
      summarizationMiddleware({
        model: summarizationModel as any,
        trigger: { tokens: -100 },
        keep: { messages: 10 },
      })
    ).toThrow();

    // Valid: messages = 0 - should be allowed (keep nothing)
    expect(() =>
      summarizationMiddleware({
        model: summarizationModel as any,
        trigger: { tokens: 1000 },
        keep: { messages: 0 },
      })
    ).not.toThrow();

    // Invalid: keep with multiple properties - should throw during invocation
    expect(() =>
      summarizationMiddleware({
        model: summarizationModel as any,
        trigger: { tokens: 1000 },
        keep: { messages: 10, tokens: 5000 },
      })
    ).toThrow();
  });

  it("can be created using a model string", async () => {
    const model = "anthropic:claude-sonnet-4-20250514";
    const middleware = summarizationMiddleware({
      model,
      trigger: { tokens: 100 },
      keep: { messages: 2 },
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });
    const result = await agent.invoke({ messages: [] });
    expect(result.messages.at(-1)?.content).toBe("Mocked response");
  });

  it("should handle trigger set to undefined (disabled)", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      // trigger not specified (undefined) - Disabled
      keep: { messages: 10 },
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const messages = [
      new HumanMessage(`Message 1: ${"x".repeat(500)}`),
      new AIMessage(`Response 1: ${"x".repeat(500)}`),
      new HumanMessage(`Message 2: ${"x".repeat(500)}`),
    ];

    const result = await agent.invoke({ messages });

    // Should NOT trigger summarization
    expect(summarizationModel.invoke).not.toHaveBeenCalled();
    expect(result.messages.length).toBeGreaterThan(messages.length);
  });

  it("should not start preserved messages with AI message containing tool calls", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 100 }, // Very low threshold to trigger summarization
      keep: { messages: 4 }, // Keep enough messages to include the tool call pair plus preceding message
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create a conversation history that would cause the problematic scenario
    // countTokensApproximately uses 1 token = 4 chars, so 100 tokens = 400 chars
    // Structure: old messages (to summarize) -> HumanMessage -> tool call pair (to keep) -> new message
    // We need at least 5 messages before the tool call pair to ensure summarization happens
    const messages = [
      new HumanMessage(
        `First message with some content to take up tokens. ${"x".repeat(400)}`
      ),
      new AIMessage(`First response. ${"x".repeat(400)}`),
      new HumanMessage(
        `Second message with more content to build up tokens. ${"x".repeat(
          400
        )}`
      ),
      new AIMessage(`Second response. ${"x".repeat(400)}`),
      new HumanMessage(
        `Third message with even more content. ${"x".repeat(400)}`
      ),
      new AIMessage(`Third response. ${"x".repeat(400)}`),
      // This HumanMessage should be preserved before the tool call pair
      new HumanMessage("Let me search for information."),
      // This AI message with tool calls should NOT be the first preserved message
      // It should be kept with its tool message pair
      new AIMessage({
        content: "I'll search for that.",
        tool_calls: [{ id: "call_1", name: "search", args: { query: "test" } }],
      }),
      new ToolMessage({
        content: "Search results",
        tool_call_id: "call_1",
      }),
      new HumanMessage("What did you find?"),
    ];

    const result = await agent.invoke({ messages });

    // Verify summarization occurred
    const summaryIndex = result.messages.findIndex((m) =>
      m.content?.toString().includes("summary")
    );
    expect(summaryIndex).toBeGreaterThanOrEqual(0);
    const summaryMessage = result.messages[summaryIndex] as HumanMessage;
    expect(summaryMessage.content).toContain(
      "Here is a summary of the conversation to date"
    );
    expect(summaryMessage.additional_kwargs).toStrictEqual({
      lc_source: "summarization",
    });

    // Verify preserved messages don't start with AI(tool calls)
    // The preserved messages should start with a HumanMessage before the tool call pair
    const preservedMessages = result.messages.slice(summaryIndex + 1);
    expect(preservedMessages.length).toBeGreaterThan(0);
    const firstPreserved = preservedMessages[0];
    // The first preserved message should not be an AI message with tool calls
    // It should be the HumanMessage before the tool call pair
    expect(
      !(AIMessage.isInstance(firstPreserved) && hasToolCalls(firstPreserved))
    ).toBe(true);
  });

  it("should use default summaryPrefix when not provided", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 50 },
      keep: { messages: 2 },
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const messages = [
      new HumanMessage(`Message 1: ${"x".repeat(200)}`),
      new AIMessage(`Response 1: ${"x".repeat(200)}`),
      new HumanMessage(`Message 2: ${"x".repeat(200)}`),
      new AIMessage(`Response 2: ${"x".repeat(200)}`),
      new HumanMessage("Final question"),
    ];

    const result = await agent.invoke({ messages });

    // Verify summarization was triggered
    expect(summarizationModel.invoke).toHaveBeenCalled();

    // Verify the default prefix is used
    const summaryMessage = result.messages[0] as HumanMessage;
    expect(summaryMessage.content).toContain(
      "Here is a summary of the conversation to date:"
    );
    expect(summaryMessage.additional_kwargs).toStrictEqual({
      lc_source: "summarization",
    });
  });

  it("should use custom summaryPrefix when provided", async () => {
    const summarizationModel = createMockSummarizationModel();
    const model = createMockMainModel();

    const customPrefix = "Custom summary prefix for testing:";

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 50 },
      keep: { messages: 2 },
      summaryPrefix: customPrefix,
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const messages = [
      new HumanMessage(`Message 1: ${"x".repeat(200)}`),
      new AIMessage(`Response 1: ${"x".repeat(200)}`),
      new HumanMessage(`Message 2: ${"x".repeat(200)}`),
      new AIMessage(`Response 2: ${"x".repeat(200)}`),
      new HumanMessage("Final question"),
    ];

    const result = await agent.invoke({ messages });

    // Verify summarization was triggered
    expect(summarizationModel.invoke).toHaveBeenCalled();

    // Verify the custom prefix is used
    const summaryMessage = result.messages[0] as HumanMessage;
    expect(summaryMessage.content).toContain(customPrefix);
    expect(summaryMessage.content).not.toContain(
      "Here is a summary of the conversation to date:"
    );
    expect(summaryMessage.additional_kwargs).toStrictEqual({
      lc_source: "summarization",
    });
  });

  it("should not leak summarization model streaming chunks when using streamMode messages", async () => {
    const SUMMARIZATION_RAW_OUTPUT =
      "INTERNAL_SUMMARY_OUTPUT_SHOULD_NOT_BE_STREAMED_AS_AI_MESSAGE";
    const MAIN_MODEL_CONTENT =
      "I understand your project. Let me analyze the architecture.";

    // Create a summarization model with distinctive content
    const summarizationModel = {
      invoke: vi.fn().mockImplementation(async () => {
        return { content: SUMMARIZATION_RAW_OUTPUT };
      }),
      getName: () => "mock-summarizer",
      _modelType: "mock",
      lc_runnable: true,
      profile: {},
    };

    // Create a main model with a distinctive response
    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage(MAIN_MODEL_CONTENT)],
    });

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 50 },
      keep: { messages: 2 },
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create enough messages to trigger summarization
    const inputMessages = [
      new HumanMessage(`Message 1: ${"x".repeat(200)}`),
      new AIMessage(`Response 1: ${"x".repeat(200)}`),
      new HumanMessage(`Message 2: ${"x".repeat(200)}`),
      new AIMessage(`Response 2: ${"x".repeat(200)}`),
      new HumanMessage("Final question"),
    ];

    // Stream with messages mode to capture all message chunks
    const stream = await agent.stream(
      { messages: inputMessages },
      { streamMode: ["messages"] }
    );

    // Collect all streamed AIMessage content (only assistant/AI responses)
    const streamedAIContents: string[] = [];
    for await (const [mode, chunk] of stream) {
      if (mode === "messages") {
        const [msg] = chunk as [any, any];
        // Only collect AIMessage content (role === "assistant" or type === "ai")
        const isAIMessage =
          msg._getType?.() === "ai" ||
          msg.role === "assistant" ||
          AIMessage.isInstance(msg);
        if (isAIMessage) {
          const content =
            typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content);
          if (content) {
            streamedAIContents.push(content);
          }
        }
      }
    }

    // Verify summarization was triggered
    expect(summarizationModel.invoke).toHaveBeenCalled();

    // Verify the raw summarization model output does NOT appear as an AIMessage
    // This would happen if callbacks leaked from the internal model.invoke()
    const allStreamedAIContent = streamedAIContents.join(" ");
    expect(allStreamedAIContent).not.toContain(
      "INTERNAL_SUMMARY_OUTPUT_SHOULD_NOT_BE_STREAMED_AS_AI_MESSAGE"
    );
    expect(allStreamedAIContent).not.toContain(SUMMARIZATION_RAW_OUTPUT);

    // Verify the main model's content DOES appear in the stream
    expect(allStreamedAIContent).toContain(MAIN_MODEL_CONTENT);
  });

  it("should move cutoff backward to preserve AI/Tool pairs when cutoff lands on ToolMessage", async () => {
    const summarizationModel = createMockSummarizationModel();

    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Final response")],
    });

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 100 },
      keep: { tokens: 150 }, // Token budget that would land cutoff on ToolMessage
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create messages where aggressive summarization would normally land on ToolMessage
    // Structure: HumanMessage(long) -> AIMessage(with tool_calls) -> ToolMessage -> HumanMessage -> HumanMessage
    const messages = [
      new HumanMessage("x".repeat(300)), // ~75 tokens
      new AIMessage({
        content: "y".repeat(200), // ~50 tokens
        tool_calls: [
          { id: "call_preserve", name: "test_tool", args: { test: true } },
        ],
      }),
      new ToolMessage({
        content: "z".repeat(50), // ~12 tokens
        tool_call_id: "call_preserve",
        name: "test_tool",
      }),
      new HumanMessage("a".repeat(180)), // ~45 tokens
      new HumanMessage("b".repeat(160)), // ~40 tokens
    ];
    // Total: ~222 tokens, keep ~150 tokens
    // In case of cutoff landing on a ToolMessage, the middleware should move the
    // cutoff backward to include the AIMessage that contains the matching tool_calls.

    const result = await agent.invoke({ messages });

    // Find the preserved messages (after summary)
    const summaryIndex = result.messages.findIndex(
      (msg) =>
        HumanMessage.isInstance(msg) &&
        typeof msg.content === "string" &&
        msg.content.includes("Here is a summary")
    );

    const preservedMessages = result.messages.slice(summaryIndex + 1);

    // The AIMessage with tool_calls should be preserved along with its ToolMessage
    const hasAIWithToolCalls = preservedMessages.some(
      (msg) =>
        AIMessage.isInstance(msg) && msg.tool_calls && msg.tool_calls.length > 0
    );
    const hasMatchingToolMessage = preservedMessages.some(
      (msg) =>
        ToolMessage.isInstance(msg) && msg.tool_call_id === "call_preserve"
    );

    // Both must be present - the AI/Tool pair should be kept together
    expect(hasAIWithToolCalls).toBe(true);
    expect(hasMatchingToolMessage).toBe(true);
  });

  it("should handle orphan ToolMessage by advancing forward", async () => {
    /**
     * Edge case: If a ToolMessage has no matching AIMessage (orphan),
     * the middleware should fall back to advancing past ToolMessages.
     */
    const summarizationModel = createMockSummarizationModel();

    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("Final response")],
    });

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 50 },
      keep: { messages: 2 },
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create messages with an orphan ToolMessage (no matching AIMessage)
    const messages = [
      new HumanMessage("x".repeat(200)),
      new AIMessage("No tool calls here"), // No tool_calls
      new ToolMessage({
        content: "Orphan result",
        tool_call_id: "orphan_call", // No matching AIMessage
        name: "orphan_tool",
      }),
      new HumanMessage("y".repeat(200)),
      new HumanMessage("Final question"),
    ];

    const result = await agent.invoke({ messages });

    // Verify we don't crash and the conversation continues
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it("should preserve many parallel tool calls together with AIMessage", async () => {
    /**
     * Port of Python test: test_summarization_middleware_many_parallel_tool_calls_safety
     *
     * When an AIMessage has many parallel tool calls (e.g., reading 10 files),
     * all corresponding ToolMessages should be preserved along with the AIMessage.
     */
    const summarizationModel = createMockSummarizationModel();

    const model = new FakeToolCallingChatModel({
      responses: [new AIMessage("All files read and summarized")],
    });

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 100 },
      keep: { messages: 5 }, // This would normally cut in the middle of tool responses
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create 10 parallel tool calls
    const toolCalls = Array.from({ length: 10 }, (_, i) => ({
      id: `call_${i}`,
      name: "read_file",
      args: { file: `file${i}.txt` },
    }));

    const aiMessage = new AIMessage({
      content: "I'll read all 10 files",
      tool_calls: toolCalls,
    });

    const toolMessages = toolCalls.map(
      (tc) =>
        new ToolMessage({
          content: `Contents of ${tc.args.file}`,
          tool_call_id: tc.id,
          name: tc.name,
        })
    );

    const messages = [
      new HumanMessage("x".repeat(500)), // Long message to trigger summarization
      aiMessage,
      ...toolMessages,
      new HumanMessage("Now summarize them"),
    ];

    const result = await agent.invoke({ messages });

    // Find preserved messages
    const summaryIndex = result.messages.findIndex(
      (msg) =>
        HumanMessage.isInstance(msg) &&
        typeof msg.content === "string" &&
        msg.content.includes("Here is a summary")
    );

    if (summaryIndex === -1) {
      // Summarization might not have triggered, that's fine
      return;
    }

    const preservedMessages = result.messages.slice(summaryIndex + 1);

    // If the AIMessage with tool_calls is preserved, all its ToolMessages should be too
    const preservedAI = preservedMessages.find(
      (msg) =>
        AIMessage.isInstance(msg) && msg.tool_calls && msg.tool_calls.length > 0
    );

    if (preservedAI && AIMessage.isInstance(preservedAI)) {
      // Count preserved ToolMessages that match this AI's tool_calls
      const aiToolCallIds = new Set(
        preservedAI.tool_calls?.map((tc) => tc.id) ?? []
      );
      const matchingToolMessages = preservedMessages.filter(
        (msg) =>
          ToolMessage.isInstance(msg) && aiToolCallIds.has(msg.tool_call_id)
      );

      // All matching tool messages should be preserved
      expect(matchingToolMessages.length).toBe(preservedAI.tool_calls?.length);
    }
  });

  it("should use getBufferString format to avoid token inflation from message metadata", async () => {
    // Track the actual prompt sent to the summarization model
    let capturedPrompt = "";
    const summarizationModel = {
      invoke: vi.fn().mockImplementation(async (prompt: string) => {
        capturedPrompt = prompt;
        return { content: "Summary of the conversation." };
      }),
      getName: () => "mock-summarizer",
      _modelType: "mock",
      lc_runnable: true,
      profile: {},
    };

    const model = createMockMainModel();

    const middleware = summarizationMiddleware({
      model: summarizationModel as any,
      trigger: { tokens: 50 },
      keep: { messages: 1 },
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Create messages with metadata that would inflate JSON.stringify representation
    const inputMessages = [
      new HumanMessage("What is the weather in NYC?"),
      new AIMessage({
        content: "Let me check the weather for you.",
        tool_calls: [
          { name: "get_weather", args: { city: "NYC" }, id: "call_123" },
        ],
      }),
      new ToolMessage({
        content: "72F and sunny",
        tool_call_id: "call_123",
        name: "get_weather",
      }),
      new AIMessage({
        content: `It is 72F and sunny in NYC! ${"x".repeat(200)}`, // Add enough chars to trigger summarization
      }),
      new HumanMessage("Thanks!"),
    ];

    await agent.invoke({ messages: inputMessages });

    // Verify summarization was triggered
    expect(summarizationModel.invoke).toHaveBeenCalled();

    // Verify the prompt uses getBufferString format (compact) instead of JSON.stringify
    // The prompt should contain role prefixes like "Human:", "AI:", "Tool:" instead of
    // full JSON with all metadata fields
    expect(capturedPrompt).toContain("Human:");
    expect(capturedPrompt).toContain("AI:");
    expect(capturedPrompt).toContain("Tool:");

    // Verify the prompt does NOT contain verbose metadata that would be in JSON.stringify
    // These fields would appear if we used JSON.stringify(messages, null, 2)
    expect(capturedPrompt).not.toContain('"type": "human"');
    expect(capturedPrompt).not.toContain('"type": "ai"');
    expect(capturedPrompt).not.toContain('"additional_kwargs"');
    expect(capturedPrompt).not.toContain('"response_metadata"');

    // The tool calls should still be included (as JSON appended to the AI message)
    expect(capturedPrompt).toContain("get_weather");
  });
});
