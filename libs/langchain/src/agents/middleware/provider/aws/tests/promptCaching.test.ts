import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import type { LanguageModelLike } from "@langchain/core/language_models/base";

import { bedrockPromptCachingMiddleware } from "../promptCaching.js";
import { createAgent } from "../../../../index.js";

function createMockModel(
  name = "ChatBedrockConverse",
  modelType = "bedrock_converse",
  defaultConfig?: Record<string, unknown>,
  modelId = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
) {
  const invokeCallback = vi
    .fn()
    .mockResolvedValue(new AIMessage("Response from model"));
  const bindToolsCallback = vi.fn();
  // Create a mock that tracks bindTools calls and returns itself
  const mockModel = {
    getName: () => name,
    model: modelId,
    bindTools: bindToolsCallback,
    _streamResponseChunks: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    invoke: invokeCallback,
    lc_runnable: true,
    _modelType: modelType,
    _generate: vi.fn(),
    _llmType: () => modelType,
    _defaultConfig: defaultConfig
      ? { model: modelId, ...defaultConfig }
      : undefined,
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

describe("bedrockPromptCachingMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should add cache_control to modelSettings when conditions are met", async () => {
    const model = createMockModel();

    const middleware = bedrockPromptCachingMiddleware({
      ttl: "5m",
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

    const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
      ._lastBindToolsOptions;
    expect(bindToolsOptions?.cache_control).toBeDefined();
  });

  it("should not add cache_control when message count is below threshold", async () => {
    const model = createMockModel();
    const middleware = bedrockPromptCachingMiddleware({
      ttl: "1h",
      minMessagesToCache: 5,
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

    await agent.invoke({ messages });

    const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
      ._lastBindToolsOptions;
    expect(bindToolsOptions?.cache_control).toBeUndefined();
  });

  it("should pass through a '1h' ttl when caching", async () => {
    const model = createMockModel();
    const middleware = bedrockPromptCachingMiddleware({
      ttl: "1h",
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    await agent.invoke({ messages: [new HumanMessage("Hello")] });

    const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
      ._lastBindToolsOptions;
    expect(bindToolsOptions?.cache_control).toEqual({
      type: "ephemeral",
      ttl: "1h",
    });
  });

  it("should include the system prompt in the message count", async () => {
    const model = createMockModel();
    const middleware = bedrockPromptCachingMiddleware({
      minMessagesToCache: 3,
    });

    const agent = createAgent({
      model,
      systemPrompt: "You are a helpful assistant",
      middleware: [middleware],
    });

    // Only 2 messages, but the system prompt brings the count to 3 (the threshold).
    const messages = [new HumanMessage("Hello"), new AIMessage("Hi there!")];

    await agent.invoke({ messages });

    const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
      ._lastBindToolsOptions;
    expect(bindToolsOptions?.cache_control).toBeDefined();
  });

  it("should respect enableCaching setting", async () => {
    const model = createMockModel();
    const middleware = bedrockPromptCachingMiddleware({
      enableCaching: false,
    });

    const agent = createAgent({
      model,
      middleware: [middleware],
    });

    const messages = [new HumanMessage("Hello")];

    await agent.invoke({ messages });

    const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
      ._lastBindToolsOptions;
    expect(bindToolsOptions?.cache_control).toBeUndefined();
  });

  describe("model detection", () => {
    it("should cache for a ConfigurableModel with bedrock provider", async () => {
      const model = createMockModel("ConfigurableModel", "configurable", {
        modelProvider: "bedrock",
      });
      const middleware = bedrockPromptCachingMiddleware({
        ttl: "5m",
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Hello")],
      });

      const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
        ._lastBindToolsOptions;
      expect(bindToolsOptions?.cache_control).toBeDefined();
    });

    it("should cache for a ConfigurableModel with aws provider", async () => {
      const model = createMockModel("ConfigurableModel", "configurable", {
        modelProvider: "aws",
      });
      const middleware = bedrockPromptCachingMiddleware({
        ttl: "5m",
        minMessagesToCache: 1,
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Hello"), new AIMessage("Hi there!")],
      });

      const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
        ._lastBindToolsOptions;
      expect(bindToolsOptions?.cache_control).toBeDefined();
    });

    it("should cache for an Amazon Nova model", async () => {
      const model = createMockModel(
        "ChatBedrockConverse",
        "bedrock_converse",
        undefined,
        "us.amazon.nova-2-lite-v1:0"
      );
      const middleware = bedrockPromptCachingMiddleware();

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      await agent.invoke({ messages: [new HumanMessage("Hello")] });

      const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
        ._lastBindToolsOptions;
      expect(bindToolsOptions?.cache_control).toBeDefined();
    });

    it("should not cache for a ConfigurableModel with a non-bedrock provider", async () => {
      const model = createMockModel("ConfigurableModel", "configurable", {
        modelProvider: "openai",
      });
      const middleware = bedrockPromptCachingMiddleware();

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Hello"), new AIMessage("Hi there!")],
      });

      const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
        ._lastBindToolsOptions;
      expect(bindToolsOptions?.cache_control).toBeUndefined();
    });
  });

  describe("non-cache-capable Bedrock models", () => {
    it("should skip caching for a non-cache-capable Bedrock model (warn default)", async () => {
      const model = createMockModel(
        "ChatBedrockConverse",
        "bedrock_converse",
        undefined,
        "meta.llama3-8b-instruct-v1:0"
      );
      const middleware = bedrockPromptCachingMiddleware();

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      await agent.invoke({ messages: [new HumanMessage("Hello")] });

      const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
        ._lastBindToolsOptions;
      expect(bindToolsOptions?.cache_control).toBeUndefined();
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("Skipping caching")
      );
    });

    it("should raise for a non-cache-capable Bedrock model when configured to raise", async () => {
      const model = createMockModel(
        "ChatBedrockConverse",
        "bedrock_converse",
        undefined,
        "meta.llama3-8b-instruct-v1:0"
      );
      const middleware = bedrockPromptCachingMiddleware({
        unsupportedModelBehavior: "raise",
      });

      const agent = createAgent({
        model,
        middleware: [middleware],
      });

      await expect(
        agent.invoke({ messages: [new HumanMessage("Hello")] })
      ).rejects.toThrow();
    });
  });

  describe("non-Bedrock models", () => {
    describe("if unsupportedModelBehavior is 'raise'", () => {
      it("should throw error if pass in a non-Bedrock model via string", async () => {
        const middleware = bedrockPromptCachingMiddleware({
          unsupportedModelBehavior: "raise",
        });

        const agent = createAgent({
          model: "openai:gpt-4o",
          middleware: [middleware],
        });

        await expect(agent.invoke({ messages: [] })).rejects.toThrow();
      });
    });

    describe("if unsupportedModelBehavior is 'warn'", () => {
      it("should warn if pass in a non-Bedrock chat instance", async () => {
        const model = createMockModel("ChatOpenAI", "openai");
        const middleware = bedrockPromptCachingMiddleware({
          unsupportedModelBehavior: "warn",
        });

        const agent = createAgent({
          model,
          middleware: [middleware],
        });

        const messages = [new HumanMessage("Hello")];

        await agent.invoke({ messages });

        expect(consoleWarn).toHaveBeenCalledWith(
          expect.stringContaining("Skipping caching for ChatOpenAI")
        );
      });
    });

    describe("if unsupportedModelBehavior is 'ignore'", () => {
      it("should ignore if pass in a non-Bedrock chat instance", async () => {
        const model = createMockModel("ChatOpenAI", "openai");
        const middleware = bedrockPromptCachingMiddleware({
          unsupportedModelBehavior: "ignore",
        });

        const agent = createAgent({
          model,
          middleware: [middleware],
        });

        const messages = [new HumanMessage("Hello")];

        await agent.invoke({ messages });

        expect(consoleWarn).not.toHaveBeenCalled();
      });
    });
  });

  it("should allow runtime context override", async () => {
    const model = createMockModel();
    const middleware = bedrockPromptCachingMiddleware();

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

    const bindToolsOptions = (model as ReturnType<typeof createMockModel>)
      ._lastBindToolsOptions;
    expect(bindToolsOptions?.cache_control).toBeUndefined();
  });
});
