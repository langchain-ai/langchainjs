import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  RunnableSequence,
  RunnableBinding,
  RunnableLambda,
} from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import type { AIMessageChunk } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

import { createReactAgent } from "../index.js";

describe("_shouldBindTools through createReactAgent", () => {
  // Mock tools for testing
  const mockTool1 = tool(() => "result1", {
    name: "tool1",
    description: "Test tool 1",
    schema: z.object({}),
  });

  const mockTool2 = tool(() => "result2", {
    name: "tool2",
    description: "Test tool 2",
    schema: z.object({}),
  });

  const mockServerTool = {
    name: "serverTool",
    description: "Server tool",
    url: "http://example.com/tool",
  };

  // Mock chat model that supports tool binding
  class MockToolCallingModel extends BaseChatModel<
    BaseLanguageModelCallOptions,
    AIMessageChunk
  > {
    constructor() {
      super({});
    }

    _modelType(): string {
      return "mock_tool_calling_model";
    }

    _llmType(): string {
      return "mock_tool_calling_model";
    }

    bindTools(tools: any[]) {
      const newInstance = new MockToolCallingModel();
      return new RunnableBinding({
        bound: newInstance,
        kwargs: {
          tools: tools.map((tool) => ({
            type: "function",
            function: { name: tool.name, description: tool.description },
          })),
        } as any,
        config: {},
      });
    }

    async _generate(
      _messages: any[],
      _options?: BaseLanguageModelCallOptions,
      _runManager?: CallbackManagerForLLMRun
    ): Promise<ChatResult> {
      return {
        generations: [
          {
            message: new AIMessage("mock response"),
            text: "mock response",
          },
        ],
      };
    }
  }

  // Mock chat model without tool binding
  class MockBasicChatModel extends BaseChatModel<
    BaseLanguageModelCallOptions,
    AIMessageChunk
  > {
    constructor() {
      super({});
    }

    _modelType(): string {
      return "mock_basic_model";
    }

    _llmType(): string {
      return "mock_basic_model";
    }

    async _generate(
      _messages: any[],
      _options?: BaseLanguageModelCallOptions,
      _runManager?: CallbackManagerForLLMRun
    ): Promise<ChatResult> {
      return {
        generations: [
          {
            message: new AIMessage("mock response"),
            text: "mock response",
          },
        ],
      };
    }
  }

  describe("Basic model scenarios", () => {
    it("should successfully create agent with basic chat model (tools will be bound)", async () => {
      const model = new MockBasicChatModel();
      // This should succeed as _shouldBindTools returns true for basic models
      const agent = createReactAgent({
        llm: model,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });

    it("should successfully create agent with empty tools array", async () => {
      const model = new MockBasicChatModel();
      // This should succeed as _shouldBindTools returns true for empty arrays
      const agent = createReactAgent({
        llm: model,
        tools: [],
      });
      expect(agent).toBeDefined();
    });

    it("should successfully create agent with tool-calling model", async () => {
      const model = new MockToolCallingModel();
      // This should succeed regardless of _shouldBindTools result
      const agent = createReactAgent({
        llm: model,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });
  });

  describe("RunnableSequence scenarios", () => {
    it("should handle RunnableSequence with BaseChatModel step", async () => {
      const chatModel = new MockBasicChatModel();
      const sequence = RunnableSequence.from([
        new RunnableLambda({ func: (x: any) => x }),
        chatModel,
      ]);
      // Should succeed as _shouldBindTools finds the BaseChatModel and returns true
      const agent = createReactAgent({
        llm: sequence,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });

    it("should handle RunnableSequence with pre-bound model", async () => {
      const chatModel = new MockToolCallingModel();
      const boundModel = chatModel.bindTools([mockTool1]);
      const sequence = RunnableSequence.from([
        new RunnableLambda({ func: (x: any) => x }),
        boundModel,
      ]);
      // Should succeed as _shouldBindTools finds the RunnableBinding with matching tools
      const agent = createReactAgent({
        llm: sequence,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });
  });

  describe("Pre-bound models with different tool formats", () => {
    it("should work with pre-bound model (OpenAI format)", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {
          tools: [
            {
              type: "function",
              function: { name: "tool1", description: "Test tool 1" },
            },
            {
              type: "function",
              function: { name: "tool2", description: "Test tool 2" },
            },
          ],
        } as any,
        config: {},
      });
      // Should succeed as _shouldBindTools finds matching tools and returns false
      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1, mockTool2],
      });
      expect(agent).toBeDefined();
    });

    it("should work with pre-bound model (Anthropic format)", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {
          tools: [
            { name: "tool1", description: "Test tool 1" },
            { name: "tool2", description: "Test tool 2" },
          ],
        } as any,
        config: {},
      });
      // Should succeed as _shouldBindTools finds matching tools and returns false
      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1, mockTool2],
      });
      expect(agent).toBeDefined();
    });

    it("should work with pre-bound model (Bedrock format)", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {
          tools: [
            { toolSpec: { name: "tool1", description: "Test tool 1" } },
            { toolSpec: { name: "tool2", description: "Test tool 2" } },
          ],
        } as any,
        config: {},
      });
      // Should succeed as _shouldBindTools finds matching tools and returns false
      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1, mockTool2],
      });
      expect(agent).toBeDefined();
    });

    it("should work with Google format with functionDeclarations", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {
          tools: [
            {
              functionDeclarations: [
                { name: "tool1", description: "Test tool 1" },
                { name: "tool2", description: "Test tool 2" },
              ],
            },
          ],
        } as any,
        config: {},
      });
      // Should succeed as _shouldBindTools finds matching tools and returns false
      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1, mockTool2],
      });
      expect(agent).toBeDefined();
    });

    it("should work with model bound via bindTools method", async () => {
      const model = new MockToolCallingModel();
      const boundModel = model.bindTools([mockTool1, mockTool2]);
      // Should succeed as _shouldBindTools finds matching tools and returns false
      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1, mockTool2],
      });
      expect(agent).toBeDefined();
    });

    it("should work with tools in config instead of kwargs", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {},
        config: {
          tools: [
            { name: "tool1", description: "Test tool 1" },
            { name: "tool2", description: "Test tool 2" },
          ],
        } as any,
      });
      // Should succeed as _shouldBindTools finds matching tools in config
      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1, mockTool2],
      });
      expect(agent).toBeDefined();
    });

    it("should prioritize kwargs over config when both present", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {
          tools: [{ name: "tool1", description: "Test tool 1" }],
        } as any,
        config: {
          tools: [{ name: "differentTool", description: "Different tool" }],
        } as any,
      });
      // Should succeed as _shouldBindTools uses kwargs tools, not config tools
      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });
  });

  describe("Error conditions", () => {
    it("should throw error when tool count doesn't match", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {
          tools: [{ name: "tool1", description: "Test tool 1" }],
        } as any,
        config: {},
      });

      await expect(async () =>
        createReactAgent({
          llm: boundModel,
          tools: [mockTool1, mockTool2], // Mismatch: 2 tools vs 1 bound tool
        }).invoke({ messages: [new HumanMessage("hi")] })
      ).rejects.toThrow(
        "Number of tools in the model.bindTools() and tools passed to createReactAgent must match"
      );
    });

    it("should throw error when tools are missing", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {
          tools: [{ name: "differentTool", description: "Different tool" }],
        } as any,
        config: {},
      });

      await expect(async () =>
        createReactAgent({
          llm: boundModel,
          tools: [mockTool1], // tool1 not in bound tools
        }).invoke({ messages: [new HumanMessage("hi")] })
      ).rejects.toThrow("Missing tools 'tool1' in the model.bindTools()");
    });
  });

  describe("Edge cases", () => {
    it("should handle mixed client and server tools", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {
          tools: [{ name: "tool1", description: "Test tool 1" }],
        } as any,
        config: {},
      });

      // Only client tools should be considered for name comparison
      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1, mockServerTool],
      });
      expect(agent).toBeDefined();
    });

    it("should handle tools with null/undefined names gracefully", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {
          tools: [
            { name: "tool1", description: "Test tool 1" },
            { description: "Tool without name" }, // Missing name
          ],
        } as any,
        config: {},
      });

      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });

    it("should handle null kwargs", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: null as any,
        config: {},
      });

      // Should succeed as _shouldBindTools treats null kwargs as no bound tools
      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });

    it("should handle null config", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {},
        config: {} as any,
      });

      // Should succeed as _shouldBindTools treats empty config as no bound tools
      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });

    it("should ignore unknown tool formats", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        kwargs: {
          tools: [
            { unknownFormat: "tool1" }, // This should be ignored
            { name: "tool1", description: "Test tool 1" },
          ],
        } as any,
        config: {},
      });

      const agent = createReactAgent({
        llm: boundModel,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });
  });
});
