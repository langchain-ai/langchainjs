import { createServer } from "node:http";
import { once } from "node:events";
import { join } from "node:path";
import {
  createMcpHandler,
  inputRequired,
  McpServer,
} from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import {
  Client,
  StreamableHTTPClientTransport,
  specTypeSchemas,
  withInputRequired,
  isInputRequiredResult,
} from "@modelcontextprotocol/client";
import {
  StateGraph,
  Annotation,
  MemorySaver,
  START,
  END,
  Command,
  interrupt,
  type Interrupt,
} from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MCPAdapter } from "../index.js";
import {
  callToolWithElicitation,
  createMCPElicitationResume,
} from "../elicitation.js";
import type { MCPElicitationHandler } from "../elicitation.js";
import type { StdioConnectionInit } from "../types.js";

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
async function answering(
  graph: {
    getState(
      config: RunnableConfig
    ): Promise<Parameters<typeof questionsIn>[0]>;
  },
  config: RunnableConfig,
  responses: Record<string, unknown>
) {
  const [pending] = questionsIn(await graph.getState(config));
  const resume = createMCPElicitationResume(pending, {});
  return {
    resume: Object.fromEntries(
      Object.entries(resume).map(([id, value]) => [id, { ...value, responses }])
    ),
  };
}

const formAnswer = { action: "accept" as const, content: { confirm: true } };

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
          elicitation: true,
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
      .invoke(
        new Command(
          await answering(h.createGraph(), h.config, { confirmation: answer })
        ),
        h.config
      );

    expect(resumed.done).toBe(true);
    // Resuming replays the tool call from its first round, so the server is
    // asked again before it is answered. Effects must be idempotent.
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
    const resumed = await h.createGraph().invoke(
      new Command(
        await answering(h.createGraph(), h.config, {
          confirmation: { action: "accept" },
        })
      ),
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
      // The requested schema, not just the envelope, is what rejects it.
      reasons: [
        "data/confirm must be boolean",
        "responses.confirmation.content",
      ],
    },
    {
      name: "an answer under an unrequested key",
      bad: { wrong: { ...formAnswer } },
      reasons: ['Unrecognized key: "wrong"'],
    },
    {
      name: "an extra key alongside the requested one",
      bad: { confirmation: { ...formAnswer }, extra: { ...formAnswer } },
      reasons: ['Unrecognized key: "extra"'],
    },
  ])("fails the call for $name", async ({ bad, reasons }) => {
    const h = await harness();

    await h.createGraph().invoke({ done: false }, h.config);
    await h.reconstructAdapter();

    // Re-asking would not help: the caller resuming the graph is code, not the
    // human who filled the form, so the same question would come back wrong.
    const failure = await h
      .createGraph()
      .invoke(
        new Command(await answering(h.createGraph(), h.config, bad)),
        h.config
      )
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(
      'Resuming MCP tool "approve" on server "modern" needs answers built by createMCPElicitationResume()'
    );
    // Each case is refused for its own reason, naming the offending key.
    for (const reason of reasons)
      expect((failure as Error).message).toContain(reason);

    expect(h.after).not.toHaveBeenCalled();
  });
});

describe("rejecting what cannot be answered", () => {
  it("rejects a state-only response inside a graph without polling", async () => {
    const h = await harness({ stateOnly: true });

    await expect(
      h.createGraph().invoke({ done: false }, h.config)
    ).rejects.toThrow(/state-only response/);
    expect(h.calls).toHaveLength(1);
    expect(h.before).toHaveBeenCalledTimes(1);
    expect(h.after).not.toHaveBeenCalled();
  });

  it("requires a checkpointer to pause", async () => {
    const h = await harness({ withoutCheckpointer: true });

    await expect(
      h.createGraph().invoke({ done: false }, h.config)
    ).rejects.toThrow(/with a checkpointer/);
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
    ).rejects.toThrow(/a state-only response carries no question to ask/);
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

    // The completed call returns the server's content, under the effective
    // arguments the before hook supplied -- headers or not.
    await expect(tool.invoke({ label: "original" })).resolves.toBe("approved");
    expect(h.calls).toEqual(["effective"]);
    expect(h.after).toHaveBeenCalledTimes(1);
  });
});

describe("dynamic headers", () => {
  // Replaying a node re-runs `beforeToolCall`, so the call is re-issued under
  // whatever identity is current. No header combination is special-cased.
  it.each([
    { name: "changed tenant", initial: "A", next: "B", result: "B" },
    {
      name: "removed headers",
      initial: "A",
      next: undefined,
      result: "default",
    },
    { name: "added headers", initial: undefined, next: "B", result: "B" },
  ])(
    "handles $name after a later node interrupt",
    async ({ initial, next, result: expected }) => {
      const observed: string[] = [];
      let tenant = initial;
      const handler = createMcpHandler(
        (request) => {
          const server = new McpServer({ name: "tenant", version: "1" });
          server.registerTool(
            "account",
            { inputSchema: z.object({}) },
            async () => {
              const account =
                request.requestInfo?.headers.get("x-test-account") ?? "default";
              observed.push(account);
              return { content: [{ type: "text", text: account }] };
            }
          );
          return server;
        },
        { legacy: "reject" }
      );
      const http = createServer(toNodeHandler(handler));
      http.listen(0, "127.0.0.1");
      await once(http, "listening");
      const { port } = z.object({ port: z.number() }).parse(http.address());
      const adapter = new MCPAdapter({
        servers: { modern: { url: `http://127.0.0.1:${port}/mcp` } },
        beforeToolCall: () =>
          tenant ? { headers: { "X-Test-Account": tenant } } : undefined,
      });
      cleanups.push(async () => {
        await adapter.close();
        await handler.close();
        http.close();
        http.closeAllConnections();
        await once(http, "close");
      });
      const [tool] = await adapter.listTools();
      const State = Annotation.Root({ result: Annotation<string>() });
      const graph = new StateGraph(State)
        .addNode("call", async () => {
          const result = await tool.invoke({});
          interrupt("Continue after the account lookup?");
          return { result };
        })
        .addEdge(START, "call")
        .addEdge("call", END)
        .compile({ checkpointer: new MemorySaver() });
      const config = { configurable: { thread_id: "header-replay" } };

      await graph.invoke({ result: "" }, config);
      expect(questionsIn(await graph.getState(config))).toHaveLength(1);
      expect(observed).toEqual([initial ?? "default"]);
      tenant = next;

      const resumed = graph.invoke(new Command({ resume: true }), config);
      await expect(resumed).resolves.toMatchObject({ result: expected });
      expect(observed).toEqual([initial ?? "default", expected]);
    }
  );
});

describe("thread isolation", () => {
  it("answers each thread's question independently", async () => {
    const h = await harness();
    const peerConfig = { configurable: { thread_id: "independent-round" } };

    await h.createGraph().invoke({ done: false }, h.config);
    await h.createGraph().invoke({ done: false }, peerConfig);
    expect(h.calls).toEqual(["effective", "effective"]);

    await h.reconstructAdapter();

    const resumed = await h.createGraph().invoke(
      new Command(
        await answering(h.createGraph(), h.config, {
          confirmation: { ...formAnswer },
        })
      ),
      h.config
    );
    expect(resumed.done).toBe(true);
    // Resuming replays this thread's first round; the peer thread is untouched.
    expect(h.calls).toHaveLength(4);
    expect(h.after).toHaveBeenCalledTimes(1);

    const peerResult = await h.createGraph().invoke(
      new Command(
        await answering(h.createGraph(), peerConfig, {
          confirmation: { action: "cancel" },
        })
      ),
      peerConfig
    );
    expect(peerResult.done).toBe(true);
    expect(h.calls).toHaveLength(6);
    expect(h.after).toHaveBeenCalledTimes(2);
    expect(h.before).toHaveBeenCalledTimes(4);
  });
});

describe("the interception boundary", () => {
  it.each([true, false])(
    "preserves output validation across manual continuation: %s",
    async (validOutput) => {
      const handler = createMcpHandler(
        () => {
          const server = new McpServer({
            name: "continuation-probe",
            version: "1",
          });

          server.registerTool(
            "confirm",
            {
              inputSchema: z.object({}),
              outputSchema: z.object({ confirmed: z.boolean() }),
            },
            async () => ({ content: [] })
          );
          // Deliberately bypass server-side output validation to exercise the client boundary.
          server.server.setRequestHandler("tools/call", async (_, context) =>
            context.mcpReq.inputResponses?.confirm
              ? {
                  content: [{ type: "text", text: "confirmed" }],
                  structuredContent: {
                    confirmed: validOutput ? true : "invalid",
                  },
                }
              : inputRequired({
                  inputRequests: {
                    confirm: inputRequired.elicit({
                      message: "Confirm?",
                      requestedSchema: {
                        type: "object",
                        properties: { confirmed: { type: "boolean" } },
                        required: ["confirmed"],
                      },
                    }),
                  },
                })
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

      const client = new Client(
        { name: "probe", version: "1" },
        {
          versionNegotiation: { mode: "auto" },
          capabilities: { elicitation: { form: {} } },
        }
      );

      try {
        await client.connect(
          new StreamableHTTPClientTransport(
            new URL(`http://127.0.0.1:${address.port}`)
          )
        );
        expect(client.getProtocolEra()).toBe("modern");
        await client.listTools();
        await expect(
          client.callTool(
            { name: "confirm", arguments: {} },
            { allowInputRequired: true }
          )
        ).rejects.toThrow(
          /output schema but did not return structured content/
        );

        const round = await client.request(
          { method: "tools/call", params: { name: "confirm", arguments: {} } },
          withInputRequired(specTypeSchemas.CallToolResult),
          { allowInputRequired: true }
        );

        expect(isInputRequiredResult(round)).toBe(true);

        // What the adapter does instead of subclassing: withhold the output
        // schema from the rounds so the `input_required` above survives, then
        // validate the terminal result against the schema itself.
        const { outputSchema, ...withoutSchema } = (
          await client.listTools()
        ).tools.find((tool) => tool.name === "confirm")!;

        expect(outputSchema).toMatchObject({
          type: "object",
          properties: { confirmed: { type: "boolean" } },
        });
        expect(withoutSchema).not.toHaveProperty("outputSchema");

        const answered = await client.callTool(
          {
            name: "confirm",
            arguments: {},
            inputResponses: {
              confirm: { action: "accept", content: { confirmed: true } },
            },
            requestState: (round as { requestState?: string }).requestState,
          } as Parameters<Client["callTool"]>[0],
          { allowInputRequired: true, toolDefinition: withoutSchema }
        );

        // Withholding the schema means the SDK validates nothing, so a server
        // that breaks its contract only fails once the adapter checks: the
        // contract-breaking value arrives verbatim rather than being rejected.
        expect(isInputRequiredResult(answered)).toBe(false);
        expect(answered.structuredContent).toEqual({
          confirmed: validOutput ? true : "invalid",
        });
      } finally {
        await client.close();
        await handler.close();
        http.close();
        http.closeAllConnections();
        await once(http, "close");
      }
    }
  );

  it("retains per-call headers without sharing them between concurrent invocations", async () => {
    const observed: { account: string; header: string; parameter: string }[] =
      [];

    const handler = createMcpHandler(
      (request) => {
        const server = new McpServer({
          name: "header-continuation",
          version: "1",
        });

        server.registerTool(
          "account",
          {
            inputSchema: z.object({
              account: z.string().meta({ "x-mcp-header": "Account" }),
            }),
          },
          async ({ account }) => {
            const header =
              request.requestInfo?.headers.get("x-test-account") ?? "missing";

            observed.push({
              account,
              header,
              parameter:
                request.requestInfo?.headers.get("mcp-param-account") ??
                "missing",
            });

            return { content: [{ type: "text", text: header }] };
          }
        );

        return server;
      },
      { legacy: "reject" }
    );

    const http = createServer(toNodeHandler(handler));
    http.listen(0, "127.0.0.1");
    await once(http, "listening");
    const { port } = z.object({ port: z.number() }).parse(http.address());

    const before = vi.fn(({ args }) =>
      args.account === "default"
        ? undefined
        : {
            args: { account: `${z.string().parse(args.account)}-effective` },
            headers: {
              "X-Test-Account": `${z.string().parse(args.account)}-effective`,
            },
          }
    );

    const after = vi.fn();

    const adapter = new MCPAdapter({
      servers: {
        server: {
          url: `http://127.0.0.1:${port}/mcp`,
          headers: { "X-Test-Account": "default" },
        },
      },
      beforeToolCall: before,
      afterToolCall: after,
    });

    try {
      const [tool] = await adapter.listTools();
      await expect(
        Promise.all([
          tool.invoke({ account: "alpha" }),
          tool.invoke({ account: "beta" }),
        ])
      ).resolves.toEqual(["alpha-effective", "beta-effective"]);
      await expect(tool.invoke({ account: "default" })).resolves.toBe(
        "default"
      );

      // One round per invocation, each carrying only its own effective header.
      for (const account of ["alpha-effective", "beta-effective", "default"]) {
        expect(observed.filter((call) => call.account === account)).toEqual([
          { account, header: account, parameter: account },
        ]);
      }

      expect(before).toHaveBeenCalledTimes(3);
      expect(after).toHaveBeenCalledTimes(3);
    } finally {
      await adapter.close();
      http.close();
      http.closeAllConnections();
      await once(http, "close");
    }
  });
});

describe("real stdio servers", () => {
  it.each(["modern", "mixed"])(
    "resumes accept/decline/cancel against real %s stdio servers",
    async (mode) => {
      const legacyCallback = vi.fn<MCPElicitationHandler>(() => ({
        action: "decline",
      }));

      const servers = {
        legacy: {
          mode: "legacy",
          transport: "stdio",
          command: process.execPath,
          args: [
            "--import",
            "tsx",
            join(__dirname, "fixtures", "sdk1-stdio-server.ts"),
            "legacy",
            "--elicitation",
          ],
          onElicitation: legacyCallback,
        },
        modern: {
          transport: "stdio",
          command: process.execPath,
          args: [
            "--import",
            "tsx",
            join(__dirname, "fixtures", "modern-stdio-server.ts"),
          ],
          elicitation: true,
        },
      } satisfies Record<string, StdioConnectionInit>;

      const adapter = new MCPAdapter({
        servers: Object.fromEntries(
          Object.entries(servers).filter(
            ([name]) => mode === "mixed" || name === "modern"
          )
        ),
        prefixToolNameWithServerName: true,
      });

      try {
        const tools = await adapter.listTools();
        expect(tools).toHaveLength(mode === "mixed" ? 2 : 1);
        const modern = tools.find((tool) => tool.name === "modern__approve");

        if (!modern) {
          throw new Error("Missing modern tool");
        }

        for (const action of ["accept", "decline", "cancel"]) {
          const State = Annotation.Root({ result: Annotation<string>() });

          const graph = new StateGraph(State)
            .addNode("call", async () => ({ result: await modern.invoke({}) }))
            .addEdge(START, "call")
            .addEdge("call", END)
            .compile({ checkpointer: new MemorySaver() });

          const config = { configurable: { thread_id: `${mode}-${action}` } };
          await graph.invoke({ result: "" }, config);
          const state = await graph.getState(config);
          expect(
            state.tasks.flatMap((task) => task.interrupts ?? [])
          ).toHaveLength(1);

          const result = await graph.invoke(
            new Command(
              await answering(graph, config, {
                confirmation:
                  action === "accept"
                    ? { action, content: { confirm: true } }
                    : { action },
              })
            ),
            config
          );

          expect(result.result).toBe(action);
        }

        expect(legacyCallback).not.toHaveBeenCalled();

        if (mode === "mixed") {
          const legacy = tools.find((tool) => tool.name === "legacy__approve");

          if (!legacy) {
            throw new Error("Missing legacy tool");
          }
          expect(await legacy.invoke({})).toBe("decline");
          expect(legacyCallback).toHaveBeenCalledTimes(1);
        }
      } finally {
        await adapter.close();
      }
    }
  );
});

describe("refusing what an interrupt cannot carry", () => {
  it.each([
    { method: "sampling/createMessage", label: "sampling" },
    { method: "roots/list", label: "roots" },
  ])("refuses a $label request by name", async ({ method }) => {
    const round = vi.fn(async () => ({
      resultType: "input_required" as const,
      requestState: "opaque-state",
      inputRequests: { ask: { method, params: {} } },
    }));

    const failure = await callToolWithElicitation(
      round as never,
      { name: "approve", arguments: {} },
      "modern",
      "approve"
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(
      'MCP tool "approve" on server "modern" asked for input this adapter cannot answer'
    );
    // Named by key, so the caller can see which request it was: the refusal
    // is attributed to `ask`, not reported as a bare protocol mismatch.
    expect((failure as Error).message).toContain("ask.method");
    expect((failure as Error).message).toContain(
      'expected "elicitation/create"'
    );

    // Refused before pausing, so the server is never asked a second time.
    expect(round).toHaveBeenCalledTimes(1);
  });

  it("refuses a mixed round naming only the requests it cannot answer", async () => {
    const round = vi.fn(async () => ({
      resultType: "input_required" as const,
      inputRequests: {
        confirmation: {
          method: "elicitation/create",
          params: {
            mode: "form",
            message: "ok?",
            requestedSchema: {
              type: "object",
              properties: { confirm: { type: "boolean" } },
              required: ["confirm"],
            },
          },
        },
        sample: { method: "sampling/createMessage", params: {} },
      },
    }));

    const failure = await callToolWithElicitation(
      round as never,
      { name: "approve", arguments: {} },
      "modern",
      "approve"
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(
      'MCP tool "approve" on server "modern" asked for input this adapter cannot answer'
    );
    expect((failure as Error).message).toContain("sample.method");
    expect((failure as Error).message).toContain(
      'expected "elicitation/create"'
    );
    // Only what it cannot answer: the answerable question goes unmentioned.
    expect((failure as Error).message).not.toContain("confirmation");
  });

  it("rejects a resume that is not shaped like an answer", async () => {
    const h = await harness();

    await h.createGraph().invoke({ done: false }, h.config);
    const [pending] = questionsIn(await h.createGraph().getState(h.config));

    await expect(
      h
        .createGraph()
        .invoke(new Command({ resume: { [pending.id!]: {} } }), h.config)
    ).rejects.toThrow(/needs answers built by createMCPElicitationResume\(\)/);
  });
});
