/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-instanceof/no-instanceof */
import { describe, it, expect } from "vitest";
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
  const searchTool = tool(async ({ query }) => `Results for: ${query}`, {
    name: "search",
    description: "Search for information",
    schema: z.object({
      query: z.string(),
    }),
  });

  const calculatorTool = tool(
    async ({ expression }) => `Result: ${expression}`,
    {
      name: "calculator",
      description: "Calculate an expression",
      schema: z.object({
        expression: z.string(),
      }),
    }
  );

  describe("Initialization and Validation", () => {
    it("should throw error if no limits are specified", () => {
      expect(() =>
        toolCallLimitMiddleware({
          // No threadLimit or runLimit
        } as any)
      ).toThrow("At least one limit must be specified");
    });

    it("should throw error for invalid exit behavior", () => {
      expect(() =>
        toolCallLimitMiddleware({
          threadLimit: 5,
          exitBehavior: "invalid" as any,
        })
      ).toThrow("Invalid exit behavior: invalid");
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
      expect(lastMessage.content).toContain("thread limit reached (3/3)");
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
          // Second run: 2 more tool calls (total: 4, at limit)
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "3", name: "search", args: { query: "test2" } },
              { id: "4", name: "calculator", args: { expression: "2+2" } },
            ],
          }),
          new AIMessage("Second run response"),
          // Third run: would exceed limit
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
        middleware: [middleware] as const,
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
        middleware: [middleware] as const,
        checkpointer,
      });

      // Third run should hit limit
      const finalResult = await agent2.invoke(
        { messages: [new HumanMessage("Third question")] },
        threadConfig
      );

      const lastMessage = finalResult.messages[finalResult.messages.length - 1];
      expect(lastMessage.content).toContain("thread limit reached (4/4)");
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
      expect(lastMessage.content).toContain("run limit reached (2/2)");
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
            new AIMessage(`Response ${callCount}`),
          ],
        });
      };

      const middleware = toolCallLimitMiddleware({
        runLimit: 2,
        exitBehavior: "end",
      });

      const threadConfig = { configurable: { thread_id: "test-thread" } };

      // First run - should hit run limit
      const agent1 = createAgent({
        model: createModel(),
        tools: [searchTool],
        middleware: [middleware],
        checkpointer: new MemorySaver(),
      });

      const result1 = await agent1.invoke(
        { messages: [new HumanMessage("First question")] },
        threadConfig
      );
      expect(result1.messages[result1.messages.length - 1].content).toContain(
        "run limit reached (2/2)"
      );

      // Second run with new model - run count resets, should also hit limit
      const agent2 = createAgent({
        model: createModel(),
        tools: [searchTool],
        middleware: [middleware],
        checkpointer: new MemorySaver(),
      });

      const result2 = await agent2.invoke(
        { messages: [new HumanMessage("Second question")] },
        threadConfig
      );
      expect(result2.messages[result2.messages.length - 1].content).toContain(
        "run limit reached (2/2)"
      );
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
      expect(lastMessage.content).toContain("'search' tool call");
      expect(lastMessage.content).toContain("thread limit reached (2/2)");
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
      expect(lastMessage.content).toContain("'search' tool call");
      expect(lastMessage.content).toContain("thread limit reached (2/2)");
    });
  });

  describe("Error Behavior", () => {
    it("should throw ToolCallLimitExceededError when exitBehavior is error", async () => {
      const middleware = toolCallLimitMiddleware({
        threadLimit: 2,
        exitBehavior: "error",
      });

      // Test with state that has exceeded limit
      const state = {
        messages: [
          new HumanMessage("Q"),
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
            ] as ToolCall[],
          }),
          new ToolMessage("Result", "1"),
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "2", name: "search", args: { query: "test2" } },
            ] as ToolCall[],
          }),
        ],
      };

      await expect(async () => {
        const fn = getHookFunction(middleware.beforeModel!);
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
          new HumanMessage("Q"),
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
            ] as ToolCall[],
          }),
          new ToolMessage("Result", "1"),
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "2", name: "search", args: { query: "test2" } },
            ] as ToolCall[],
          }),
        ],
      };

      try {
        const fn = getHookFunction(middleware.beforeModel!);
        await fn(state as any, {} as any);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(ToolCallLimitExceededError);
        if (error instanceof ToolCallLimitExceededError) {
          expect(error.threadCount).toBe(2);
          expect(error.threadLimit).toBe(2);
          expect(error.runCount).toBe(2);
          expect(error.runLimit).toBe(1);
          expect(error.toolName).toBeUndefined();
          expect(error.message).toContain("thread limit reached (2/2)");
          expect(error.message).toContain("run limit reached (2/1)");
        }
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
          new HumanMessage("Q"),
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "1", name: "search", args: { query: "test1" } },
              { id: "2", name: "calculator", args: { expression: "1+1" } },
            ] as ToolCall[],
          }),
          new ToolMessage("Result", "1"),
          new ToolMessage("Result", "2"),
          new AIMessage({
            content: "",
            tool_calls: [
              { id: "3", name: "search", args: { query: "test2" } },
            ] as ToolCall[],
          }),
        ],
      };

      try {
        const fn = getHookFunction(middleware.beforeModel!);
        await fn(state as any, {} as any);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(ToolCallLimitExceededError);
        if (error instanceof ToolCallLimitExceededError) {
          expect(error.toolName).toBe("search");
          expect(error.message).toContain("'search' tool call");
        }
      }
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
      expect(lastMessage.content).toContain("run limit reached (2/2)");
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
          new AIMessage("Should not reach here"),
        ],
      });

      const middleware = toolCallLimitMiddleware({
        threadLimit: 2, // Will hit this
        runLimit: 10, // Won't hit this
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
      expect(lastMessage.content).toContain("thread limit reached (2/2)");
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

      const fn = getHookFunction(middleware.beforeModel!);
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
              { id: "3", name: "calculator", args: { expression: "1+1" } },
            ] as ToolCall[],
          }),
        ],
      };

      const fn = getHookFunction(middleware.beforeModel!);
      const result = await fn(state as any, {} as any);

      // Should hit limit (3 tool calls)
      expect(result).toBeDefined();

      const messages = (result as { messages: BaseMessage[] }).messages;
      expect(messages[0].content).toContain("thread limit reached (3/3)");
    });
  });
});
