import { describe, it, expect } from "vitest";
import { z } from "zod/v3";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { fakeModel } from "@langchain/core/testing";
import {
  StreamChannel,
  type ProtocolEvent,
  type StreamTransformer,
} from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

import { createAgent, createMiddleware } from "../index.js";
import { humanInTheLoopMiddleware } from "../middleware/hitl.js";
import { createToolCallTransformer } from "../stream.js";

describe("stream_v2", () => {
  it("should emit tool call streams for each tool invocation", async () => {
    const addTool = tool(
      (input: { a: number; b: number }) => `The sum is ${input.a + input.b}`,
      {
        name: "add",
        description: "Adds two numbers",
        schema: z.object({ a: z.number(), b: z.number() }),
      }
    );

    const minusTool = tool(
      (input: { a: number; b: number }) =>
        `The difference is ${input.a - input.b}`,
      {
        name: "minus",
        description: "Subtracts two numbers",
        schema: z.object({ a: z.number(), b: z.number() }),
      }
    );

    const model = fakeModel()
      .respondWithTools([
        { name: "add", args: { a: 3, b: 4 }, id: "call_1" },
        { name: "minus", args: { a: 3, b: 4 }, id: "call_2" },
      ])
      .respond(new AIMessage("The answer is 7."));

    const agent = createAgent({ model, tools: [addTool, minusTool] });
    const run = await agent.stream_v2({
      messages: [new HumanMessage("What is 3 + 4?")],
    });

    const toolCalls: Array<{
      name: string;
      callId: string;
      input: unknown;
      output: unknown;
      status: string;
    }> = [];

    for await (const call of run.toolCalls) {
      toolCalls.push({
        name: call.name,
        callId: call.callId,
        input: call.input,
        output: await call.output,
        status: await call.status,
      });
    }

    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0].name).toBe("add");
    expect(toolCalls[0].callId).toBe("call_1");
    expect(toolCalls[0].status).toBe("finished");
    expect(toolCalls[0].input).toEqual({ a: 3, b: 4 });
    expect(toolCalls[0].output).toHaveProperty("content", "The sum is 7");
  });

  it("should emit middleware events for before/after model hooks", async () => {
    const model = fakeModel().respond(new AIMessage("hello back"));

    const testMiddleware = createMiddleware({
      name: "tracker",
      stateSchema: z.object({
        trackerState: z.string().default("init"),
      }),
      beforeModel: () => ({
        trackerState: "before_model_ran",
      }),
      afterModel: () => ({
        trackerState: "after_model_ran",
      }),
    });

    const agent = createAgent({
      model,
      tools: [],
      middleware: [testMiddleware],
    });

    const run = await agent.stream_v2({
      messages: [new HumanMessage("hello")],
    });

    const middlewareEvents: Array<{
      phase: string;
      middlewareName: string;
    }> = [];

    for await (const event of run.middleware) {
      middlewareEvents.push({
        phase: event.phase,
        middlewareName: event.name,
      });
    }

    expect(middlewareEvents.length).toBeGreaterThanOrEqual(2);

    const phases = middlewareEvents.map((e) => e.phase);
    expect(phases).toContain("before_model");
    expect(phases).toContain("after_model");

    for (const event of middlewareEvents) {
      expect(event.middlewareName).toBe("tracker");
    }
  });

  it("should stream messages alongside tool calls", async () => {
    const searchTool = tool(
      (input: { query: string }) => `Results for: ${input.query}`,
      {
        name: "search",
        description: "Search the web",
        schema: z.object({ query: z.string() }),
      }
    );

    const model = fakeModel()
      .respondWithTools([
        { name: "search", args: { query: "weather" }, id: "call_s1" },
      ])
      .respond(new AIMessage("The weather is sunny."));

    const agent = createAgent({ model, tools: [searchTool] });
    const run = await agent.stream_v2({
      messages: [new HumanMessage("Search for weather")],
    });

    const [toolCallResults, finalState] = await Promise.all([
      (async () => {
        const calls: string[] = [];
        for await (const call of run.toolCalls) {
          calls.push(call.name);
          await call.output;
        }
        return calls;
      })(),
      run.output,
    ]);

    expect(toolCallResults).toContain("search");
    expect(finalState).toBeDefined();
    expect(finalState.messages.length).toBeGreaterThanOrEqual(3);
  });

  it("should support parallel consumption of projections", async () => {
    const multiplyTool = tool(
      (input: { a: number; b: number }) => `${input.a * input.b}`,
      {
        name: "multiply",
        description: "Multiplies two numbers",
        schema: z.object({ a: z.number(), b: z.number() }),
      }
    );

    const model = fakeModel()
      .respondWithTools([
        { name: "multiply", args: { a: 6, b: 7 }, id: "call_m1" },
      ])
      .respond(new AIMessage("42"));

    const middleware = createMiddleware({
      name: "logger",
      stateSchema: z.object({
        logState: z.string().default(""),
      }),
      beforeModel: () => ({
        logState: "before",
      }),
    });

    const agent = createAgent({
      model,
      tools: [multiplyTool],
      middleware: [middleware],
    });

    const run = await agent.stream_v2({
      messages: [new HumanMessage("What is 6 * 7?")],
    });

    const [toolNames, middlewarePhases, output] = await Promise.all([
      (async () => {
        const names: string[] = [];
        for await (const call of run.toolCalls) {
          names.push(call.name);
          await call.output;
        }
        return names;
      })(),
      (async () => {
        const phases: string[] = [];
        for await (const event of run.middleware) {
          phases.push(event.phase);
        }
        return phases;
      })(),
      run.output,
    ]);

    expect(toolNames).toMatchInlineSnapshot(`
      [
        "multiply",
      ]
    `);
    expect(middlewarePhases).toMatchInlineSnapshot(`
      [
        "before_model",
        "before_model",
      ]
    `);
    expect(output.messages).toHaveLength(3);
  });

  it("should resolve output with the final agent state", async () => {
    const model = fakeModel().respond(new AIMessage("hi there"));
    const agent = createAgent({ model, tools: [] });
    const run = await agent.stream_v2({
      messages: [new HumanMessage("hi")],
    });

    const state = await run.output;

    expect(state).toBeDefined();
    expect(state.messages).toBeDefined();
    expect(state.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("should pass user-defined streamTransformers registered at creation time", async () => {
    const model = fakeModel().respond(new AIMessage("ok"));

    const eventCounter = (): StreamTransformer<{
      eventCount: StreamChannel<number>;
    }> => {
      const eventCount = StreamChannel.remote<number>("eventCount");
      let count = 0;

      return {
        init: () => ({ eventCount }),
        process() {
          count += 1;
          eventCount.push(count);
          return true;
        },
      };
    };

    const agent = createAgent({
      model,
      tools: [],
      streamTransformers: [eventCounter],
    });

    const run = await agent.stream_v2({
      messages: [new HumanMessage("hi")],
    });

    const counts: number[] = [];
    for await (const c of run.extensions.eventCount as AsyncIterable<number>) {
      counts.push(c);
    }

    expect(counts.length).toBeGreaterThan(0);
    expect(counts[counts.length - 1]).toBe(counts.length);
  });

  it("should pass call-site transformers via stream_v2 config", async () => {
    const model = fakeModel().respond(new AIMessage("ok"));
    const agent = createAgent({ model, tools: [] });

    const methodTracker = (): StreamTransformer<{
      methods: StreamChannel<string>;
    }> => {
      const methods = StreamChannel.remote<string>("methods");
      return {
        init: () => ({ methods }),
        process(event) {
          methods.push(event.method);
          return true;
        },
      };
    };

    const run = await agent.stream_v2(
      { messages: [new HumanMessage("hi")] },
      { transformers: [methodTracker] }
    );

    const seenMethods: string[] = [];
    for await (const m of run.extensions.methods as AsyncIterable<string>) {
      seenMethods.push(m);
    }

    expect(seenMethods.length).toBeGreaterThan(0);
    expect(seenMethods).toContain("values");
  });

  it("should handle multiple tool calls in a single turn", async () => {
    const addTool = tool(
      (input: { a: number; b: number }) => `${input.a + input.b}`,
      {
        name: "add",
        description: "Adds two numbers",
        schema: z.object({ a: z.number(), b: z.number() }),
      }
    );

    const model = fakeModel()
      .respondWithTools([
        { name: "add", args: { a: 1, b: 2 }, id: "call_a" },
        { name: "add", args: { a: 3, b: 4 }, id: "call_b" },
      ])
      .respond(new AIMessage("Done: 3 and 7"));

    const agent = createAgent({ model, tools: [addTool] });
    const run = await agent.stream_v2({
      messages: [new HumanMessage("Add 1+2 and 3+4")],
    });

    const toolCalls: Array<{ name: string; callId: string; output: unknown }> =
      [];

    for await (const call of run.toolCalls) {
      toolCalls.push({
        name: call.name,
        callId: call.callId,
        output: await call.output,
      });
    }

    expect(toolCalls).toHaveLength(2);
    const ids = toolCalls.map((c) => c.callId).sort();
    expect(ids).toEqual(["call_a", "call_b"]);
  });

  it("should expose interrupted flag when HITL middleware triggers an interrupt", async () => {
    const writeFileTool = tool(
      (input: { filename: string; content: string }) =>
        `Wrote ${input.content.length} chars to ${input.filename}`,
      {
        name: "write_file",
        description: "Write content to a file",
        schema: z.object({
          filename: z.string(),
          content: z.string(),
        }),
      }
    );

    const hitl = humanInTheLoopMiddleware({
      interruptOn: {
        write_file: { allowedDecisions: ["approve"] },
      },
    });

    const model = fakeModel()
      .respondWithTools([
        {
          name: "write_file",
          args: { filename: "test.txt", content: "hello" },
          id: "call_w1",
        },
      ])
      .respond(new AIMessage("Done writing."));

    const checkpointer = new MemorySaver();
    const agent = createAgent({
      model,
      tools: [writeFileTool],
      middleware: [hitl],
      checkpointer,
    });

    const config = { configurable: { thread_id: "hitl-stream-test" } };

    const run = await agent.stream_v2(
      { messages: [new HumanMessage("Write hello to test.txt")] },
      config
    );

    const state = await run.output;
    expect(state).toBeDefined();
    expect(run.interrupted).toBe(true);
    expect(run.interrupts.length).toBeGreaterThanOrEqual(1);
    expect(run.interrupts).toEqual([
      expect.objectContaining({
        payload: {
          actionRequests: [
            {
              args: { content: "hello", filename: "test.txt" },
              description: expect.stringContaining("write_file"),
              name: "write_file",
            },
          ],
          reviewConfigs: [
            {
              actionName: "write_file",
              allowedDecisions: ["approve"],
            },
          ],
        },
      }),
    ]);
  });

  it("should keep tool call streams pending across headless tool interrupts", async () => {
    const transformer = createToolCallTransformer([])();
    const projection = transformer.init();
    const toolEvent = (data: Record<string, unknown>): ProtocolEvent =>
      ({
        method: "tools",
        params: {
          namespace: ["tools:abc"],
          data,
        },
      }) as ProtocolEvent;

    transformer.process(
      toolEvent({
        event: "tool-started",
        tool_call_id: "call_1",
        tool_name: "memory_list",
        input: '{"limit":100}',
      })
    );

    const iterator = projection.toolCalls[Symbol.asyncIterator]();
    const pendingCall = await iterator.next();

    transformer.process(
      toolEvent({
        event: "tool-error",
        tool_call_id: "call_1",
        message: JSON.stringify([
          {
            id: "interrupt_1",
            value: {
              type: "tool",
              toolCall: {
                id: "call_1",
                name: "memory_list",
                args: { limit: 100 },
              },
            },
          },
        ]),
      })
    );

    transformer.process(
      toolEvent({
        event: "tool-started",
        tool_call_id: "call_1",
        tool_name: "memory_list",
        input: '{"limit":100}',
      })
    );

    transformer.process(
      toolEvent({
        event: "tool-finished",
        tool_call_id: "call_1",
        output: { count: 1 },
      })
    );

    transformer.finalize?.();

    expect(pendingCall.done).toBe(false);
    expect(pendingCall.value.callId).toBe("call_1");
    expect(await pendingCall.value.status).toBe("finished");
    expect(await pendingCall.value.output).toEqual({ count: 1 });
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
  });
});
