import { z } from "zod/v3";
import { describe, it, expect } from "vitest";
import { tool, ToolRuntime } from "@langchain/core/tools";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import { InMemoryStore } from "@langchain/langgraph";

import { createAgent, createMiddleware } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

describe("tools", () => {
  it("can access state and context", async () => {
    const stateSchema = z.object({ bar: z.string().default("baz") });
    const contextSchema = z.object({ foo: z.string().default("bar") });
    const store = new InMemoryStore();

    const model = new FakeToolCallingModel({
      toolCalls: [
        [
          {
            type: "tool_call",
            name: "test",
            args: { city: "Tokyo" },
            id: "1",
          },
        ],
      ],
    });

    const getWeather = tool(
      async (
        input,
        runtime: ToolRuntime<typeof stateSchema, typeof contextSchema>
      ) => {
        expect(runtime.state).toEqual(expect.objectContaining({ bar: "baz" }));
        expect(runtime.context).toEqual({ foo: "bar" });
        expect(runtime.toolCallId).toEqual("1");
        expect(runtime.config.recursionLimit).toEqual(25);
        expect(typeof runtime.writer).toBe("function");
        expect(runtime.store?.constructor.name).toEqual("AsyncBatchedStore");
        return `The weather in ${input.city} is sunny. The foo is ${runtime.context.foo} and the bar is ${runtime.state.bar}.`;
      },
      {
        name: "test",
        description: "test",
        schema: z.object({ city: z.string() }),
      }
    );

    const agent = createAgent({
      model,
      tools: [getWeather],
      store,
      contextSchema: z.object({ foo: z.string().default("bar") }),
      stateSchema: z.object({ bar: z.string().default("baz") }),
    });

    const result = await agent.invoke(
      {
        messages: [new HumanMessage("What is the weather in Tokyo?")],
        bar: "baz",
      },
      {
        context: { foo: "bar" },
      }
    );

    expect(ToolMessage.isInstance(result.messages.at(-1))).toBe(true);
    expect(result.messages.at(-1)?.content).toBe(
      "The weather in Tokyo is sunny. The foo is bar and the bar is baz."
    );
  });

  describe("version: 'v1' — parallel tool execution via Promise.all", () => {
    it("runs all tool calls from a single AIMessage in the same ToolNode invocation", async () => {
      const invocationOrder: string[] = [];

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            { type: "tool_call", name: "tool_a", args: {}, id: "call_a" },
            { type: "tool_call", name: "tool_b", args: {}, id: "call_b" },
          ],
          // second LLM turn returns a plain text response to end the agent loop
          [],
        ],
      });

      const toolA = tool(async () => {
        invocationOrder.push("tool_a");
        return "result_a";
      }, { name: "tool_a", description: "tool a", schema: z.object({}) });

      const toolB = tool(async () => {
        invocationOrder.push("tool_b");
        return "result_b";
      }, { name: "tool_b", description: "tool b", schema: z.object({}) });

      const agent = createAgent({
        model,
        tools: [toolA, toolB],
        version: "v1",
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("run both tools")],
      });

      // Both tools must have been called
      expect(invocationOrder).toContain("tool_a");
      expect(invocationOrder).toContain("tool_b");

      // Both ToolMessages must appear in the conversation
      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(2);
      expect(toolMessages.map((m) => m.tool_call_id).sort()).toEqual(
        ["call_a", "call_b"].sort()
      );
    });

    it("runs pending tool calls via ToolNode (not Send) when afterModel middleware is present", async () => {
      const invocationOrder: string[] = [];

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            { type: "tool_call", name: "tool_a", args: {}, id: "call_a" },
            { type: "tool_call", name: "tool_b", args: {}, id: "call_b" },
          ],
          [],
        ],
      });

      const toolA = tool(async () => {
        invocationOrder.push("tool_a");
        return "result_a";
      }, { name: "tool_a", description: "tool a", schema: z.object({}) });

      const toolB = tool(async () => {
        invocationOrder.push("tool_b");
        return "result_b";
      }, { name: "tool_b", description: "tool b", schema: z.object({}) });

      // afterModel middleware forces the #createAfterModelRouter code path
      const afterModelMiddleware = createMiddleware({
        afterModel: async ({ messages }) => ({ messages }),
      });

      const agent = createAgent({
        model,
        tools: [toolA, toolB],
        middleware: [afterModelMiddleware],
        version: "v1",
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("run both tools")],
      });

      expect(invocationOrder).toContain("tool_a");
      expect(invocationOrder).toContain("tool_b");

      const toolMessages = result.messages.filter(ToolMessage.isInstance);
      expect(toolMessages).toHaveLength(2);
      expect(toolMessages.map((m) => m.tool_call_id).sort()).toEqual(
        ["call_a", "call_b"].sort()
      );
    });
  });
});
