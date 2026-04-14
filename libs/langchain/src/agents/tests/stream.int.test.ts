import { z } from "zod/v3";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createEmbedServer,
  type ThreadSaver,
} from "@langchain/langgraph-api/experimental/embed";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import type { Pregel } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph-checkpoint";
import { fakeModel } from "@langchain/core/testing";
import { tool } from "@langchain/core/tools";
import { AIMessage } from "@langchain/core/messages";
import { Client } from "@langchain/langgraph-sdk";

import { createMiddleware, createAgent } from "../index.js";

const threads: ThreadSaver = (() => {
  const THREADS: Record<
    string,
    { thread_id: string; metadata: Record<string, unknown> }
  > = {};

  return {
    get: async (id) => THREADS[id],
    set: async (threadId, { metadata }) => {
      THREADS[threadId] = {
        thread_id: threadId,
        metadata: { ...THREADS[threadId]?.metadata, ...metadata },
      };
      return THREADS[threadId];
    },
    delete: async (threadId) => {
      delete THREADS[threadId];
    },
  };
})();

const checkpointer = new MemorySaver();
const addTool = tool(
  (input: { a: number; b: number }) => `The sum is ${input.a + input.b}`,
  {
    name: "add",
    description: "Adds two numbers",
    schema: z.object({ a: z.number(), b: z.number() }),
  }
);

const minusTool = tool(
  (input: { a: number; b: number }) => `The difference is ${input.a - input.b}`,
  {
    name: "minus",
    description: "Subtracts two numbers",
    schema: z.object({ a: z.number(), b: z.number() }),
  }
);
const middlewareA = createMiddleware({
  name: "trackerA",
  stateSchema: z.object({
    trackerState: z.string().default("init"),
  }),
  beforeModel: () => ({ trackerState: "before", before: true }),
  afterModel: () => ({ trackerState: "after", after: true }),
});

const middlewareB = createMiddleware({
  name: "trackerB",
  stateSchema: z.object({
    trackerState: z.string().default("init"),
  }),
  wrapModelCall: async (request, handler) => {
    return await handler(request);
  },
});

const model = fakeModel()
  .respondWithTools([
    { name: "add", args: { a: 3, b: 4 }, id: "call_1" },
    { name: "minus", args: { a: 3, b: 4 }, id: "call_2" },
  ])
  .respond(new AIMessage("The answer is 7 and the difference is 1."));

const agent = createAgent({
  model,
  tools: [addTool, minusTool],
  middleware: [middlewareA, middlewareB],
  // oxlint-disable-next-line typescript/no-explicit-any
}) as unknown as Pregel<any, any, any, any, any>;

let httpServer: { close: () => void } | null = null;
let url: string | null = null;

async function setup() {
  const embedApp = createEmbedServer({
    graph: { agent },
    checkpointer,
    threads,
  });
  const app = new Hono();
  app.use("*", cors({ origin: "*", exposeHeaders: ["Content-Location"] }));
  app.route("/", embedApp);

  await new Promise<void>((resolve) => {
    httpServer = serve({ fetch: app.fetch, port: 0 }, (info) => {
      url = `http://localhost:${info.port}`;
      console.log(`Mock server started at ${url}`);
      resolve();
    });
  });
}

const ALL_CHANNELS = [
  "lifecycle",
  "messages",
  "tools",
  "values",
  "updates",
  "custom",
  "tasks",
] as const;

async function collectAllEvents(
  // oxlint-disable-next-line typescript/no-explicit-any
  iterable: AsyncIterable<any>
): Promise<Map<string, unknown[]>> {
  const byChannel = new Map<string, unknown[]>();
  for await (const event of iterable) {
    const channel: string = event.method ?? "unknown";
    let list = byChannel.get(channel);
    if (!list) {
      list = [];
      byChannel.set(channel, list);
    }
    list.push(event);

    if (channel === "lifecycle" && event.params?.namespace?.length === 0) {
      const status = event.params?.data?.event;
      if (
        status === "completed" ||
        status === "failed" ||
        status === "interrupted"
      ) {
        break;
      }
    }
  }
  return byChannel;
}

beforeAll(setup);

describe("stream_v2", () => {
  it("should emit stream evebts for each tool and middleware invocation", async () => {
    console.log("url", url);
    const client = new Client({ apiUrl: url! });

    const thread = await client.threads.create();
    const run = await client.threads.stream(thread.thread_id, {
      assistantId: "agent",
    });
    const subscription = await run.subscribe({ channels: [...ALL_CHANNELS] });

    await run.run.input({
      input: {
        messages: [{ role: "human", content: "What is 3+4 and 3-4?" }],
      },
      config: {
        configurable: { thread_id: thread.thread_id },
      },
    });

    const eventsByChannel = await collectAllEvents(subscription);
    await run.close();

    // --- helpers to extract event data from protocol envelopes ---
    // oxlint-disable-next-line typescript/no-explicit-any
    const dataOf = (evt: any) => evt.params?.data;
    // oxlint-disable-next-line typescript/no-explicit-any
    const nodeOf = (evt: any) => evt.params?.node;

    // --- lifecycle: running → 2 tool spawns → completed ---
    const lifecycle = eventsByChannel.get("lifecycle") ?? [];
    expect(lifecycle.length).toBe(4);
    expect(dataOf(lifecycle[0])).toMatchObject({
      event: "running",
      graph_name: "agent",
    });
    expect(dataOf(lifecycle[1])).toMatchObject({
      event: "spawned",
      graph_name: "tools",
    });
    expect(dataOf(lifecycle[2])).toMatchObject({
      event: "spawned",
      graph_name: "tools",
    });
    expect(dataOf(lifecycle[3])).toMatchObject({
      event: "completed",
      graph_name: "agent",
    });

    // --- tools: started/finished for both add and minus ---
    const tools = eventsByChannel.get("tools") ?? [];
    expect(tools.length).toBe(4);
    expect(dataOf(tools[0])).toMatchObject({
      event: "tool-started",
      tool_call_id: "call_1",
      tool_name: "add",
    });
    expect(dataOf(tools[1])).toMatchObject({
      event: "tool-started",
      tool_call_id: "call_2",
      tool_name: "minus",
    });
    expect(dataOf(tools[2])).toMatchObject({
      event: "tool-finished",
      tool_call_id: "call_1",
      output: expect.objectContaining({
        content: "The sum is 7",
        name: "add",
      }),
    });
    expect(dataOf(tools[3])).toMatchObject({
      event: "tool-finished",
      tool_call_id: "call_2",
      output: expect.objectContaining({
        content: "The difference is -1",
        name: "minus",
      }),
    });

    // --- updates: verify node execution order and key state transitions ---
    const updates = eventsByChannel.get("updates") ?? [];
    expect(updates.length).toBe(8);
    const updateNodes = updates.map(nodeOf);
    expect(updateNodes).toEqual([
      "trackerA.before_model",
      "model_request",
      "trackerA.after_model",
      "tools",
      "tools",
      "trackerA.before_model",
      "model_request",
      "trackerA.after_model",
    ]);

    // first model_request produced tool calls
    const firstModelUpdate = dataOf(updates[1]);
    expect(firstModelUpdate.messages).toHaveLength(1);
    expect(firstModelUpdate.messages[0].type).toBe("ai");
    expect(firstModelUpdate.messages[0].tool_calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "add", id: "call_1" }),
        expect.objectContaining({ name: "minus", id: "call_2" }),
      ])
    );

    // tool updates carry the correct results
    expect(dataOf(updates[3]).messages[0]).toMatchObject({
      type: "tool",
      content: "The sum is 7",
      name: "add",
      tool_call_id: "call_1",
    });
    expect(dataOf(updates[4]).messages[0]).toMatchObject({
      type: "tool",
      content: "The difference is -1",
      name: "minus",
      tool_call_id: "call_2",
    });

    // middleware state transitions are reflected
    expect(dataOf(updates[0]).trackerState).toBe("before");
    expect(dataOf(updates[2]).trackerState).toBe("after");

    // --- values: 8 state snapshots ---
    const values = eventsByChannel.get("values") ?? [];
    expect(values.length).toBe(8);

    // --- checkpoints: 9 checkpoint events ---
    const checkpoints = eventsByChannel.get("checkpoints") ?? [];
    expect(checkpoints.length).toBe(9);

    // --- tasks: 16 task events ---
    const tasks = eventsByChannel.get("tasks") ?? [];
    expect(tasks.length).toBe(16);

    // --- debug: 25 debug events ---
    const debug = eventsByChannel.get("debug") ?? [];
    expect(debug.length).toBe(25);
  });
});

afterAll(() => {
  if (httpServer) {
    httpServer.close();
  }
});
