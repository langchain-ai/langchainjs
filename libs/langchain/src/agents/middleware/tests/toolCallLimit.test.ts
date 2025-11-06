/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";
import {
  HumanMessage,
  AIMessage,
  ToolMessage,
  type BaseMessage,
  type ToolCall,
} from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";

import {
  toolCallLimitMiddleware,
  ToolCallLimitExceededError,
} from "../toolCallLimit.js";
import { createAgent } from "../../index.js";
import { FakeToolCallingChatModel } from "../../tests/utils.js";
import { getHookFunction } from "../utils.js";

describe("toolCallLimitMiddleware", () => {
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

  describe("Initialization and Validation", () => {
    it("should throw error if no limits are specified", () => {
      expect(() =>
        toolCallLimitMiddleware({
          // No threadLimit or runLimit
        } as any)
      ).toThrow("At least one limit must be specified");
    });

    it("should default to continue exit behavior", () => {
      const middleware = toolCallLimitMiddleware({
        threadLimit: 5,
      });
      expect(middleware.name).toBe("ToolCallLimitMiddleware");
    });

    it("should accept different exit behaviors", () => {
      const middleware1 = toolCallLimitMiddleware({
        threadLimit: 5,
        exitBehavior: "continue",
      });
      expect(middleware1.name).toBe("ToolCallLimitMiddleware");

      const middleware2 = toolCallLimitMiddleware({
        threadLimit: 5,
        exitBehavior: "error",
      });
      expect(middleware2.name).toBe("ToolCallLimitMiddleware");

      const middleware3 = toolCallLimitMiddleware({
        threadLimit: 5,
        exitBehavior: "end",
      });
      expect(middleware3.name).toBe("ToolCallLimitMiddleware");
    });

    it("should generate correct middleware name without tool name", () => {
      const middleware = toolCallLimitMiddleware({
        threadLimit: 5,
      });
      expect(middleware.name).toBe("ToolCallLimitMiddleware");
    });

    it("should generate correct middleware name with tool name", () => {
      const middleware = toolCallLimitMiddleware({
        toolName: "search",
        threadLimit: 5,
      });
      expect(middleware.name).toBe("ToolCallLimitMiddleware[search]");
    });
  });

  describe("Thread-level Limits", () => {
    it("should allow tool calls under thread limit", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "search", args: { query: "test1" } }],
          }),
          new AIMessage("Response after tool call"),
        ],
      });

      const middleware = toolCallLimitMiddleware({
        threadLimit: 5,
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [searchTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Search for something")],
      });

      // Should complete successfully
      expect(result.messages.length).toBeGreaterThan(0);
      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).not.toContain("thread limit");
      expect(searchToolMock).toHaveBeenCalledTimes(1);
    });

    it("should terminate when thread limit is exceeded", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
              { id: "2", name: "search", args: { query: "test2" } },
            ],
          }),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "3", name: "search", args: { query: "test3" } }],
          }),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "4", name: "search", args: { query: "test4" } }],
          }),
          new AIMessage("Should not reach here"),
        ],
      });

      const middleware = toolCallLimitMiddleware({
        threadLimit: 3,
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [searchTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Search for things")],
      });

      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage).toBeInstanceOf(AIMessage);
      expect(lastMessage.content).toContain("thread limit exceeded");
      expect(lastMessage.content).toContain("4/3");
      expect(searchToolMock).toHaveBeenCalledTimes(3);
    });

    it("should persist thread count across multiple runs", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          // First run: 2 tool calls
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
              { id: "2", name: "calculator", args: { expression: "1+1" } },
            ],
          }),
          new AIMessage("First run response"),
          // Second run: 2 more tool calls (total: 4)
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "3", name: "search", args: { query: "test2" } },
              { id: "4", name: "calculator", args: { expression: "2+2" } },
            ],
          }),
          new AIMessage("Second run response"),
          // Third run: 1 more tool call (total: 5, exceeds limit of 4)
          new AIMessage({
            content: "",
            tool_calls: [{ id: "5", name: "search", args: { query: "test3" } }],
          }),
          new AIMessage("Should be blocked"),
        ],
      });

      const middleware = toolCallLimitMiddleware({
        threadLimit: 4,
        exitBehavior: "end",
      });

      const checkpointer = new MemorySaver();
      const agent = createAgent({
        model,
        tools: [searchTool, calculatorTool],
        middleware: [middleware],
        checkpointer,
      });

      const threadConfig = { configurable: { thread_id: "test-thread" } };

      // First run
      await agent.invoke(
        { messages: [new HumanMessage("First question")] },
        threadConfig
      );

      // Second run
      await agent.invoke(
        { messages: [new HumanMessage("Second question")] },
        threadConfig
      );

      const agent2 = createAgent({
        model,
        tools: [searchTool, calculatorTool],
        middleware: [middleware],
        checkpointer,
      });

      // Third run should hit limit
      const finalResult = await agent2.invoke(
        { messages: [new HumanMessage("Third question")] },
        threadConfig
      );

      const lastMessage = finalResult.messages[finalResult.messages.length - 1];
      expect(lastMessage.content).toContain("thread limit exceeded");
      expect(lastMessage.content).toContain("5/4");
      expect(searchToolMock).toHaveBeenCalledTimes(2);
      expect(calculatorToolMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Run-level Limits", () => {
    it("should allow tool calls under run limit", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "search", args: { query: "test" } }],
          }),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "2", name: "search", args: { query: "test" } }],
          }),
          new AIMessage("Response"),
        ],
      });

      const middleware = toolCallLimitMiddleware({
        runLimit: 2,
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [searchTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Search")],
      });

      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).not.toContain("run limit");
      expect(searchToolMock).toHaveBeenCalledTimes(2);
    });

    it("should terminate when run limit is exceeded", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
              { id: "2", name: "search", args: { query: "test2" } },
            ],
          }),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "3", name: "search", args: { query: "test3" } }],
          }),
          new AIMessage("Should not reach here"),
        ],
      });

      const middleware = toolCallLimitMiddleware({
        runLimit: 2,
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [searchTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Search for things")],
      });

      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).toContain("run limit exceeded");
      expect(lastMessage.content).toContain("3/2");
      expect(searchToolMock).toHaveBeenCalledTimes(2);
    });

    it("should reset run count after new HumanMessage", async () => {
      // Create separate model instances for each invocation
      let callCount = 0;
      const createModel = () => {
        return new FakeToolCallingChatModel({
          responses: [
            new AIMessage({
              content: "",
              tool_calls: [
                {
                  id: `${callCount++}`,
                  name: "search",
                  args: { query: "test1" },
                },
                {
                  id: `${callCount++}`,
                  name: "search",
                  args: { query: "test2" },
                },
              ],
            }),
            new AIMessage({
              content: "",
              tool_calls: [
                {
                  id: `${callCount++}`,
                  name: "search",
                  args: { query: "test3" },
                },
              ],
            }),
            new AIMessage(`Response ${callCount}`),
          ],
        });
      };

      const middleware = toolCallLimitMiddleware({
        runLimit: 2,
        exitBehavior: "end",
      });

      const threadConfig = { configurable: { thread_id: "test-thread" } };
      const checkpointer = new MemorySaver();
      const model = createModel();

      // First run - should hit run limit
      const agent1 = createAgent({
        model,
        tools: [searchTool],
        middleware: [middleware],
        checkpointer,
      });

      const result1 = await agent1.invoke(
        { messages: [new HumanMessage("First question")] },
        threadConfig
      );
      expect(searchToolMock).toHaveBeenCalledTimes(2);
      expect(result1.messages[result1.messages.length - 1].content).toContain(
        "run limit exceeded"
      );
      expect(result1.messages[result1.messages.length - 1].content).toContain(
        "3/2"
      );

      // Second run with new model - run count resets
      const agent2 = createAgent({
        model,
        tools: [searchTool],
        middleware: [middleware],
        checkpointer,
      });

      const result2 = await agent2.invoke(
        { messages: [new HumanMessage("Second question")] },
        threadConfig
      );
      const lastMessage = result2.messages[result2.messages.length - 1].content;
      expect(lastMessage).toContain("Response 3");
      expect(searchToolMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Tool-specific Limits", () => {
    it("should only count calls to specific tool", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test" } },
              { id: "2", name: "calculator", args: { expression: "1+1" } },
              { id: "3", name: "calculator", args: { expression: "2+2" } },
            ],
          }),
          new AIMessage("Response"),
        ],
      });

      const middleware = toolCallLimitMiddleware({
        toolName: "search",
        threadLimit: 2, // Increased to allow 1 search call
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [searchTool, calculatorTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Do calculations")],
      });

      // Should complete - only 1 search call, calculators don't count
      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).not.toContain("thread limit");
    });

    it("should terminate when specific tool limit is exceeded", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
              { id: "2", name: "calculator", args: { expression: "1+1" } },
            ],
          }),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "3", name: "search", args: { query: "test2" } }],
          }),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "4", name: "search", args: { query: "test3" } }],
          }),
          new AIMessage("Should not reach here"),
        ],
      });

      const middleware = toolCallLimitMiddleware({
        toolName: "search",
        threadLimit: 2,
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [searchTool, calculatorTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Search and calculate")],
      });

      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).toContain("'search' tool");
      expect(lastMessage.content).toContain("thread limit exceeded");
      expect(lastMessage.content).toContain("3/2");
      expect(searchToolMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Multiple Middleware Instances", () => {
    it("should work with both global and tool-specific limiters", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
              { id: "2", name: "search", args: { query: "test2" } },
              { id: "3", name: "calculator", args: { expression: "1+1" } },
            ],
          }),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "4", name: "search", args: { query: "test3" } }],
          }),
          new AIMessage("Should not reach here"),
        ],
      });

      const globalLimiter = toolCallLimitMiddleware({
        threadLimit: 10, // Won't hit this
        exitBehavior: "end",
      });

      const searchLimiter = toolCallLimitMiddleware({
        toolName: "search",
        threadLimit: 2, // Will hit this
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [searchTool, calculatorTool],
        middleware: [globalLimiter, searchLimiter],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Search and calculate")],
      });

      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).toContain("'search' tool");
      expect(lastMessage.content).toContain("thread limit exceeded");
      expect(lastMessage.content).toContain("3/2");
      expect(searchToolMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Behavior", () => {
    it("should throw an error if run limit exceeds thread limit", async () => {
      expect(() =>
        toolCallLimitMiddleware({
          threadLimit: 2,
          runLimit: 3,
          exitBehavior: "error",
        })
      ).toThrow(
        "runLimit (3) cannot exceed threadLimit (2). The run limit should be less than or equal to the thread limit."
      );
    });

    it("should throw ToolCallLimitExceededError when exitBehavior is error", async () => {
      const middleware = toolCallLimitMiddleware({
        threadLimit: 2,
        exitBehavior: "error",
      });

      // Test with state that will exceed limit after incrementing
      const state = {
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "search", args: { query: "test" } }],
          }),
        ],
        threadToolCallCount: {
          __all__: 2,
        },
        runToolCallCount: {
          __all__: 2,
        },
      };

      await expect(async () => {
        const fn = getHookFunction(middleware.afterModel as any);
        await fn(state as any, {} as any);
      }).rejects.toThrow(ToolCallLimitExceededError);
    });

    it("should include correct information in ToolCallLimitExceededError", async () => {
      const middleware = toolCallLimitMiddleware({
        threadLimit: 2,
        runLimit: 1,
        exitBehavior: "error",
      });

      const state = {
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "search", args: { query: "test" } }],
          }),
        ],
        threadToolCallCount: {
          __all__: 2,
        },
        runToolCallCount: {
          __all__: 1,
        },
      };

      try {
        const fn = getHookFunction(middleware.afterModel as any);
        await fn(state as any, {} as any);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(ToolCallLimitExceededError);
        const toolCallLimitExceededError = error as ToolCallLimitExceededError;
        expect(toolCallLimitExceededError.threadCount).toBe(3);
        expect(toolCallLimitExceededError.threadLimit).toBe(2);
        expect(toolCallLimitExceededError.runCount).toBe(2);
        expect(toolCallLimitExceededError.runLimit).toBe(1);
        expect(toolCallLimitExceededError.toolName).toBeUndefined();
        expect(toolCallLimitExceededError.message).toContain(
          "thread limit exceeded"
        );
        expect(toolCallLimitExceededError.message).toContain(
          "run limit exceeded"
        );
      }
    });

    it("should include tool name in error for tool-specific limits", async () => {
      const middleware = toolCallLimitMiddleware({
        toolName: "search",
        threadLimit: 2,
        exitBehavior: "error",
      });

      const state = {
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "search", args: { query: "test" } }],
          }),
        ],
        threadToolCallCount: {
          search: 2,
        },
        runToolCallCount: {
          search: 2,
        },
      };

      try {
        const fn = getHookFunction(middleware.afterModel! as any);
        await fn(state as any, {} as any);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(ToolCallLimitExceededError);
        const toolCallLimitExceededError = error as ToolCallLimitExceededError;
        expect(toolCallLimitExceededError.toolName).toBe("search");
        expect(toolCallLimitExceededError.message).toContain("'search' tool");
        expect(toolCallLimitExceededError.message).toContain(
          "thread limit exceeded"
        );
      }
    });

    it("should run remaining tools until limit is exceeded", async () => {
      const middleware = toolCallLimitMiddleware({
        threadLimit: 3,
        runLimit: 2,
        exitBehavior: "continue",
      });

      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
              { id: "2", name: "search", args: { query: "test2" } },
              { id: "3", name: "calculator", args: { expression: "1+1" } },
            ],
          }),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "4", name: "search", args: { query: "test3" } }],
          }),
          new AIMessage("Should not reach here"),
        ],
      });

      const agent = createAgent({
        model,
        tools: [searchTool, calculatorTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Search and calculate")],
      });

      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).toContain(
        "Tool call limit exceeded. Do not make additional tool calls."
      );
      expect(searchToolMock).toHaveBeenCalledTimes(2);
      expect(calculatorToolMock).toHaveBeenCalledTimes(0);
    });
  });

  describe("Combined Thread and Run Limits", () => {
    it("should check both thread and run limits", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
              { id: "2", name: "search", args: { query: "test2" } },
            ],
          }),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "3", name: "search", args: { query: "test3" } }],
          }),
          new AIMessage("Should not reach here"),
        ],
      });

      const middleware = toolCallLimitMiddleware({
        threadLimit: 5, // Won't hit this
        runLimit: 2, // Will hit this
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [searchTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Search")],
      });

      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).toContain("run limit exceeded");
      expect(lastMessage.content).toContain("3/2");
      expect(searchToolMock).toHaveBeenCalledTimes(2);
    });

    it("should report correct limit type when thread limit is hit first", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "search", args: { query: "test1" } }],
          }),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "2", name: "search", args: { query: "test2" } }],
          }),
          new AIMessage({
            content: "",
            tool_calls: [{ id: "3", name: "search", args: { query: "test3" } }],
          }),
          new AIMessage("Should not reach here"),
        ],
      });

      const middleware = toolCallLimitMiddleware({
        threadLimit: 2, // Will hit this
        runLimit: 2, // Won't hit this
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [searchTool],
        middleware: [middleware],
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        {
          messages: [new HumanMessage("Search")],
        },
        { configurable: { thread_id: "test-thread" } }
      );

      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).toContain("thread limit exceeded");
      expect(lastMessage.content).toContain("3/2");
      expect(searchToolMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle messages with no tool calls", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [new AIMessage("Just a response, no tool calls")],
      });

      const middleware = toolCallLimitMiddleware({
        threadLimit: 2,
        exitBehavior: "end",
      });

      const agent = createAgent({
        model,
        tools: [searchTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Hello")],
      });

      // Should complete without hitting limit
      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).not.toContain("thread limit");
      expect(lastMessage.content).not.toContain("run limit");
    });

    it("should handle empty message history", async () => {
      const middleware = toolCallLimitMiddleware({
        threadLimit: 5,
        exitBehavior: "end",
      });

      const state = {
        messages: [],
      };

      const fn = getHookFunction(middleware.afterModel! as any);
      const result = await fn(state as any, {} as any);
      expect(result).toBeUndefined();
    });

    it("should correctly count multiple tool calls in single AIMessage", async () => {
      const middleware = toolCallLimitMiddleware({
        threadLimit: 3,
        exitBehavior: "end",
      });

      const state = {
        messages: [
          new HumanMessage("Do multiple things"),
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
              { id: "2", name: "search", args: { query: "test2" } },
            ] as ToolCall[],
          }),
        ],
        threadToolCallCount: {
          __all__: 3,
        },
        runToolCallCount: {
          __all__: 3,
        },
      };

      const fn = getHookFunction(middleware.afterModel! as any);
      const result = await fn(state as any, {} as any);

      // Should hit limit (3 tool calls + 3 existing = 6, limit is 3)
      // Actually wait - the limit is 3, existing is 3, adding 3 more = 6 > 3
      expect(result).toBeDefined();

      const messages = (result as { messages: BaseMessage[] }).messages;
      // First message is ToolMessage (sent to model - no thread/run details)
      expect(messages[0]).toBeInstanceOf(ToolMessage);
      expect(messages[0].content).toContain("Tool call limit exceeded");
      // Last message is AI message (displayed to user - includes thread/run details)
      const aiMessage = messages[messages.length - 1];
      expect(aiMessage).toBeInstanceOf(AIMessage);
      expect(aiMessage.content).toContain("thread limit exceeded");
      expect(aiMessage.content).toContain("5/3");
    });

    it("should only support end for a single duplicate tool call", async () => {
      const middleware = toolCallLimitMiddleware({
        threadLimit: 3,
        exitBehavior: "end",
      });

      const state = {
        messages: [
          new HumanMessage("Do multiple things"),
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
              { id: "2", name: "search", args: { query: "test2" } },
              { id: "3", name: "calculator", args: { expression: "1+1" } },
            ] as ToolCall[],
          }),
        ],
        threadToolCallCount: {
          __all__: 3,
        },
        runToolCallCount: {
          __all__: 3,
        },
      };

      const fn = getHookFunction(middleware.afterModel! as any);
      await expect(async () => {
        await fn(state as any, {} as any);
      }).rejects.toThrow(
        "Cannot end execution with other tool calls pending. Found calls to: search, calculator."
      );
    });
  });

  describe("Continue Behavior", () => {
    it("should block exceeded tools but let other tools continue", async () => {
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "q1" } },
              { id: "2", name: "calculator", args: { expression: "1+1" } },
            ],
          }),
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "3", name: "search", args: { query: "q2" } },
              { id: "4", name: "calculator", args: { expression: "2+2" } },
            ],
          }),
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "5", name: "search", args: { query: "q3" } }, // Should be blocked
              { id: "6", name: "calculator", args: { expression: "3+3" } }, // Should work
            ],
          }),
          new AIMessage("Final response"),
        ],
      });

      // Limit search to 2 calls, but allow other tools to continue
      const searchLimiter = toolCallLimitMiddleware({
        toolName: "search",
        threadLimit: 2,
        exitBehavior: "continue",
      });

      const agent = createAgent({
        model,
        tools: [searchTool, calculatorTool],
        middleware: [searchLimiter],
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Question")] },
        { configurable: { thread_id: "test_thread" } }
      );

      const messages = result.messages;
      const toolMessages = messages.filter((msg): msg is ToolMessage =>
        ToolMessage.isInstance(msg)
      );

      // Verify search has 2 successful + 1 blocked, calculator has all 3 successful
      const searchSuccess = toolMessages.filter(
        (m) => m.name === "search" && m.status !== "error"
      );
      const searchBlocked = toolMessages.filter(
        (m) => m.name === "search" && m.status === "error"
      );
      const calcSuccess = toolMessages.filter(
        (m) => m.name === "calculator" && m.status !== "error"
      );

      expect(searchSuccess.length).toBe(2);
      expect(searchBlocked.length).toBe(1);
      expect(calcSuccess.length).toBe(3);
      expect(searchBlocked[0].content).toContain("limit");
      expect(searchBlocked[0].content).toContain("search");
    });
  });

  describe("End Behavior with Multiple Tool Calls", () => {
    it("should raise error when end behavior has multiple different tool types", async () => {
      const middleware = toolCallLimitMiddleware({
        threadLimit: 2,
        exitBehavior: "end",
      });

      const state = {
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
              { id: "2", name: "calculator", args: { expression: "1+1" } },
            ],
          }),
        ],
        threadToolCallCount: {
          __all__: 1,
        },
        runToolCallCount: {
          __all__: 1,
        },
      };

      await expect(async () => {
        const fn = getHookFunction(middleware.afterModel! as any);
        await fn(state as any, {} as any);
      }).rejects.toThrow(
        "Cannot end execution with other tool calls pending. Found calls to: search. Use 'continue' or 'error' behavior instead."
      );
    });
  });

  describe("Limit Reached but Not Exceeded", () => {
    it("should only trigger when limit is exceeded (>), not when reached (==)", async () => {
      const middleware = toolCallLimitMiddleware({
        threadLimit: 3,
        runLimit: 2,
        exitBehavior: "end",
      });

      // Test when limit is reached exactly (count = limit) - should not trigger
      const state1 = {
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "search", args: { query: "test" } }],
          }),
        ],
        threadToolCallCount: {
          __all__: 2,
        },
        runToolCallCount: {
          __all__: 1,
        },
      };

      const fn = getHookFunction(middleware.afterModel! as any);
      const result1 = await fn(state1 as any, {} as any);
      expect(result1).toBeDefined();
      expect("jumpTo" in (result1 || {})).toBe(false);
      expect((result1 as any)?.threadToolCallCount.__all__).toBe(3);

      // Test when limit is exceeded (count > limit) - should trigger
      const state2 = {
        messages: [
          new AIMessage({
            content: "",
            tool_calls: [{ id: "1", name: "search", args: { query: "test" } }],
          }),
        ],
        threadToolCallCount: {
          __all__: 3,
        },
        runToolCallCount: {
          __all__: 1,
        },
      };

      const result2 = await fn(state2 as any, {} as any);
      expect(result2).toBeDefined();
      expect((result2 as any)?.jumpTo).toBe("end");
    });
  });

  describe("Parallel Tool Call Limits", () => {
    /**
     * Test parallel tool calls with a limit of 1 in 'continue' mode.
     *
     * When the model proposes 3 tool calls with a limit of 1:
     * - The first call should execute successfully
     * - The 2nd and 3rd calls should be blocked with error ToolMessages
     * - Execution should continue (no jump_to)
     */
    it("should handle parallel tool calls with limit in continue mode", async () => {
      const searchToolMock = vi.fn(async ({ query }: { query: string }) => {
        return `Results: ${query}`;
      });
      const search = tool(searchToolMock, {
        name: "search",
        description: "Search for information",
        schema: z.object({ query: z.string() }),
      });

      // Model proposes 3 parallel search calls in a single AIMessage
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "q1" } },
              { id: "2", name: "search", args: { query: "q2" } },
              { id: "3", name: "search", args: { query: "q3" } },
            ],
          }),
          new AIMessage("Final response"), // Model stops after seeing the errors
        ],
      });

      const limiter = toolCallLimitMiddleware({
        threadLimit: 1,
        exitBehavior: "continue",
      });
      const agent = createAgent({
        model,
        tools: [search],
        middleware: [limiter],
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Test")] },
        { configurable: { thread_id: "test" } }
      );
      const messages = result.messages;

      // Verify tool message counts
      const toolMessages = messages.filter((msg): msg is ToolMessage =>
        ToolMessage.isInstance(msg)
      );
      const successfulToolMessages = toolMessages.filter(
        (msg) => msg.status !== "error"
      );
      const errorToolMessages = toolMessages.filter(
        (msg) => msg.status === "error"
      );

      expect(successfulToolMessages.length).toBe(1);
      expect(errorToolMessages.length).toBe(2);

      // Verify the successful call is q1
      expect(successfulToolMessages[0].content).toContain("q1");

      // Verify error messages explain the limit
      for (const errorMsg of errorToolMessages) {
        const content =
          typeof errorMsg.content === "string"
            ? errorMsg.content
            : String(errorMsg.content);
        expect(content.toLowerCase()).toContain("limit");
      }

      // Verify execution continued (no early termination)
      const aiMessages = messages.filter((msg): msg is AIMessage =>
        AIMessage.isInstance(msg)
      );
      // Should have: initial AI message with 3 tool calls, then final AI message (no tool calls)
      expect(aiMessages.length).toBeGreaterThanOrEqual(2);
      expect(searchToolMock).toHaveBeenCalledTimes(1);
    });

    /**
     * Test parallel tool calls with a limit of 1 in 'end' mode.
     *
     * When the model proposes 3 tool calls with a limit of 1:
     * - The first call would be allowed (within limit)
     * - The 2nd and 3rd calls exceed the limit and get blocked with error ToolMessages
     * - Execution stops immediately (jump_to: end) so NO tools actually execute
     * - An AI message explains why execution stopped
     */
    it("should handle parallel tool calls with limit in end mode", async () => {
      const search = tool(
        async ({ query }: { query: string }) => {
          return `Results: ${query}`;
        },
        {
          name: "search",
          description: "Search for information",
          schema: z.object({ query: z.string() }),
        }
      );

      // Model proposes 3 parallel search calls
      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "q1" } },
              { id: "2", name: "search", args: { query: "q2" } },
              { id: "3", name: "search", args: { query: "q3" } },
            ],
          }),
          new AIMessage("Should not reach here"),
        ],
      });

      const limiter = toolCallLimitMiddleware({
        threadLimit: 1,
        exitBehavior: "end",
      });
      const agent = createAgent({
        model,
        tools: [search],
        middleware: [limiter],
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Test")] },
        { configurable: { thread_id: "test" } }
      );
      const messages = result.messages;

      // Verify tool message counts
      // With "end" behavior, when we jump to end, NO tools execute (not even allowed ones)
      // We only get error ToolMessages for the 2 blocked calls
      const toolMessages = messages.filter((msg): msg is ToolMessage =>
        ToolMessage.isInstance(msg)
      );
      const successfulToolMessages = toolMessages.filter(
        (msg) => msg.status !== "error"
      );
      const errorToolMessages = toolMessages.filter(
        (msg) => msg.status === "error"
      );

      expect(successfulToolMessages.length).toBe(0);
      expect(errorToolMessages.length).toBe(2);

      // Verify error tool messages (sent to model - include "Do not" instruction)
      for (const errorMsg of errorToolMessages) {
        const content =
          typeof errorMsg.content === "string"
            ? errorMsg.content
            : String(errorMsg.content);
        expect(content).toContain("Tool call limit exceeded");
        expect(content).toContain("Do not");
      }

      // Verify AI message explaining why execution stopped (displayed to user - includes thread/run details)
      const aiLimitMessages = messages.filter(
        (msg): msg is AIMessage =>
          AIMessage.isInstance(msg) &&
          (!msg.tool_calls || msg.tool_calls.length === 0) &&
          (() => {
            const content =
              typeof msg.content === "string"
                ? msg.content
                : String(msg.content);
            return content.toLowerCase().includes("limit");
          })()
      );
      expect(aiLimitMessages.length).toBeGreaterThanOrEqual(1);

      if (aiLimitMessages.length > 0) {
        const aiMsgContent =
          typeof aiLimitMessages[0].content === "string"
            ? aiLimitMessages[0].content
            : String(aiLimitMessages[0].content);
        expect(
          aiMsgContent.toLowerCase().includes("thread limit exceeded") ||
            aiMsgContent.toLowerCase().includes("run limit exceeded")
        ).toBe(true);
      }
    });

    /**
     * Test parallel calls to different tools when limiting a specific tool.
     *
     * When limiting 'search' to 1 call, and model proposes 3 search + 2 calculator calls:
     * - First search call should execute
     * - Other 2 search calls should be blocked
     * - All calculator calls should execute (not limited)
     */
    it("should handle parallel mixed tool calls with specific tool limit", async () => {
      const search = tool(
        async ({ query }: { query: string }) => {
          return `Search: ${query}`;
        },
        {
          name: "search",
          description: "Search for information",
          schema: z.object({ query: z.string() }),
        }
      );

      const calculator = tool(
        async ({ expression }: { expression: string }) => {
          return `Calc: ${expression}`;
        },
        {
          name: "calculator",
          description: "Calculate an expression",
          schema: z.object({ expression: z.string() }),
        }
      );

      const model = new FakeToolCallingChatModel({
        responses: [
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "q1" } },
              { id: "2", name: "calculator", args: { expression: "1+1" } },
              { id: "3", name: "search", args: { query: "q2" } },
              { id: "4", name: "calculator", args: { expression: "2+2" } },
              { id: "5", name: "search", args: { query: "q3" } },
            ],
          }),
          new AIMessage("Final response"),
        ],
      });

      const searchLimiter = toolCallLimitMiddleware({
        toolName: "search",
        threadLimit: 1,
        exitBehavior: "continue",
      });
      const agent = createAgent({
        model,
        tools: [search, calculator],
        middleware: [searchLimiter],
        checkpointer: new MemorySaver(),
      });

      const result = await agent.invoke(
        { messages: [new HumanMessage("Test")] },
        { configurable: { thread_id: "test" } }
      );
      const messages = result.messages;

      const toolMessages = messages.filter((msg): msg is ToolMessage =>
        ToolMessage.isInstance(msg)
      );
      const searchSuccess = toolMessages.filter(
        (m) => m.name === "search" && m.status !== "error"
      );
      const searchBlocked = toolMessages.filter((m) => {
        if (m.name !== "search" || m.status !== "error") {
          return false;
        }
        const content =
          typeof m.content === "string" ? m.content : String(m.content);
        return content.toLowerCase().includes("limit");
      });
      const calcSuccess = toolMessages.filter(
        (m) => m.name === "calculator" && m.status !== "error"
      );

      expect(searchSuccess.length).toBe(1);
      expect(searchBlocked.length).toBe(2);
      expect(calcSuccess.length).toBe(2);
    });
  });
});
