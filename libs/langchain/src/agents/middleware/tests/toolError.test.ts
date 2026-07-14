/**
 * Tests for tool error middleware.
 */
import { describe, expect, it, vi } from "vitest";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { GraphInterrupt, MemorySaver } from "@langchain/langgraph";
import { z } from "zod/v3";

import { createAgent } from "../../index.js";
import { FakeToolCallingModel } from "../../tests/utils.js";
import type { ToolCallRequest } from "../types.js";
import { toolErrorMiddleware } from "../toolError.js";

class SecretToolError extends Error {
  constructor(value: string) {
    super(`secret detail: ${value}`);
    this.name = "SecretToolError";
  }
}

const failingTool = tool(
  async ({ value }) => {
    throw new SecretToolError(value);
  },
  {
    name: "failing_tool",
    description: "Tool that always fails",
    schema: z.object({ value: z.string() }),
  }
);

function createModel(toolName = "failing_tool") {
  return new FakeToolCallingModel({
    toolCalls: [[{ name: toolName, args: { value: "x" }, id: "call_1" }], []],
  });
}

describe("toolErrorMiddleware", () => {
  it("returns handler content as an error ToolMessage", async () => {
    const onError = vi.fn((error: unknown, _request: ToolCallRequest) => {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      return `Tool failed with ${errorName}.`;
    });
    const agent = createAgent({
      model: createModel(),
      tools: [failingTool],
      middleware: [toolErrorMiddleware({ onError })],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Use the failing tool")],
    });

    const toolMessages = result.messages.filter(ToolMessage.isInstance);
    expect(toolMessages).toHaveLength(1);
    expect(toolMessages[0]).toMatchObject({
      content: "Tool failed with SecretToolError.",
      name: "failing_tool",
      status: "error",
      tool_call_id: "call_1",
    });
    expect(toolMessages[0].content).not.toContain("secret detail");
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][1].toolCall.name).toBe("failing_tool");
  });

  it("propagates the original error when the handler returns nothing", async () => {
    const agent = createAgent({
      model: createModel(),
      tools: [failingTool],
      middleware: [
        toolErrorMiddleware({
          onError: (error) => {
            if (error instanceof TypeError) {
              return "handled";
            }
            return undefined;
          },
        }),
      ],
    });

    await expect(
      agent.invoke({ messages: [new HumanMessage("Use the failing tool")] })
    ).rejects.toThrow("secret detail: x");
  });

  it("supports async handlers and content blocks", async () => {
    const agent = createAgent({
      model: createModel(),
      tools: [failingTool],
      middleware: [
        toolErrorMiddleware({
          onError: async () => [
            { type: "text", text: "The tool failed safely." },
          ],
        }),
      ],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Use the failing tool")],
    });

    const toolMessages = result.messages.filter(ToolMessage.isInstance);
    expect(toolMessages[0].content).toEqual([
      { type: "text", text: "The tool failed safely." },
    ]);
    expect(toolMessages[0].status).toBe("error");
  });

  it("accepts tool instances in the filter", async () => {
    const agent = createAgent({
      model: createModel(),
      tools: [failingTool],
      middleware: [
        toolErrorMiddleware({
          tools: [failingTool],
          onError: () => "handled",
        }),
      ],
    });

    const result = await agent.invoke({
      messages: [new HumanMessage("Use the failing tool")],
    });

    const toolMessages = result.messages.filter(ToolMessage.isInstance);
    expect(toolMessages[0].content).toBe("handled");
  });

  it("bypasses tools that are not in the filter", async () => {
    const onError = vi.fn(() => "handled");
    const agent = createAgent({
      model: createModel(),
      tools: [failingTool],
      middleware: [toolErrorMiddleware({ tools: ["other_tool"], onError })],
    });

    await expect(
      agent.invoke({ messages: [new HumanMessage("Use the failing tool")] })
    ).rejects.toThrow("secret detail: x");
    expect(onError).not.toHaveBeenCalled();
  });

  it("does not pass LangGraph control-flow errors to the handler", async () => {
    const interruptValue = { action: "approve" };
    const interruptTool = tool(
      async () => {
        throw new GraphInterrupt([{ value: interruptValue }]);
      },
      {
        name: "interrupt_tool",
        description: "Tool that interrupts",
        schema: z.object({}),
      }
    );
    const onError = vi.fn(() => "handled");
    const agent = createAgent({
      model: new FakeToolCallingModel({
        toolCalls: [[{ name: "interrupt_tool", args: {}, id: "call_1" }]],
      }),
      tools: [interruptTool],
      middleware: [toolErrorMiddleware({ onError })],
      checkpointer: new MemorySaver(),
    });

    const result = await agent.invoke(
      { messages: [new HumanMessage("Use the interrupt tool")] },
      { configurable: { thread_id: "tool-error-interrupt" } }
    );

    expect(result.__interrupt__?.[0].value).toEqual(interruptValue);
    expect(onError).not.toHaveBeenCalled();
  });
});
