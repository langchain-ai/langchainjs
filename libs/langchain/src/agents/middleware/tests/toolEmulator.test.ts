/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { toolEmulatorMiddleware } from "../toolEmulator.js";
import { createAgent } from "../../index.js";
import { FakeToolCallingChatModel } from "../../tests/utils.js";

vi.mock(
  "@langchain/anthropic",
  () => import("./__mocks__/@langchain/anthropic.js")
);

vi.mock("@langchain/openai", () => import("./__mocks__/@langchain/openai.js"));

describe("toolEmulatorMiddleware", () => {
  // Helper to create test tools
  const searchToolMock = vi.fn(async ({ query }: { query: string }) => {
    return `Results for: ${query}`;
  });
  const searchTool = tool(searchToolMock, {
    name: "search",
    description: "Search for information",
    schema: z.object({ query: z.string() }),
  });

  const calculatorToolMock = vi.fn(
    async ({ expression }: { expression: string }) => `Result: ${expression}`
  );
  const calculatorTool = tool(calculatorToolMock, {
    name: "calculator",
    description: "Calculate an expression",
    schema: z.object({
      expression: z.string(),
    }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should create middleware with default name", () => {
      const middleware = toolEmulatorMiddleware();
      expect(middleware.name).toBe("ToolEmulatorMiddleware");
    });

    it("should accept empty options", () => {
      const middleware = toolEmulatorMiddleware({});
      expect(middleware.name).toBe("ToolEmulatorMiddleware");
    });

    it("should accept tools array", () => {
      const middleware = toolEmulatorMiddleware({
        tools: ["search", "calculator"],
      });
      expect(middleware.name).toBe("ToolEmulatorMiddleware");
    });

    it("should accept model string", () => {
      const middleware = toolEmulatorMiddleware({
        model: "openai:gpt-4",
      });
      expect(middleware.name).toBe("ToolEmulatorMiddleware");
    });

    it("should accept BaseChatModel instance", () => {
      const mockModel = {
        invoke: vi.fn(),
        _modelType: () => "base_chat_model",
      } as unknown as BaseChatModel;

      const middleware = toolEmulatorMiddleware({
        model: mockModel,
      });
      expect(middleware.name).toBe("ToolEmulatorMiddleware");
    });
  });

  describe("Tool Filtering", () => {
    it("should emulate all tools when tools is undefined", async () => {
      const mockModel = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Mocked response" })],
      });
      const middleware = toolEmulatorMiddleware({
        model: mockModel,
      });

      const request = {
        toolCall: { id: "1", name: "search", args: { query: "test" } },
        tool: searchTool,
        state: {},
        runtime: {} as any,
      };

      const handler = vi.fn().mockResolvedValue(
        new ToolMessage({
          content: "Real result",
          tool_call_id: "1",
          name: "search",
        })
      );

      const result = await middleware.wrapToolCall?.(request as any, handler);

      // Should not call the real handler
      expect(handler).not.toHaveBeenCalled();
      // Should return emulated result
      expect(result).toBeInstanceOf(ToolMessage);
      expect((result as ToolMessage).content).toContain("Mocked response");
    });

    it("should emulate all tools when tools is empty array", async () => {
      const mockModel = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Mocked response" })],
      });
      const middleware = toolEmulatorMiddleware({
        tools: [],
        model: mockModel,
      });
      const wrapToolCall = middleware.wrapToolCall!;

      const request = {
        toolCall: { id: "1", name: "search", args: { query: "test" } },
        tool: searchTool,
        state: {},
        runtime: {} as any,
      };

      const handler = vi.fn().mockResolvedValue(
        new ToolMessage({
          content: "Real result",
          tool_call_id: "1",
          name: "search",
        })
      );

      const result = await wrapToolCall(request as any, handler);

      // Should not call the real handler
      expect(handler).not.toHaveBeenCalled();
      // Should return emulated result
      expect(result).toBeInstanceOf(ToolMessage);
      expect((result as ToolMessage).content).toContain("Mocked response");
    });

    it("should emulate specific tools by name", async () => {
      const mockModel = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Mocked response" })],
      });
      const middleware = toolEmulatorMiddleware({
        tools: ["search"],
        model: mockModel,
      });

      // Emulated tool
      const searchRequest = {
        toolCall: { id: "1", name: "search", args: { query: "test" } },
        tool: searchTool,
        state: {},
        runtime: {} as any,
      };

      const searchHandler = vi.fn().mockResolvedValue(
        new ToolMessage({
          content: "Real result",
          tool_call_id: "1",
          name: "search",
        })
      );

      const searchResult = await middleware.wrapToolCall?.(
        searchRequest as any,
        searchHandler
      );

      expect(searchHandler).not.toHaveBeenCalled();
      expect(searchResult).toBeInstanceOf(ToolMessage);
      expect((searchResult as ToolMessage).content).toContain(
        "Mocked response"
      );

      // Non-emulated tool
      const calcRequest = {
        toolCall: { id: "2", name: "calculator", args: { expression: "1+1" } },
        tool: calculatorTool,
        state: {},
        runtime: {} as any,
      };

      const calcHandler = vi.fn().mockResolvedValue(
        new ToolMessage({
          content: "Real result",
          tool_call_id: "2",
          name: "calculator",
        })
      );

      const calcResult = await middleware.wrapToolCall?.(
        calcRequest as any,
        calcHandler
      );

      expect(calcHandler).toHaveBeenCalledTimes(1);
      expect(calcResult).toBeInstanceOf(ToolMessage);
      expect((calcResult as ToolMessage).content).toContain("Real result");
    });

    it("should emulate specific tools by tool instance", async () => {
      const mockModel = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Mocked response" })],
      });
      const middleware = toolEmulatorMiddleware({
        tools: [searchTool],
        model: mockModel,
      });
      const wrapToolCall = middleware.wrapToolCall!;

      const request = {
        toolCall: { id: "1", name: "search", args: { query: "test" } },
        tool: searchTool,
        state: {},
        runtime: {} as any,
      };

      const handler = vi.fn().mockResolvedValue(
        new ToolMessage({
          content: "Real result",
          tool_call_id: "1",
          name: "search",
        })
      );

      const result = await wrapToolCall(request as any, handler);

      expect(handler).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(ToolMessage);
    });

    it("should handle mixed tool names and instances", async () => {
      const mockModel = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Mocked response" })],
      });
      const middleware = toolEmulatorMiddleware({
        tools: ["search", calculatorTool],
        model: mockModel,
      });

      // Both should be emulated
      const searchRequest = {
        toolCall: { id: "1", name: "search", args: { query: "test" } },
        tool: searchTool,
        state: {},
        runtime: {} as any,
      };

      const searchHandler = vi.fn();
      const searchResult = await middleware.wrapToolCall?.(
        searchRequest as any,
        searchHandler
      );
      expect(searchHandler).not.toHaveBeenCalled();
      expect(searchResult).toBeInstanceOf(ToolMessage);
      expect((searchResult as ToolMessage).content).toContain(
        "Mocked response"
      );

      const calcRequest = {
        toolCall: { id: "2", name: "calculator", args: { expression: "1+1" } },
        tool: calculatorTool,
        state: {},
        runtime: {} as any,
      };

      const calcHandler = vi.fn();
      const calcResult = await middleware.wrapToolCall?.(
        calcRequest as any,
        calcHandler
      );
      expect(calcHandler).not.toHaveBeenCalled();
      expect(calcResult).toBeInstanceOf(ToolMessage);
      expect((calcResult as ToolMessage).content).toContain("Mocked response");
    });
  });

  describe("Integration with createAgent", () => {
    it("should emulate tools in agent execution", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "search", args: { query: "test" } }],
          }),
          new AIMessage("Final response"),
        ],
      });

      const emulatorModel = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Mocked response" })],
      });

      const middleware = toolEmulatorMiddleware({
        tools: ["search"],
        model: emulatorModel,
      });

      const agent = createAgent({
        model,
        tools: [searchTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Search for something")],
      });

      // Tool should not have been called
      expect(searchToolMock).not.toHaveBeenCalled();

      // Should have tool message in result
      const toolMessages = [...result.messages]
        .reverse()
        .filter((msg): msg is ToolMessage => ToolMessage.isInstance(msg));
      expect(toolMessages.length).toBeGreaterThan(0);
      expect(toolMessages[0].content).toContain("Mocked response");
      expect(searchToolMock).toHaveBeenCalledTimes(0);
    });

    it("should allow non-emulated tools to execute normally", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test" } },
              { id: "2", name: "calculator", args: { expression: "1+1" } },
            ],
          }),
          new AIMessage("Final response"),
        ],
      });

      const emulatorModel = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Mocked response" })],
      });

      const middleware = toolEmulatorMiddleware({
        tools: ["search"], // Only emulate search
        model: emulatorModel,
      });

      const agent = createAgent({
        model,
        tools: [searchTool, calculatorTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Do calculations")],
      });

      // Search should be emulated
      expect(searchToolMock).not.toHaveBeenCalled();

      // Calculator should execute normally
      expect(calculatorToolMock).toHaveBeenCalledTimes(1);
      expect(calculatorToolMock).toHaveBeenCalledWith(
        { expression: "1+1" },
        expect.anything()
      );
      expect(result.messages[result.messages.length - 2].content).toContain(
        "Result: 1+1"
      );
    });

    it("should emulate all tools when no tools specified", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test" } },
              { id: "2", name: "calculator", args: { expression: "1+1" } },
            ],
          }),
          new AIMessage("Final response"),
        ],
      });

      const emulatorModel = new FakeToolCallingChatModel({
        responses: [new AIMessage({ content: "Mocked response" })],
      });

      // When no model is provided, middleware uses agent model
      // Agent model will be set via wrapModelCall when createAgent runs
      // For testing, we provide an explicit model to ensure consistent behavior
      const middleware = toolEmulatorMiddleware({
        model: emulatorModel,
      }); // Emulate all

      const agent = createAgent({
        model,
        tools: [searchTool, calculatorTool],
        middleware: [middleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Do things")],
      });

      // Both tools should be emulated
      expect(searchToolMock).not.toHaveBeenCalled();
      expect(calculatorToolMock).not.toHaveBeenCalled();
    });

    it("should use agent model when no model is provided to middleware", async () => {
      const emulatedResponseContent = "Agent model emulated response";
      const model = new FakeToolCallingChatModel({
        responses: [
          // First response: agent decides to call tool
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "search", args: { query: "test" } }],
          }),
          // Second response: agent model used for emulation (when invoked with emulation prompt)
          new AIMessage({ content: emulatedResponseContent }),
          // Third response: agent's final response after receiving tool result
          new AIMessage("Final response"),
        ],
      });

      // Create middleware without providing a model - it should use agent model
      const middleware = toolEmulatorMiddleware({
        tools: ["search"],
      });

      const agent = createAgent({
        model,
        tools: [searchTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Search for something")],
      });

      // Tool should not have been called (emulated instead)
      expect(searchToolMock).not.toHaveBeenCalled();

      // Should have tool message in result
      const toolMessages = [...result.messages]
        .reverse()
        .filter((msg): msg is ToolMessage => ToolMessage.isInstance(msg));
      expect(toolMessages.length).toBe(1);
      expect(toolMessages[0].content).toContain(emulatedResponseContent);
      expect(result.messages.at(-1)?.content).toContain("Final response");
    });
  });
});
