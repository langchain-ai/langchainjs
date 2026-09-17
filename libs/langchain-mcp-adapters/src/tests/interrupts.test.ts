import { PendingMCPInput, withMCPInterrupts } from "../continuation.js";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  createMcpHandler,
  inputRequired,
  McpServer,
} from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  StateGraph,
  Annotation,
  MemorySaver,
  START,
  END,
  Command,
  type Interrupt,
} from "@langchain/langgraph";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MCPAdapter } from "../index.js";

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()?.();
});

type HarnessOptions = {
  /** Complete the first call instead of asking a question. */
  completeImmediately?: boolean;
  /** Abort the caller's signal from inside the tool handler. */
  abortOnCall?: boolean;
  /** Answer with `input_required` carrying no input requests. */
  stateOnly?: boolean;
  /** Ask a URL question rather than a form question. */
  urlQuestion?: boolean;
  /** Return dynamic headers from `beforeToolCall`. */
  dynamicHeaders?: boolean;
  /** Compile the graph without a checkpointer. */
  withoutCheckpointer?: boolean;
};

function questionsIn(snapshot: {
  tasks: readonly { interrupts?: readonly Interrupt<unknown>[] }[];
}) {
  return snapshot.tasks.flatMap((entry) => [...(entry.interrupts ?? [])]);
}

/** Resume params for one answered question set. */
function answering(responses: Record<string, unknown>) {
  return { resume: { responses } };
}

const formAnswer = { action: "accept", content: { confirm: true } };

/**
 * A modern HTTP MCP server whose `approve` tool elicits input, wired to an
 * adapter and a one-node graph.
 *
 * The adapter is reached through a mutable reference so a test can close it and
 * build a fresh one, standing in for an application restarted between a
 * question and its answer.
 */
async function harness(options: HarnessOptions = {}) {
  const calls: string[] = [];
  const controller = new AbortController();

  const handler = createMcpHandler(
    () => {
      const server = new McpServer(
        { name: "durable", version: "1" },
        {
          requestState: {
            verify: async (state) => {
              expect(state).toBe("opaque:+/%==");

              return { pending: true };
            },
          },
        }
      );

      server.registerTool(
        "approve",
        {
          inputSchema: z.object({
            label: z.string().meta({ "x-mcp-header": "Label" }),
          }),
          outputSchema: z.object({ approved: z.boolean() }),
        },
        async ({ label }, context) => {
          expect(server.server.getClientCapabilities()).toMatchObject({
            elicitation: { form: {}, url: {} },
          });
          calls.push(label);

          const approved = {
            content: [{ type: "text" as const, text: "approved" }],
            structuredContent: { approved: true },
          };

          if (options.completeImmediately) return approved;
          if (options.abortOnCall) controller.abort();

          if (options.stateOnly) {
            return calls.length === 1
              ? inputRequired({
                  requestState: "opaque:+/%==",
                  inputRequests: {},
                })
              : approved;
          }

          if (!context.mcpReq.inputResponses?.confirmation) {
            return inputRequired({
              requestState: "opaque:+/%==",
              inputRequests: {
                confirmation: options.urlQuestion
                  ? inputRequired.elicitUrl({
                      message: label,
                      url: "https://example.com/authorize",
                    })
                  : inputRequired.elicit({
                      message: label,
                      requestedSchema: {
                        type: "object",
                        properties: { confirm: { type: "boolean" } },
                        required: ["confirm"],
                      },
                    }),
              },
            });
          }

          return approved;
        }
      );

      return server;
    },
    { legacy: "reject" }
  );

  const http = createServer(toNodeHandler(handler));
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const address = http.address();

  if (!address || typeof address === "string")
    throw new Error("Missing address");

  const before = vi.fn(() => ({
    args: { label: "effective" },
    headers: options.dynamicHeaders ? { "X-Test": "fixture" } : undefined,
  }));

  const after = vi.fn();

  const createAdapter = () =>
    new MCPAdapter({
      servers: {
        modern: {
          transport: "http",
          url: `http://127.0.0.1:${address.port}`,
          maxElicitationRounds: 2,
        },
      },
      beforeToolCall: before,
      afterToolCall: after,
    });

  const live = { adapter: createAdapter() };
  const checkpointer = new MemorySaver();
  const State = Annotation.Root({ done: Annotation<boolean>() });

  const createGraph = () =>
    new StateGraph(State)
      .addNode("call", async () => {
        const [tool] = await live.adapter.listTools();
        await tool.invoke({ label: "original" });

        return { done: true };
      })
      .addEdge(START, "call")
      .addEdge("call", END)
      .compile({
        checkpointer: options.withoutCheckpointer ? undefined : checkpointer,
      });

  cleanups.push(async () => {
    await live.adapter.close();
    await handler.close();
    http.close();
    http.closeAllConnections();
    await once(http, "close");
  });

  return {
    calls,
    controller,
    before,
    after,
    live,
    createGraph,
    /** Close the adapter and build a new one, as a restart would. */
    reconstructAdapter: async () => {
      await live.adapter.close();
      live.adapter = createAdapter();
    },
    config: { configurable: { thread_id: "durable-round" } },
  };
}

describe("answering a modern question", () => {
  it.each([
    { name: "a form answer", answer: { ...formAnswer } },
    {
      name: "an answer carrying the SDK request method",
      answer: { ...formAnswer, method: "elicitation/create" },
    },
    {
      name: "an answer carrying an SDK result envelope",
      answer: { ...formAnswer, result: {} },
    },
  ])("completes the tool call with $name", async ({ answer }) => {
    const h = await harness();
    const graph = h.createGraph();

    await graph.invoke({ done: false }, h.config);
    const questions = questionsIn(await graph.getState(h.config));
    expect(questions).toHaveLength(1);
    // The question carries the effective arguments, never the server's state.
    expect(JSON.stringify(questions)).toContain("effective");
    expect(JSON.stringify(questions)).not.toContain("opaque");
    expect(h.calls).toEqual(["effective"]);
    expect(h.before).toHaveBeenCalledTimes(1);
    expect(h.after).not.toHaveBeenCalled();

    await h.reconstructAdapter();

    const resumed = await h
      .createGraph()
      .invoke(new Command(answering({ confirmation: answer })), h.config);

    expect(resumed.done).toBe(true);
    // Resuming replays the initial request before sending the answer.
    expect(h.calls).toHaveLength(3);
    expect(h.after).toHaveBeenCalledTimes(1);
    // beforeToolCall runs once per execution, and a replayed execution runs it
    // again. The adapter makes no once-only guarantee for hooks.
    expect(h.before).toHaveBeenCalledTimes(2);
  });

  it("completes a URL question and never exposes a legacy elicitationId", async () => {
    const h = await harness({ urlQuestion: true });
    const graph = h.createGraph();

    await graph.invoke({ done: false }, h.config);
    const questions = questionsIn(await graph.getState(h.config));
    expect(questions[0].value).toMatchObject({
      requests: {
        confirmation: { mode: "url", url: "https://example.com/authorize" },
      },
    });
    expect(JSON.stringify(questions)).not.toContain("elicitationId");

    await h.reconstructAdapter();
    const resumed = await h
      .createGraph()
      .invoke(
        new Command(answering({ confirmation: { action: "accept" } })),
        h.config
      );

    expect(resumed.done).toBe(true);
    expect(h.calls).toHaveLength(3);
    expect(h.after).toHaveBeenCalledTimes(1);
  });
});

describe("rejecting a malformed answer", () => {
  it.each([
    {
      name: "content that violates the requested schema",
      bad: { confirmation: { action: "accept", content: { confirm: "yes" } } },
    },
    {
      name: "an answer under an unrequested key",
      bad: { wrong: { ...formAnswer } },
    },
    {
      name: "an extra key alongside the requested one",
      bad: { confirmation: { ...formAnswer }, extra: { ...formAnswer } },
    },
  ])("re-interrupts for $name, then accepts a correction", async ({ bad }) => {
    const h = await harness();

    await h.createGraph().invoke({ done: false }, h.config);
    await h.reconstructAdapter();
    await h.createGraph().invoke(new Command(answering(bad)), h.config);

    const retry = questionsIn(await h.createGraph().getState(h.config));
    expect(retry).toHaveLength(1);
    expect(retry[0].value).toMatchObject({
      validationError: expect.any(String),
    });
    // The malformed answer never reached the server, but the initial request
    // was replayed before it was rejected.
    expect(h.calls).toEqual(["effective", "effective"]);
    expect(h.after).not.toHaveBeenCalled();

    const corrected = await h
      .createGraph()
      .invoke(
        new Command(answering({ confirmation: { ...formAnswer } })),
        h.config
      );

    expect(corrected.done).toBe(true);
    expect(h.calls).toEqual([
      "effective",
      "effective",
      "effective",
      "effective",
    ]);
    expect(h.after).toHaveBeenCalledTimes(1);
    expect(h.before).toHaveBeenCalledTimes(3);
  });

  it("re-interrupts when a URL answer carries form content", async () => {
    const h = await harness({ urlQuestion: true });

    await h.createGraph().invoke({ done: false }, h.config);
    await h.reconstructAdapter();
    await h
      .createGraph()
      .invoke(
        new Command(answering({ confirmation: { ...formAnswer } })),
        h.config
      );

    const retry = questionsIn(await h.createGraph().getState(h.config));
    expect(retry[0].value).toMatchObject({
      validationError: expect.any(String),
    });

    const corrected = await h
      .createGraph()
      .invoke(
        new Command(answering({ confirmation: { action: "accept" } })),
        h.config
      );

    expect(corrected.done).toBe(true);
    expect(h.after).toHaveBeenCalledTimes(1);
  });

  it("stops re-asking once the answer budget is spent", async () => {
    const h = await harness({ urlQuestion: true });

    await h.createGraph().invoke({ done: false }, h.config);
    await h.reconstructAdapter();

    // A form answer never satisfies a URL question, so every resume is
    // rejected and the re-ask has to run out rather than continue forever.
    await h
      .createGraph()
      .invoke(
        new Command(answering({ confirmation: { ...formAnswer } })),
        h.config
      );
    await h
      .createGraph()
      .invoke(
        new Command(answering({ confirmation: { ...formAnswer } })),
        h.config
      );

    await expect(
      h
        .createGraph()
        .invoke(
          new Command(answering({ confirmation: { ...formAnswer } })),
          h.config
        )
    ).rejects.toThrow(/answer limit exceeded/);
  });
});

describe("rejecting what cannot be answered", () => {
  it("rejects a state-only response inside a graph without polling", async () => {
    const h = await harness({ stateOnly: true });

    await expect(
      h.createGraph().invoke({ done: false }, h.config)
    ).rejects.toThrow(/state-only continuation/);
    expect(h.calls).toHaveLength(1);
    expect(h.before).toHaveBeenCalledTimes(1);
    expect(h.after).not.toHaveBeenCalled();
  });

  it("requires a checkpointer to pause", async () => {
    const h = await harness({ withoutCheckpointer: true });

    await expect(
      h.createGraph().invoke({ done: false }, h.config)
    ).rejects.toThrow(/No checkpointer set/);
    expect(h.calls).toHaveLength(1);
  });
});

describe("invoking outside a graph", () => {
  it("rejects a question with no way to answer it", async () => {
    const h = await harness();
    const [tool] = await h.live.adapter.listTools();

    await expect(tool.invoke({ label: "original" })).rejects.toThrow(
      /inside a LangGraph with a checkpointer/
    );
    expect(h.calls).toHaveLength(1);
  });

  it("rejects a state-only response instead of polling", async () => {
    const h = await harness({ stateOnly: true });
    const [tool] = await h.live.adapter.listTools();

    await expect(
      tool.invoke({ label: "original" }, { signal: h.controller.signal })
    ).rejects.toThrow(/state-only continuation, which is not supported/);
    expect(h.calls).toEqual(["effective"]);
    expect(h.after).not.toHaveBeenCalled();
  });

  it("reports an abort rather than the response it received", async () => {
    const h = await harness({ stateOnly: true, abortOnCall: true });
    const [tool] = await h.live.adapter.listTools();

    await expect(
      tool.invoke({ label: "original" }, { signal: h.controller.signal })
    ).rejects.toThrow(/abort/i);
    expect(h.calls).toHaveLength(1);
    expect(h.after).not.toHaveBeenCalled();
  });

  it.each([
    { name: "a completed call", options: { completeImmediately: true } },
    {
      name: "a completed call with dynamic headers",
      options: { completeImmediately: true, dynamicHeaders: true },
    },
  ])("resolves $name", async ({ options }) => {
    const h = await harness(options);
    const [tool] = await h.live.adapter.listTools();

    await expect(tool.invoke({ label: "original" })).resolves.toBeDefined();
    expect(h.calls).toHaveLength(1);
  });
});

describe("dynamic headers", () => {
  it("applies beforeToolCall headers to a graph call", async () => {
    // Headers are applied through the client's own fork for this execution
    // only. beforeToolCall runs again on replay, so nothing is carried over.
    const h = await harness({ dynamicHeaders: true });
    const graph = h.createGraph();

    await graph.invoke({ done: false }, h.config);

    expect(questionsIn(await graph.getState(h.config))).toHaveLength(1);
    expect(h.calls).toEqual(["effective"]);
    expect(h.before).toHaveBeenCalledTimes(1);
  });
});

describe("thread isolation", () => {
  it("answers each thread's question independently", async () => {
    const h = await harness();
    const peerConfig = { configurable: { thread_id: "independent-round" } };

    await h.createGraph().invoke({ done: false }, h.config);
    await h.createGraph().invoke({ done: false }, peerConfig);
    expect(h.calls).toEqual(["effective", "effective"]);

    await h.reconstructAdapter();

    const resumed = await h
      .createGraph()
      .invoke(
        new Command(answering({ confirmation: { ...formAnswer } })),
        h.config
      );
    expect(resumed.done).toBe(true);
    expect(h.calls).toHaveLength(4);
    expect(h.after).toHaveBeenCalledTimes(1);

    const peerResult = await h
      .createGraph()
      .invoke(
        new Command(answering({ confirmation: { action: "cancel" } })),
        peerConfig
      );
    expect(peerResult.done).toBe(true);
    expect(h.calls).toHaveLength(6);
    expect(h.after).toHaveBeenCalledTimes(2);
    expect(h.before).toHaveBeenCalledTimes(4);
  });
});

describe("bounding a continuation the adapter drives itself", () => {
  it.each(["state-only", "abort", "transport"])(
    "rejects a graph continuation it cannot answer: %s",
    async (scenario) => {
      const controller = new AbortController();
      let calls = 0;
      const State = Annotation.Root({ result: Annotation<string>() });

      const graph = new StateGraph(State)
        .addNode("call", async () => ({
          result: await withMCPInterrupts(
            async (continuation) => {
              calls += 1;

              if (scenario === "transport")
                throw new Error("transport failure");

              // Nothing can answer a response with no questions, so the
              // adapter never produces a continuation for one.
              expect(continuation).toBeUndefined();

              if (scenario === "abort") controller.abort();
              throw new PendingMCPInput(
                {
                  kind: "input_required",
                  inputRequests: {},
                  requestState: "opaque-state",
                },
                { name: "tool", arguments: {} }
              );
            },
            {
              server: "test",
              tool: "tool",
              maxRounds: 2,
              signal: controller.signal,
            }
          ),
        }))
        .addEdge(START, "call")
        .addEdge("call", END)
        .compile({ checkpointer: new MemorySaver() });

      const invocation = graph.invoke(
        { result: "" },
        { configurable: { thread_id: scenario } }
      );

      // Without a task wrapper the failure is no longer repackaged as a task
      // error, so each of these surfaces its own message directly.
      await expect(invocation).rejects.toThrow(
        scenario === "transport"
          ? /transport failure/
          : scenario === "abort"
            ? /abort/i
            : /state-only continuation/
      );
      expect(calls).toBe(1);
    }
  );

  it("bounds answered elicitation rounds, replaying each earlier request", async () => {
    let calls = 0;
    const State = Annotation.Root({ result: Annotation<string>() });

    const graph = new StateGraph(State)
      .addNode("call", async () => ({
        result: await withMCPInterrupts<string>(
          async (continuation) => {
            calls += 1;

            if (continuation)
              expect(continuation.inputResponses).toEqual({
                confirmation: { action: "decline" },
              });
            throw new PendingMCPInput(
              {
                kind: "input_required",
                inputRequests: {
                  confirmation: inputRequired.elicit({
                    message: "Continue?",
                    requestedSchema: { type: "object", properties: {} },
                  }),
                },
              },
              { name: "repeat", arguments: {} }
            );
          },
          { server: "modern", tool: "repeat", maxRounds: 2 }
        ),
      }))
      .addEdge(START, "call")
      .addEdge("call", END)
      .compile({ checkpointer: new MemorySaver() });

    const config = { configurable: { thread_id: "answered-round-limit" } };
    await graph.invoke({ result: "" }, config);
    expect(calls).toBe(1);
    const resume = { responses: { confirmation: { action: "decline" } } };
    // Each resume replays the initial request and every round already answered,
    // then issues one new round: 1 -> 3 -> 6 requests. The round limit still
    // bounds the answered loop inside a single execution.
    await graph.invoke(new Command({ resume }), config);
    expect(calls).toBe(3);
    await expect(graph.invoke(new Command({ resume }), config)).rejects.toThrow(
      /round limit/
    );
    expect(calls).toBe(6);
  });
});
