/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  RunnableSequence,
  RunnableBinding,
  RunnableLambda,
} from "@langchain/core/runnables";
import { tool } from "@langchain/core/tools";
import { z } from "zod/v3";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import type { AIMessageChunk } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

import { createAgent } from "../index.js";

describe("_shouldBindTools through createAgent", () => {
  // Mock tools for testing
  const mockTool1 = tool(() => "result1", {
    name: "tool1",
    description: "Test tool 1",
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
      const agent = createAgent({
        llm: model,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });

    it("should successfully create agent with empty tools array", async () => {
      const model = new MockBasicChatModel();
      // This should succeed as _shouldBindTools returns true for empty arrays
      const agent = createAgent({
        llm: model,
        tools: [],
      });
      expect(agent).toBeDefined();
    });

    it("should successfully create agent with tool-calling model", async () => {
      const model = new MockToolCallingModel();
      // This should succeed regardless of _shouldBindTools result
      const agent = createAgent({
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
      const agent = createAgent({
        llm: sequence,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });

    it("should throw when using pre-bound model", async () => {
      const chatModel = new MockToolCallingModel();
      const boundModel = chatModel.bindTools([mockTool1]);
      const sequence = RunnableSequence.from([
        new RunnableLambda({ func: (x: any) => x }),
        boundModel,
      ]);
      // Should succeed as _shouldBindTools finds the RunnableBinding with matching tools
      expect(() =>
        createAgent({
          llm: sequence,
          tools: [mockTool1],
        })
      ).toThrow();
    });
  });

  describe("Edge cases", () => {
    it("should handle mixed client and server tools", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        config: {},
      });

      // Only client tools should be considered for name comparison
      const agent = createAgent({
        llm: boundModel,
        tools: [mockTool1, mockServerTool],
      });
      expect(agent).toBeDefined();
    });

    it("should handle tools with null/undefined names gracefully", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        config: {},
      });

      const agent = createAgent({
        llm: boundModel,
        tools: [
          mockTool1,
          { name: "tool1", description: "Test tool 1" },
          { description: "Tool without name" }, // Missing name
        ],
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
      const agent = createAgent({
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
      const agent = createAgent({
        llm: boundModel,
        tools: [mockTool1],
      });
      expect(agent).toBeDefined();
    });

    it("should ignore unknown tool formats", async () => {
      const chatModel = new MockBasicChatModel();
      const boundModel = new RunnableBinding({
        bound: chatModel,
        config: {},
      });

      const agent = createAgent({
        llm: boundModel,
        tools: [
          mockTool1,
          { unknownFormat: "tool1" }, // This should be ignored
          { name: "tool1", description: "Test tool 1" },
        ],
      });
      expect(agent).toBeDefined();
    });
  });
});
