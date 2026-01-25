/**
 * Tests for dynamic tool registration via middleware.
 *
 * These tests verify that middleware can dynamically register and handle tools
 * that are not declared upfront when creating the agent.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import { tool } from "@langchain/core/tools";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";

import { createAgent, createMiddleware } from "../../index.js";
import { FakeToolCallingModel } from "../../tests/utils.js";

// Static tool that is always available
const staticTool = tool(
  async (input: { value: string }) => `Static result: ${input.value}`,
  {
    name: "static_tool",
    description: "A static tool that is always available",
    schema: z.object({
      value: z.string(),
    }),
  }
);

// Dynamic tool that is registered at runtime via middleware
const dynamicTool = tool(
  async (input: { value: string }) => `Dynamic result: ${input.value}`,
  {
    name: "dynamic_tool",
    description: "A dynamically registered tool",
    schema: z.object({
      value: z.string(),
    }),
  }
);

// Another dynamic tool for calculations
const anotherDynamicTool = tool(
  async (input: { x: number; y: number }) => `Sum: ${input.x + input.y}`,
  {
    name: "calculate_sum",
    description: "Another dynamically registered tool for calculations",
    schema: z.object({
      x: z.number(),
      y: z.number(),
    }),
  }
);

describe("Dynamic Tool Registration via Middleware", () => {
  describe("Basic dynamic tool registration", () => {
    it("should allow middleware to handle dynamically registered tools via wrapToolCall", async () => {
      // Middleware that handles a dynamic tool
      const dynamicToolMiddleware = createMiddleware({
        name: "dynamicToolMiddleware",
        wrapToolCall: async (request, handler) => {
          if (request.toolCall.name === "dynamic_tool") {
            // Request.tool should be undefined for unregistered tools
            expect(request.tool).toBeUndefined();
            // Provide the tool implementation by spreading the request
            return handler({ ...request, tool: dynamicTool });
          }
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            {
              name: "dynamic_tool",
              args: { value: "test" },
              id: "call_1",
            },
          ],
          [], // No more tool calls
        ],
      });

      const agent = createAgent({
        model,
        tools: [staticTool],
        middleware: [dynamicToolMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Use the dynamic tool")],
      });

      // Verify the dynamic tool was executed
      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages.length).toBe(1);
      expect(toolMessages[0].content).toBe("Dynamic result: test");
      expect(toolMessages[0].name).toBe("dynamic_tool");
    });

    it("should handle both static and dynamic tools in the same execution", async () => {
      const dynamicToolMiddleware = createMiddleware({
        name: "dynamicToolMiddleware",
        wrapToolCall: async (request, handler) => {
          if (request.toolCall.name === "dynamic_tool") {
            return handler({ ...request, tool: dynamicTool });
          }
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            { name: "static_tool", args: { value: "static" }, id: "call_1" },
            { name: "dynamic_tool", args: { value: "dynamic" }, id: "call_2" },
          ],
          [],
        ],
      });

      const agent = createAgent({
        model,
        tools: [staticTool],
        middleware: [dynamicToolMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Use both tools")],
      });

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages.length).toBe(2);

      const staticResult = toolMessages.find((m) => m.name === "static_tool");
      const dynamicResult = toolMessages.find((m) => m.name === "dynamic_tool");

      expect(staticResult?.content).toBe("Static result: static");
      expect(dynamicResult?.content).toBe("Dynamic result: dynamic");
    });

    it("should gracefully return error when middleware doesn't handle unregistered tool", async () => {
      // Middleware that doesn't handle the dynamic tool (passthrough)
      const passthroughMiddleware = createMiddleware({
        name: "passthroughMiddleware",
        wrapToolCall: async (request, handler) => {
          // Just pass through without providing tool implementation
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "nonexistent_tool", args: {}, id: "call_1" }], []],
      });

      const agent = createAgent({
        model,
        tools: [staticTool],
        middleware: [passthroughMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Use nonexistent tool")],
      });

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages.length).toBe(1);
      expect(toolMessages[0].status).toBe("error");
      expect(toolMessages[0].content).toContain(
        "nonexistent_tool is not a valid tool"
      );
      expect(toolMessages[0].content).toContain("static_tool");
    });
  });

  describe("Tool override functionality", () => {
    it("should allow override of tool call parameters", async () => {
      const modifyingMiddleware = createMiddleware({
        name: "modifyingMiddleware",
        wrapToolCall: async (request, handler) => {
          // Modify the tool call args using spread syntax
          return handler({
            ...request,
            toolCall: {
              ...request.toolCall,
              args: { value: "modified" },
            },
          });
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "static_tool", args: { value: "original" }, id: "call_1" }],
          [],
        ],
      });

      const agent = createAgent({
        model,
        tools: [staticTool],
        middleware: [modifyingMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Use the tool")],
      });

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages.length).toBe(1);
      expect(toolMessages[0].content).toBe("Static result: modified");
    });

    it("should allow chained spread modifications", async () => {
      const middleware = createMiddleware({
        name: "chainingMiddleware",
        wrapToolCall: async (request, handler) => {
          // Chain multiple modifications using spread syntax
          const step1 = {
            ...request,
            toolCall: {
              ...request.toolCall,
              args: { value: "step1" },
            },
          };
          const step2 = {
            ...step1,
            toolCall: {
              ...step1.toolCall,
              args: { value: "step2" },
            },
          };
          return handler(step2);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "static_tool", args: { value: "original" }, id: "call_1" }],
          [],
        ],
      });

      const agent = createAgent({
        model,
        tools: [staticTool],
        middleware: [middleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Use the tool")],
      });

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages[0].content).toBe("Static result: step2");
    });
  });

  describe("Agent without pre-registered tools", () => {
    it("should work with only dynamic tools via middleware", async () => {
      const dynamicOnlyMiddleware = createMiddleware({
        name: "dynamicOnlyMiddleware",
        wrapToolCall: async (request, handler) => {
          if (request.toolCall.name === "dynamic_tool") {
            return handler({ ...request, tool: dynamicTool });
          }
          if (request.toolCall.name === "calculate_sum") {
            return handler({ ...request, tool: anotherDynamicTool });
          }
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            { name: "dynamic_tool", args: { value: "hello" }, id: "call_1" },
            { name: "calculate_sum", args: { x: 5, y: 3 }, id: "call_2" },
          ],
          [],
        ],
      });

      // Create agent with NO tools, only middleware
      const agent = createAgent({
        model,
        tools: [],
        middleware: [dynamicOnlyMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Use the dynamic tools")],
      });

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages.length).toBe(2);

      const dynamicResult = toolMessages.find((m) => m.name === "dynamic_tool");
      const sumResult = toolMessages.find((m) => m.name === "calculate_sum");

      expect(dynamicResult?.content).toBe("Dynamic result: hello");
      expect(sumResult?.content).toBe("Sum: 8");
    });
  });

  describe("Middleware chain with dynamic tools", () => {
    it("should preserve middleware chain order with dynamic tools", async () => {
      const callLog: string[] = [];

      const loggingMiddleware = createMiddleware({
        name: "loggingMiddleware",
        wrapToolCall: async (request, handler) => {
          callLog.push("logging_before");
          const result = await handler(request);
          callLog.push("logging_after");
          return result;
        },
      });

      const dynamicToolMiddleware = createMiddleware({
        name: "dynamicToolMiddleware",
        wrapToolCall: async (request, handler) => {
          callLog.push("dynamic_before");
          if (request.toolCall.name === "dynamic_tool") {
            const result = await handler({ ...request, tool: dynamicTool });
            callLog.push("dynamic_after");
            return result;
          }
          const result = await handler(request);
          callLog.push("dynamic_after");
          return result;
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "dynamic_tool", args: { value: "test" }, id: "call_1" }],
          [],
        ],
      });

      const agent = createAgent({
        model,
        tools: [staticTool],
        middleware: [loggingMiddleware, dynamicToolMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Use the dynamic tool")],
      });

      // Verify middleware chain was executed in correct order
      expect(callLog).toEqual([
        "logging_before",
        "dynamic_before",
        "dynamic_after",
        "logging_after",
      ]);

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages.length).toBe(1);
      expect(toolMessages[0].content).toBe("Dynamic result: test");
    });
  });

  describe("Error handling with dynamic tools", () => {
    it("should handle errors from dynamic tools when middleware catches them", async () => {
      const errorTool = tool(
        async () => {
          throw new Error("Dynamic tool error");
        },
        {
          name: "error_tool",
          description: "A tool that throws an error",
          schema: z.object({}),
        }
      );

      // Middleware needs to explicitly catch errors from dynamic tools
      // since the default behavior re-throws middleware errors
      const errorMiddleware = createMiddleware({
        name: "errorMiddleware",
        wrapToolCall: async (request, handler) => {
          if (request.toolCall.name === "error_tool") {
            try {
              return await handler({ ...request, tool: errorTool });
            } catch (e) {
              // Convert the error to a ToolMessage so LLM can see it
              return new ToolMessage({
                content: `${e}\n Please fix your mistakes.`,
                tool_call_id: request.toolCall.id!,
                name: "error_tool",
              });
            }
          }
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "error_tool", args: {}, id: "call_1" }], []],
      });

      const agent = createAgent({
        model,
        tools: [staticTool],
        middleware: [errorMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Use the error tool")],
      });

      // Error should be caught by middleware and converted to a tool message
      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages.length).toBe(1);
      expect(toolMessages[0].content).toContain("Dynamic tool error");
    });

    it("should let middleware handle errors from dynamic tools", async () => {
      const errorTool = tool(
        async () => {
          throw new Error("Dynamic tool error");
        },
        {
          name: "error_tool",
          description: "A tool that throws an error",
          schema: z.object({}),
        }
      );

      const errorHandlingMiddleware = createMiddleware({
        name: "errorHandlingMiddleware",
        wrapToolCall: async (request, handler) => {
          if (request.toolCall.name === "error_tool") {
            try {
              return await handler({ ...request, tool: errorTool });
            } catch (error) {
              // Handle the error and return a custom message
              return new ToolMessage({
                content: "Error handled by middleware",
                tool_call_id: request.toolCall.id!,
                name: "error_tool",
              });
            }
          }
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [[{ name: "error_tool", args: {}, id: "call_1" }], []],
      });

      const agent = createAgent({
        model,
        tools: [staticTool],
        middleware: [errorHandlingMiddleware],
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("Use the error tool")],
      });

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages.length).toBe(1);
      expect(toolMessages[0].content).toBe("Error handled by middleware");
    });
  });

  describe("ToolCallRequest.tool property", () => {
    it("should have tool defined for registered tools", async () => {
      let capturedTool: unknown;

      const inspectingMiddleware = createMiddleware({
        name: "inspectingMiddleware",
        wrapToolCall: async (request, handler) => {
          capturedTool = request.tool;
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "static_tool", args: { value: "test" }, id: "call_1" }],
          [],
        ],
      });

      const agent = createAgent({
        model,
        tools: [staticTool],
        middleware: [inspectingMiddleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Use the static tool")],
      });

      // Tool should be defined for registered tools
      expect(capturedTool).toBeDefined();
      expect((capturedTool as { name: string }).name).toBe("static_tool");
    });

    it("should have tool undefined for unregistered tools", async () => {
      let capturedTool: unknown = "not-set";

      const inspectingMiddleware = createMiddleware({
        name: "inspectingMiddleware",
        wrapToolCall: async (request, handler) => {
          capturedTool = request.tool;
          if (request.toolCall.name === "dynamic_tool") {
            return handler({ ...request, tool: dynamicTool });
          }
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "dynamic_tool", args: { value: "test" }, id: "call_1" }],
          [],
        ],
      });

      const agent = createAgent({
        model,
        tools: [staticTool],
        middleware: [inspectingMiddleware],
      });

      await agent.invoke({
        messages: [new HumanMessage("Use the dynamic tool")],
      });

      // Tool should be undefined for unregistered tools
      expect(capturedTool).toBeUndefined();
    });
  });

  describe("With checkpointer", () => {
    it("should work with dynamic tools across multiple invocations", async () => {
      const dynamicToolMiddleware = createMiddleware({
        name: "dynamicToolMiddleware",
        wrapToolCall: async (request, handler) => {
          if (request.toolCall.name === "dynamic_tool") {
            return handler({ ...request, tool: dynamicTool });
          }
          return handler(request);
        },
      });

      const model = new FakeToolCallingModel({
        toolCalls: [
          [{ name: "dynamic_tool", args: { value: "first" }, id: "call_1" }],
          [],
          [{ name: "dynamic_tool", args: { value: "second" }, id: "call_2" }],
          [],
        ],
      });

      const agent = createAgent({
        model,
        tools: [staticTool],
        middleware: [dynamicToolMiddleware],
        checkpointer: new MemorySaver(),
      });

      const config = { configurable: { thread_id: "test-thread" } };

      // First invocation
      const result1 = await agent.invoke(
        { messages: [new HumanMessage("First call")] },
        config
      );

      const toolMessages1 = result1.messages.filter(ToolMessage.isInstance);
      expect(toolMessages1.length).toBe(1);
      expect(toolMessages1[0].content).toBe("Dynamic result: first");

      // Second invocation
      const result2 = await agent.invoke(
        { messages: [new HumanMessage("Second call")] },
        config
      );

      const toolMessages2 = result2.messages.filter(ToolMessage.isInstance);
      expect(toolMessages2.length).toBe(2);
      expect(toolMessages2[1].content).toBe("Dynamic result: second");
    });
  });
});
