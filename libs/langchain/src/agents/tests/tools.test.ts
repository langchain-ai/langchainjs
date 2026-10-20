import { z } from "zod/v3";
import { describe, it, expect } from "vitest";
import { tool, ToolRuntime } from "@langchain/core/tools";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import {
  Command,
  InMemoryStore,
  MemorySaver,
  interrupt,
} from "@langchain/langgraph";

import { createAgent, createMiddleware } from "../index.js";
import { FakeToolCallingModel } from "./utils.js";

describe("tools", () => {
  it.each([
    [false, false],
    [true, false],
    [true, true],
  ])(
    "checkpoints compact tool tasks and restores state (afterModel: %s, legacy: %s)",
    async (withAfterModel, legacy) => {
      const checkpointer = new MemorySaver();
      const calls = ["a", "b"].map((id) => ({
        type: "tool_call" as const,
        name: "inspect_state",
        args: {},
        id,
      }));
      const checkState = (state: Record<string, unknown>) => {
        expect(state).toMatchObject({
          _private: withAfterModel ? "after-model" : "updated",
        });
        expect(state.messages).toHaveLength(2);
        expect(state).not.toHaveProperty("lg_tool_call");
        expect(state).not.toHaveProperty("jumpTo");
      };
      const seen: string[] = [];
      const inspectState = tool(
        (_input, runtime: ToolRuntime) => {
          checkState(runtime.state);
          expect(runtime.state).toHaveProperty("payload", "x".repeat(1024));
          interrupt("approve");
          seen.push(runtime.toolCallId!);
          return "ok";
        },
        {
          name: "inspect_state",
          description: "Inspect tool state",
          schema: z.object({}),
        }
      );
      const middleware = createMiddleware({
        name: "inspect_state",
        stateSchema: z.object({ _private: z.string().optional() }),
        beforeModel: () => ({ _private: "updated" }),
        afterModel: withAfterModel
          ? ({ messages }) => ({ messages, _private: "after-model" })
          : undefined,
        wrapToolCall: (request, handler) => {
          checkState(request.state);
          return handler(request);
        },
      });
      const agent = createAgent({
        model: new FakeToolCallingModel({ toolCalls: [calls, []] }),
        tools: [inspectState],
        stateSchema: z.object({ payload: z.string() }),
        middleware: [middleware],
        checkpointer,
      });
      const config = { configurable: { thread_id: "compact-tools" } };
      await agent.graph.invoke(
        {
          messages: [new HumanMessage("run both tools")],
          payload: "x".repeat(1024),
        },
        { ...config, interruptBefore: ["tools"] }
      );
      const tuple = (await checkpointer.getTuple(config))!;
      const sends = tuple.checkpoint.channel_values.__pregel_tasks as {
        args: { lg_tool_call: unknown };
      }[];
      expect(sends.map((send) => send.args)).toEqual(
        calls.map((lg_tool_call) => ({ lg_tool_call }))
      );
      if (legacy) {
        const { messages, payload, _private } = tuple.checkpoint.channel_values;
        await checkpointer.put(
          config,
          {
            ...tuple.checkpoint,
            channel_values: {
              ...tuple.checkpoint.channel_values,
              __pregel_tasks: sends.map((send) => ({
                ...send,
                args: { messages, payload, _private, ...send.args },
              })),
            },
          },
          tuple.metadata!,
          {}
        );
      }
      const paused = await agent.invoke(null, config);
      expect(seen).toEqual([]);
      expect(paused.__interrupt__).toHaveLength(2);
      if (!legacy) {
        const saved = (await checkpointer.getTuple(config))!;
        expect(saved.checkpoint.channel_values.__pregel_tasks).toEqual(sends);
      }
      const result = await agent.invoke(
        new Command({
          resume: Object.fromEntries(
            paused.__interrupt__!.map(({ id }) => [id, true])
          ),
        }),
        config
      );
      expect(seen.sort()).toEqual(["a", "b"]);
      expect(result.messages.filter(ToolMessage.isInstance)).toHaveLength(2);
    }
  );

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

      const toolA = tool(
        async () => {
          invocationOrder.push("tool_a");
          return "result_a";
        },
        { name: "tool_a", description: "tool a", schema: z.object({}) }
      );

      const toolB = tool(
        async () => {
          invocationOrder.push("tool_b");
          return "result_b";
        },
        { name: "tool_b", description: "tool b", schema: z.object({}) }
      );

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

    it("dispatches each tool call as a separate Send task (version: 'v2') when afterModel middleware is present", async () => {
      // Track which tool_call_id each tool invocation received.
      // With v2 + afterModel the ToolNode is entered once per tool call via
      // Send, so each invocation sees only its own single call_id.
      const seenCallIds: Record<string, string[]> = { tool_a: [], tool_b: [] };

      const model = new FakeToolCallingModel({
        toolCalls: [
          [
            { type: "tool_call", name: "tool_a", args: {}, id: "call_a" },
            { type: "tool_call", name: "tool_b", args: {}, id: "call_b" },
          ],
          [],
        ],
      });

      const toolA = tool(
        async (_input, runtime: ToolRuntime) => {
          seenCallIds.tool_a.push(runtime.toolCallId!);
          return "result_a";
        },
        { name: "tool_a", description: "tool a", schema: z.object({}) }
      );

      const toolB = tool(
        async (_input, runtime: ToolRuntime) => {
          seenCallIds.tool_b.push(runtime.toolCallId!);
          return "result_b";
        },
        { name: "tool_b", description: "tool b", schema: z.object({}) }
      );

      const afterModelMiddleware = createMiddleware({
        name: "after-model",
        afterModel: async ({ messages }) => ({ messages }),
      });

      const agent = createAgent({
        model,
        tools: [toolA, toolB],
        middleware: [afterModelMiddleware],
        // v2 is the default; explicit here for clarity
        version: "v2",
      });

      const result = await agent.invoke({
        messages: [new HumanMessage("run both tools")],
      });

      // Both tools must have been called exactly once
      expect(seenCallIds.tool_a).toEqual(["call_a"]);
      expect(seenCallIds.tool_b).toEqual(["call_b"]);

      // Both ToolMessages appear in the conversation
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

      const toolA = tool(
        async () => {
          invocationOrder.push("tool_a");
          return "result_a";
        },
        { name: "tool_a", description: "tool a", schema: z.object({}) }
      );

      const toolB = tool(
        async () => {
          invocationOrder.push("tool_b");
          return "result_b";
        },
        { name: "tool_b", description: "tool b", schema: z.object({}) }
      );

      // afterModel middleware forces the #createAfterModelRouter code path
      const afterModelMiddleware = createMiddleware({
        name: "after-model",
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
