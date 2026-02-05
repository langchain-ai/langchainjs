import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockInstance,
} from "vitest";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import { ChatOpenAI } from "@langchain/openai";

import { anthropicPromptCachingMiddleware } from "../promptCaching.js";
import { createAgent } from "../../../../index.js";

function createMockModel(name = "ChatAnthropic", modelType = "anthropic") {
  // Mock Anthropic model
  const invokeCallback = vi
    .fn()
    .mockResolvedValue(new AIMessage("Response from model"));
  const bindToolsCallback = vi.fn();
  // Create a mock that tracks bindTools calls and returns itself
  const mockModel = {
    getName: () => name,
    bindTools: bindToolsCallback,
    _streamResponseChunks: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: invokeCallback,
    lc_runnable: true,
    _modelType: modelType,
    _generate: vi.fn(),
    _llmType: () => modelType,
    _lastBindToolsOptions: null as Record<string, unknown> | null,
  };
  // Store the options passed to bindTools for inspection
  bindToolsCallback.mockImplementation(
    (_tools: unknown, options: Record<string, unknown>) => {
      mockModel._lastBindToolsOptions = options;
      return mockModel;
    }
  );
  return mockModel as unknown as LanguageModelLike & {
    _lastBindToolsOptions: Record<string, unknown> | null;
    bindTools: (tools: unknown, options: Record<string, unknown>) => void;
  };
}

const consoleWarn = vi.spyOn(console, "warn");

describe("anthropicPromptCachingMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should add cache_control to modelSettings when conditions are met", async () => {
    const model = createMockModel();

    const middleware = anthropicPromptCachingMiddleware({
      ttl: "5m",
      minMessagesToCache: 3,
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
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

    // Verify bindTools was called with cache_control in options
    expect(model.bindTools).toHaveBeenCalled();
    const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
      ._lastBindToolsOptions;
    expect(bindToolsOptions).toHaveProperty("cache_control");
    expect(bindToolsOptions?.cache_control).toEqual({
      type: "ephemeral",
      ttl: "5m",
    });
  });

  it("should pass cache_control via modelSettings, not modify messages", async () => {
    const model = createMockModel();

    const middleware = anthropicPromptCachingMiddleware({
      ttl: "5m",
      minMessagesToCache: 3,
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
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

    // Messages should NOT have cache_control directly on content blocks
    // (the cache_control is applied later by ChatAnthropic during formatting)
    // The last message should remain unchanged - still a simple string content
    const lastMessage = callArgs[0].at(-1);
    // Content should be a string (unchanged from original HumanMessage)
    // If it was an array with cache_control, that would mean the old implementation is used
    expect(typeof lastMessage.content === "string").toBe(true);
    expect(lastMessage.content).toBe("What's the weather like?");
  });

  it("should not add cache_control when message count is below threshold", async () => {
    const model = createMockModel();
    const middleware = anthropicPromptCachingMiddleware({
      ttl: "1h",
      minMessagesToCache: 5, // High threshold
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    // Test with fewer messages than threshold
    const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

    await agent.invoke({ messages });

    // Verify bindTools was called without cache_control
    expect(model.bindTools).toHaveBeenCalled();
    const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
      ._lastBindToolsOptions;
    expect(bindToolsOptions?.cache_control).toBeUndefined();
  });

  it("should respect enableCaching setting", async () => {
    const model = createMockModel();
    const middleware = anthropicPromptCachingMiddleware({
      enableCaching: false, // Disabled
      ttl: "5m",
      minMessagesToCache: 1,
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const messages = [
      new HumanMessage("Hello"),
      new AIMessage("Hi there!"),
      new HumanMessage("How are you?"),
    ];

    await agent.invoke({ messages });

    // Verify bindTools was called without cache_control
    const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
      ._lastBindToolsOptions;
    expect(bindToolsOptions?.cache_control).toBeUndefined();
  });

  describe("non-Anthropic models", () => {
    describe("if unsupportedModelBehavior is 'raise'", () => {
      it("should throw error if pass in a non-Anthropic chat instance", async () => {
        const middleware = anthropicPromptCachingMiddleware({
          unsupportedModelBehavior: "raise",
        });

        const agent = createAgent({
          model: new ChatOpenAI({ model: "gpt-4o" }),
          middleware: [middleware],
        });

        // Should throw error
        await expect(agent.invoke({ messages: [] })).rejects.toThrow(
          "Unsupported model 'ChatOpenAI'. Prompt caching requires an Anthropic model (e.g., 'anthropic:claude-4-0-sonnet')."
        );
      });

      it("should throw error if pass in a non-Anthropic model via string", async () => {
        const middleware = anthropicPromptCachingMiddleware({
          unsupportedModelBehavior: "raise",
        });

        const agent = createAgent({
          model: "openai:gpt-4o",
          middleware: [middleware],
        });

        // Should throw error
        await expect(agent.invoke({ messages: [] })).rejects.toThrow(
          "Unsupported model 'ConfigurableModel (openai)'. Prompt caching requires an Anthropic model (e.g., 'anthropic:claude-4-0-sonnet')."
        );
      });
    });

    describe("if unsupportedModelBehavior is 'warn'", () => {
      it("should warn if pass in a non-Anthropic chat instance", async () => {
        const model = createMockModel("ChatOpenAI", "openai");
        const middleware = anthropicPromptCachingMiddleware({
          enableCaching: true,
          ttl: "5m",
          minMessagesToCache: 1,
          unsupportedModelBehavior: "warn",
        });

        const agent = createAgent({
          model,
          middleware: [middleware],
        });

        const messages = [
          new HumanMessage("Hello"),
          new AIMessage("Hi there!"),
          new HumanMessage("How are you?"),
        ];

        await agent.invoke({ messages });

        // Verify no cache_control was added to modelSettings
        const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
          ._lastBindToolsOptions;
        expect(bindToolsOptions?.cache_control).toBeUndefined();
        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining("Skipping caching for ChatOpenAI")
        );
      });
    });

    describe("if unsupportedModelBehavior is 'ignore'", () => {
      it("should ignore if pass in a non-Anthropic chat instance", async () => {
        const model = createMockModel("ChatOpenAI", "openai");
        const middleware = anthropicPromptCachingMiddleware({
          enableCaching: true,
          ttl: "5m",
          minMessagesToCache: 1,
          unsupportedModelBehavior: "ignore",
        });

        const agent = createAgent({
          model,
          middleware: [middleware],
        });

        const messages = [
          new HumanMessage("Hello"),
          new AIMessage("Hi there!"),
          new HumanMessage("How are you?"),
        ];

        await agent.invoke({ messages });

        // Verify no cache_control was added to modelSettings
        const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
          ._lastBindToolsOptions;
        expect(bindToolsOptions?.cache_control).toBeUndefined();
        expect(consoleWarn).not.toHaveBeenCalled();
      });
    });
  });

  it("should include system message in message count", async () => {
    const model = createMockModel();
    const middleware = anthropicPromptCachingMiddleware({
      ttl: "1h",
      minMessagesToCache: 3,
    });

    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant", // Counts as 1 message
      middleware: [middleware],
    });

    // Only 2 user messages, but with system message makes 3 total
    const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

    await agent.invoke({ messages });

    // Should have cache_control in modelSettings because total count is 3
    const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
      ._lastBindToolsOptions;
    expect(bindToolsOptions).toHaveProperty("cache_control");
    expect(bindToolsOptions?.cache_control).toEqual({
      type: "ephemeral",
      ttl: "1h",
    });
  });

  it("should allow runtime context override", async () => {
    const model = createMockModel();
    const middleware = anthropicPromptCachingMiddleware({
      ttl: "5m",
      minMessagesToCache: 3,
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
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
    const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
      ._lastBindToolsOptions;
    expect(bindToolsOptions?.cache_control).toBeUndefined();
  });
});
