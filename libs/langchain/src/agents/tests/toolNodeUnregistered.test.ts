/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test ToolNode handling of unregistered tools with interceptors.
 * Based on Python PR #33512.
 */
import { describe, it, expect } from "vitest";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { Command, isCommand } from "@langchain/langgraph";
import { z } from "zod/v3";

import { ToolNode } from "../nodes/ToolNode.js";
import type { ToolCallRequest, WrapToolCallHook } from "../middleware/types.js";

describe("ToolNode unregistered tool handling", () => {
  const registeredTool = tool(({ x }) => `Result: ${x}`, {
    name: "registered_tool",
    description: "A registered tool",
    schema: z.object({
      x: z.number(),
    }),
  });

  it("should allow interceptor to handle unregistered tools", async () => {
    const interceptor: WrapToolCallHook = async (request, handler) => {
      // Intercept and handle unregistered tools
      if (request.toolCall.name === "unregistered_tool") {
        return new ToolMessage({
          content: "Handled by interceptor",
          tool_call_id: request.toolCall.id!,
          name: "unregistered_tool",
        });
      }
      // Pass through for registered tools
      return handler(request);
    };

    const toolNode = new ToolNode([registeredTool], {
      wrapToolCall: interceptor,
    });

    // Test registered tool works normally
    const result1 = await toolNode.invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "registered_tool",
            args: { x: 42 },
            id: "1",
            type: "tool_call",
          },
        ],
      }),
    ]);

    expect(result1).toHaveLength(1);
    expect(result1[0].content).toBe("Result: 42");
    expect((result1[0] as ToolMessage).tool_call_id).toBe("1");

    // Test unregistered tool is intercepted and handled
    const result2 = await toolNode.invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "unregistered_tool",
            args: { x: 99 },
            id: "2",
            type: "tool_call",
          },
        ],
      }),
    ]);

    expect(result2).toHaveLength(1);
    expect(result2[0].content).toBe("Handled by interceptor");
    expect((result2[0] as ToolMessage).tool_call_id).toBe("2");
    expect((result2[0] as ToolMessage).name).toBe("unregistered_tool");
  });

  it("should return error when handler is called with unregistered tool", async () => {
    /**
     * skip as test requires primitives from `@langchain/core` that aren't released yet
     * and fails in dependency range tests, remove after next release
     */
    if (process.env.LC_DEPENDENCY_RANGE_TESTS) {
      return;
    }

    const badInterceptor: WrapToolCallHook = async (request, handler) => {
      // This should fail validation when handler is called
      return handler(request);
    };

    const toolNode = new ToolNode([registeredTool], {
      wrapToolCall: badInterceptor,
      handleToolErrors: true, // Ensure errors are converted to ToolMessage
    });

    // Registered tool should still work
    const result1 = await toolNode.invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "registered_tool",
            args: { x: 42 },
            id: "1",
            type: "tool_call",
          },
        ],
      }),
    ]);

    expect(result1[0].content).toBe("Result: 42");

    // Unregistered tool should return error when handler is called
    const result2 = await toolNode.invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "unregistered_tool",
            args: { x: 99 },
            id: "2",
            type: "tool_call",
          },
        ],
      }),
    ]);

    const toolMsg = result2[0] as ToolMessage;
    expect(toolMsg.status).toBe("error");
    expect(toolMsg.content).toContain("is not a valid tool");
    expect(toolMsg.tool_call_id).toBe("2");
  });

  it("should handle mix of registered and unregistered tools", async () => {
    /**
     * skip as test requires primitives from `@langchain/core` that aren't released yet
     * and fails in dependency range tests, remove after next release
     */
    if (process.env.LC_DEPENDENCY_RANGE_TESTS) {
      return;
    }

    const selectiveInterceptor: WrapToolCallHook = async (request, handler) => {
      // Handle unregistered tools, pass through registered ones
      if (request.toolCall.name === "magic_tool") {
        const value = (request.toolCall.args as any).value || 0;
        return new ToolMessage({
          content: `Magic result: ${value * 2}`,
          tool_call_id: request.toolCall.id!,
          name: "magic_tool",
        });
      }
      return handler(request);
    };

    const toolNode = new ToolNode([registeredTool], {
      wrapToolCall: selectiveInterceptor,
    });

    // Test multiple tool calls - mix of registered and unregistered
    const result = await toolNode.invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "registered_tool",
            args: { x: 10 },
            id: "1",
            type: "tool_call",
          },
          {
            name: "magic_tool",
            args: { value: 5 },
            id: "2",
            type: "tool_call",
          },
          {
            name: "registered_tool",
            args: { x: 20 },
            id: "3",
            type: "tool_call",
          },
        ],
      }),
    ]);

    // All tools should execute successfully
    expect(result).toHaveLength(3);
    expect(result[0].content).toBe("Result: 10");
    expect((result[0] as ToolMessage).tool_call_id).toBe("1");
    expect(result[1].content).toBe("Magic result: 10");
    expect((result[1] as ToolMessage).tool_call_id).toBe("2");
    expect(result[2].content).toBe("Result: 20");
    expect((result[2] as ToolMessage).tool_call_id).toBe("3");
  });

  it("should allow interceptor to return Command for unregistered tool", async () => {
    /**
     * skip as test requires primitives from `@langchain/core` that aren't released yet
     * and fails in dependency range tests, remove after next release
     */
    if (process.env.LC_DEPENDENCY_RANGE_TESTS) {
      return;
    }

    const commandInterceptor: WrapToolCallHook = async (request, handler) => {
      // Return Command for unregistered tools
      if (request.toolCall.name === "routing_tool") {
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: "Routing to special handler",
                tool_call_id: request.toolCall.id!,
                name: "routing_tool",
              }),
            ],
          },
          goto: ["special_node"],
        });
      }
      return handler(request);
    };

    const toolNode = new ToolNode([registeredTool], {
      wrapToolCall: commandInterceptor,
    });

    const result = await toolNode.invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "routing_tool",
            args: {},
            id: "1",
            type: "tool_call",
          },
        ],
      }),
    ]);

    // Should get Command back
    expect(Array.isArray(result)).toBe(true);
    expect((result as any).length).toBe(1);

    const command = (result as any)[0];
    expect(isCommand(command)).toBe(true);
    expect(command.goto).toEqual(["special_node"]);
    expect(command.update).toBeDefined();
    const update = command.update as any;
    expect(update.messages).toHaveLength(1);
    expect(update.messages[0].content).toBe("Routing to special handler");
  });

  it("should verify that request.tool is undefined for unregistered tools", async () => {
    /**
     * skip as test requires primitives from `@langchain/core` that aren't released yet
     * and fails in dependency range tests, remove after next release
     */
    if (process.env.LC_DEPENDENCY_RANGE_TESTS) {
      return;
    }

    const capturedRequests: ToolCallRequest[] = [];

    const capturingInterceptor: WrapToolCallHook = async (request, handler) => {
      // Capture request to verify tool field
      capturedRequests.push(request);

      if (request.tool === undefined) {
        // Tool is unregistered
        return new ToolMessage({
          content: `Unregistered: ${request.toolCall.name}`,
          tool_call_id: request.toolCall.id!,
          name: request.toolCall.name,
        });
      }
      // Tool is registered
      return handler(request);
    };

    const toolNode = new ToolNode([registeredTool], {
      wrapToolCall: capturingInterceptor,
    });

    // Test unregistered tool
    await toolNode.invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "unknown_tool",
            args: {},
            id: "1",
            type: "tool_call",
          },
        ],
      }),
    ]);

    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0].tool).toBeUndefined();
    expect(capturedRequests[0].toolCall.name).toBe("unknown_tool");

    // Clear and test registered tool
    capturedRequests.length = 0;

    await toolNode.invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "registered_tool",
            args: { x: 10 },
            id: "2",
            type: "tool_call",
          },
        ],
      }),
    ]);

    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0].tool).toBeDefined();
    expect(capturedRequests[0].tool?.name).toBe("registered_tool");
  });

  it("should work with dict input format", async () => {
    /**
     * skip as test requires primitives from `@langchain/core` that aren't released yet
     * and fails in dependency range tests, remove after next release
     */
    if (process.env.LC_DEPENDENCY_RANGE_TESTS) {
      return;
    }

    const interceptor: WrapToolCallHook = async (request, handler) => {
      if (request.toolCall.name === "unregistered_tool") {
        return new ToolMessage({
          content: "Dict format works",
          tool_call_id: request.toolCall.id!,
          name: "unregistered_tool",
        });
      }
      return handler(request);
    };

    const toolNode = new ToolNode([registeredTool], {
      wrapToolCall: interceptor,
    });

    // Test with dict format instead of array format
    const result = await toolNode.invoke({
      messages: [
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "unregistered_tool",
              args: {},
              id: "1",
              type: "tool_call",
            },
          ],
        }),
      ],
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe("Dict format works");
    expect((result.messages[0] as ToolMessage).tool_call_id).toBe("1");
  });

  it("should handle interceptor exceptions for unregistered tools", async () => {
    /**
     * skip as test requires primitives from `@langchain/core` that aren't released yet
     * and fails in dependency range tests, remove after next release
     */
    if (process.env.LC_DEPENDENCY_RANGE_TESTS) {
      return;
    }

    const failingInterceptor: WrapToolCallHook = async (request, handler) => {
      // Throw exception for unregistered tools
      if (request.toolCall.name === "bad_tool") {
        throw new Error("Interceptor failed");
      }
      return handler(request);
    };

    const toolNode = new ToolNode([registeredTool], {
      wrapToolCall: failingInterceptor,
      handleToolErrors: true, // Catch and convert to ToolMessage
    });

    // Interceptor exception should be caught and converted to error message
    const result = await toolNode.invoke([
      new AIMessage({
        content: "",
        tool_calls: [
          {
            name: "bad_tool",
            args: {},
            id: "1",
            type: "tool_call",
          },
        ],
      }),
    ]);

    expect(result).toHaveLength(1);
    const toolMsg = result[0] as ToolMessage;
    expect(toolMsg.content).toContain("Interceptor failed");
    expect(toolMsg.tool_call_id).toBe("1");

    // Test that exception is raised when handleToolErrors is false
    const toolNodeNoHandling = new ToolNode([registeredTool], {
      wrapToolCall: failingInterceptor,
      handleToolErrors: false,
    });

    await expect(
      toolNodeNoHandling.invoke([
        new AIMessage({
          content: "",
          tool_calls: [
            {
              name: "bad_tool",
              args: {},
              id: "2",
              type: "tool_call",
            },
          ],
        }),
      ])
    ).rejects.toThrow("Interceptor failed");
  });
});
