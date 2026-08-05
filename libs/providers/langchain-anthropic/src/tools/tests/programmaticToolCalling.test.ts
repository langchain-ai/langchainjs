import { expect, it, describe } from "vitest";
import { AIMessage } from "@langchain/core/messages";
import { getToolsRequiringAdvancedBeta } from "../../utils/tools.js";
import { ChatAnthropic } from "../../chat_models.js";
import { extractToolCalls } from "../../output_parsers.js";
import { _convertLangChainToolCallToAnthropic } from "../../utils/message_inputs.js";

describe("Programmatic Tool Calling", () => {
  describe("getToolsRequiringAdvancedBeta", () => {
    it("returns false for undefined tools", () => {
      expect(getToolsRequiringAdvancedBeta(undefined)).toBe(false);
    });

    it("returns false for empty tools array", () => {
      expect(getToolsRequiringAdvancedBeta([])).toBe(false);
    });

    it("returns false for tools without allowed_callers", () => {
      const tools = [
        {
          name: "get_weather",
          description: "Get weather",
          input_schema: { type: "object", properties: {} },
        },
      ];
      expect(getToolsRequiringAdvancedBeta(tools)).toBe(false);
    });

    it("returns true for tools with code_execution allowed_callers", () => {
      const tools = [
        {
          name: "get_weather",
          description: "Get weather",
          input_schema: { type: "object", properties: {} },
          allowed_callers: ["code_execution_20250825"],
        },
      ];
      expect(getToolsRequiringAdvancedBeta(tools)).toBe(true);
    });

    it("returns false for tools with non-code-execution allowed_callers", () => {
      const tools = [
        {
          name: "get_weather",
          description: "Get weather",
          input_schema: { type: "object", properties: {} },
          allowed_callers: ["user"],
        },
      ];
      expect(getToolsRequiringAdvancedBeta(tools)).toBe(false);
    });

    it("returns true for LangChain tools with extras.allowed_callers", () => {
      const tools = [
        {
          name: "get_weather",
          description: "Get weather",
          schema: {},
          extras: {
            allowed_callers: ["code_execution_20250825"],
          },
        },
      ];
      expect(getToolsRequiringAdvancedBeta(tools)).toBe(true);
    });
  });

  describe("advanced-tool-use beta auto-detection in invocationParams", () => {
    it("auto-adds advanced-tool-use beta when tools have allowed_callers with code_execution", () => {
      const model = new ChatAnthropic({
        model: "claude-sonnet-4-5-20250929",
        anthropicApiKey: "testing",
      });
      const params = model.invocationParams({
        tools: [
          {
            name: "get_weather",
            description: "Get weather",
            input_schema: {
              type: "object" as const,
              properties: {},
            },
            allowed_callers: ["code_execution_20250825"],
          },
        ],
      });
      expect(params.betas).toContain("advanced-tool-use-2025-11-20");
    });

    it("does not add advanced-tool-use beta when no tools have code_execution callers", () => {
      const model = new ChatAnthropic({
        model: "claude-sonnet-4-5-20250929",
        anthropicApiKey: "testing",
      });
      const params = model.invocationParams({
        tools: [
          {
            name: "get_weather",
            description: "Get weather",
            input_schema: {
              type: "object" as const,
              properties: {},
            },
          },
        ],
      });
      expect(params.betas).not.toContain("advanced-tool-use-2025-11-20");
    });
  });

  describe("reuseLastContainer", () => {
    it("stores reuseLastContainer from constructor", () => {
      const model = new ChatAnthropic({
        model: "claude-sonnet-4-5-20250929",
        anthropicApiKey: "testing",
        reuseLastContainer: true,
      });
      expect(model.reuseLastContainer).toBe(true);
    });

    it("defaults reuseLastContainer to undefined", () => {
      const model = new ChatAnthropic({
        model: "claude-sonnet-4-5-20250929",
        anthropicApiKey: "testing",
      });
      expect(model.reuseLastContainer).toBeUndefined();
    });
  });

  describe("extractToolCalls preserves caller field", () => {
    it("preserves caller field when present on tool_use block", () => {
      const content = [
        {
          type: "tool_use",
          id: "tool_123",
          name: "get_weather",
          input: { location: "SF" },
          caller: "code_execution_20250825",
        },
      ];
      const toolCalls = extractToolCalls(content);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual({
        name: "get_weather",
        args: { location: "SF" },
        id: "tool_123",
        type: "tool_call",
        caller: "code_execution_20250825",
      });
    });

    it("does not add caller field when not present", () => {
      const content = [
        {
          type: "tool_use",
          id: "tool_123",
          name: "get_weather",
          input: { location: "SF" },
        },
      ];
      const toolCalls = extractToolCalls(content);
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual({
        name: "get_weather",
        args: { location: "SF" },
        id: "tool_123",
        type: "tool_call",
      });
      expect("caller" in toolCalls[0]).toBe(false);
    });
  });

  describe("_convertLangChainToolCallToAnthropic preserves caller", () => {
    it("preserves caller when present on tool call", () => {
      const toolCall = {
        name: "get_weather",
        args: { location: "SF" },
        id: "tool_123",
        type: "tool_call" as const,
        caller: "code_execution_20250825",
      };
      const result = _convertLangChainToolCallToAnthropic(toolCall);
      expect(result).toEqual({
        type: "tool_use",
        id: "tool_123",
        name: "get_weather",
        input: { location: "SF" },
        caller: "code_execution_20250825",
      });
    });

    it("does not add caller when not present", () => {
      const toolCall = {
        name: "get_weather",
        args: { location: "SF" },
        id: "tool_123",
        type: "tool_call" as const,
      };
      const result = _convertLangChainToolCallToAnthropic(toolCall);
      expect(result).toEqual({
        type: "tool_use",
        id: "tool_123",
        name: "get_weather",
        input: { location: "SF" },
      });
      expect("caller" in result).toBe(false);
    });
  });

  describe("container reuse with message history", () => {
    it("finds container ID from AI message response_metadata", () => {
      // Simulate the logic that _streamResponseChunks and _generateNonStreaming use
      const messages = [
        new AIMessage({
          content: "Hello",
          response_metadata: {
            container: { id: "container_abc123" },
          },
        }),
      ];

      let foundContainerId: string | undefined;
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg._getType() === "ai") {
          const container = msg.response_metadata?.container;
          if (
            container &&
            typeof container === "object" &&
            "id" in container &&
            container.id
          ) {
            foundContainerId = container.id as string;
            break;
          }
        }
      }

      expect(foundContainerId).toBe("container_abc123");
    });

    it("returns undefined when no container in message history", () => {
      const messages = [
        new AIMessage({
          content: "Hello",
          response_metadata: {},
        }),
      ];

      let foundContainerId: string | undefined;
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg._getType() === "ai") {
          const container = msg.response_metadata?.container;
          if (
            container &&
            typeof container === "object" &&
            "id" in container &&
            container.id
          ) {
            foundContainerId = container.id as string;
            break;
          }
        }
      }

      expect(foundContainerId).toBeUndefined();
    });
  });
});
