import {
  InterruptMCPClient,
  PendingMCPInput,
  withMCPInterrupts,
} from "../continuation.js";
import {
  Client,
  StreamableHTTPClientTransport,
  specTypeSchemas,
  withInputRequired,
  isInputRequiredResult,
} from "@modelcontextprotocol/client";
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
  StateGraph,
  Annotation,
  MemorySaver,
  START,
  END,
  Command,
} from "@langchain/langgraph";
import { z } from "zod";
import { expect, it, vi } from "vitest";
import { MCPAdapter } from "../index.js";
import type { MCPElicitationHandler } from "../elicitation.js";

it.each([
  "accept",
  "url",
  "url-content",
  "state-only",
  "bad-content",
  "wrong-key",
  "extra-key",
  "concurrent",
  "headers",
  "outside-graph",
  "outside-graph-complete",
  "outside-graph-headers",
  "without-checkpointer",
])("resumes a reconstructed adapter: %s", async (scenario) => {
  const calls: string[] = [];

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
          calls.push(label);

          if (
            ["outside-graph-complete", "outside-graph-headers"].includes(
              scenario
            )
          ) {
            return {
              content: [{ type: "text", text: "approved" }],
              structuredContent: { approved: true },
            };
          }

          if (scenario === "state-only") {
            return calls.length === 1
              ? inputRequired({
                  requestState: "opaque:+/%==",
                  inputRequests: {},
                })
              : {
                  content: [{ type: "text", text: "approved" }],
                  structuredContent: { approved: true },
                };
          }

          if (!context.mcpReq.inputResponses?.confirmation) {
            return inputRequired({
              requestState: "opaque:+/%==",
              inputRequests: {
                confirmation: ["url", "url-content"].includes(scenario)
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

          return {
            content: [{ type: "text", text: "approved" }],
            structuredContent: { approved: true },
          };
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
    headers: ["headers", "outside-graph-headers"].includes(scenario)
      ? { "X-Test": "fixture" }
      : undefined,
  }));

  const after = vi.fn();

  const createAdapter = () =>
    new MCPAdapter({
      servers: {
        modern: {
          transport: "http",
          url: `http://127.0.0.1:${address.port}`,
          elicitationMode: "interrupt",
        },
      },
      beforeToolCall: before,
      afterToolCall: after,
    });

  let adapter = createAdapter();
  const checkpointer = new MemorySaver();
  const State = Annotation.Root({ done: Annotation<boolean>() });

  const createGraph = () =>
    new StateGraph(State)
      .addNode("call", async () => {
        const [tool] = await adapter.getTools();
        await tool.invoke({ label: "original" });

        return { done: true };
      })
      .addEdge(START, "call")
      .addEdge("call", END)
      .compile({
        checkpointer:
          scenario === "without-checkpointer" ? undefined : checkpointer,
      });

  const config = { configurable: { thread_id: "durable-round" } };

  try {
    const graph = createGraph();

    if (scenario === "state-only") {
      expect((await graph.invoke({ done: false }, config)).done).toBe(true);
      expect(calls).toHaveLength(2);
      expect(before).toHaveBeenCalledTimes(1);
      expect(after).toHaveBeenCalledTimes(1);

      return;
    }

    if (scenario === "headers") {
      await expect(graph.invoke({ done: false }, config)).rejects.toThrow(
        /header overrides/
      );
      expect(calls).toHaveLength(0);

      return;
    }

    if (scenario === "outside-graph") {
      const [tool] = await adapter.getTools();
      await expect(tool.invoke({ label: "original" })).rejects.toThrow(
        /inside a LangGraph with a checkpointer/
      );
      expect(calls).toHaveLength(1);

      return;
    }

    if (
      ["outside-graph-complete", "outside-graph-headers"].includes(scenario)
    ) {
      const [tool] = await adapter.getTools();
      await expect(tool.invoke({ label: "original" })).resolves.toBeDefined();
      expect(calls).toHaveLength(1);

      return;
    }

    if (scenario === "without-checkpointer") {
      await expect(graph.invoke({ done: false }, config)).rejects.toThrow(
        /No checkpointer set/
      );
      expect(calls).toHaveLength(1);

      return;
    }

    await graph.invoke({ done: false }, config);
    const snapshot = await graph.getState(config);

    const questions = snapshot.tasks.flatMap((entry) => entry.interrupts ?? []);

    expect(questions).toHaveLength(1);
    if (["url", "url-content"].includes(scenario)) {
      expect(questions[0].value).toMatchObject({
        requests: {
          confirmation: { mode: "url", url: "https://example.com/authorize" },
        },
      });
      expect(JSON.stringify(questions)).not.toContain("elicitationId");
    }
    expect(JSON.stringify(questions)).toContain("effective");
    expect(JSON.stringify(questions)).not.toContain("opaque");
    expect(calls).toEqual(["effective"]);
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).not.toHaveBeenCalled();
    const peerConfig = { configurable: { thread_id: "independent-round" } };

    if (scenario === "concurrent") {
      await graph.invoke({ done: false }, peerConfig);
      expect(calls).toEqual(["effective", "effective"]);
    }

    await adapter.close();
    adapter = createAdapter();

    const answer =
      scenario === "url"
        ? { action: "accept" }
        : {
            action: "accept",
            content: { confirm: scenario === "bad-content" ? "yes" : true },
          };

    const resume =
      scenario === "wrong-key"
        ? { wrong: answer }
        : scenario === "extra-key"
          ? { confirmation: answer, extra: answer }
          : { confirmation: answer };

    const pending = createGraph().invoke(new Command({ resume }), config);

    if (["accept", "url", "concurrent"].includes(scenario)) {
      const resumed = await pending;
      expect(resumed.done).toBe(true);
      expect(calls).toHaveLength(scenario === "concurrent" ? 3 : 2);
      expect(after).toHaveBeenCalledTimes(1);

      if (scenario === "concurrent") {
        const peerResult = await createGraph().invoke(
          new Command({ resume: { confirmation: { action: "cancel" } } }),
          peerConfig
        );

        expect(peerResult.done).toBe(true);
        expect(calls).toHaveLength(4);
        expect(after).toHaveBeenCalledTimes(2);
      }
    } else {
      await expect(pending).rejects.toBeInstanceOf(z.ZodError);
      expect(calls).toEqual(["effective"]);
      expect(after).not.toHaveBeenCalled();
    }

    expect(before).toHaveBeenCalledTimes(scenario === "concurrent" ? 2 : 1);
  } finally {
    await adapter.close();
    await handler.close();
    http.close();
    http.closeAllConnections();
    await once(http, "close");
  }
});

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
      ).rejects.toThrow(/output schema but did not return structured content/);

      const round = await client.request(
        { method: "tools/call", params: { name: "confirm", arguments: {} } },
        withInputRequired(specTypeSchemas.CallToolResult),
        { allowInputRequired: true }
      );

      expect(isInputRequiredResult(round)).toBe(true);

      const interruptClient = new InterruptMCPClient(
        { name: "interrupt-probe", version: "1" },
        {
          versionNegotiation: { mode: "auto" },
          capabilities: { elicitation: { form: {} } },
        }
      );

      try {
        await interruptClient.connect(
          new StreamableHTTPClientTransport(
            new URL(`http://127.0.0.1:${address.port}`)
          )
        );
        await interruptClient.listTools();
        await expect(
          interruptClient.callTool({ name: "confirm", arguments: {} })
        ).rejects.toBeInstanceOf(PendingMCPInput);

        const params = {
          name: "confirm",
          arguments: {},
          inputResponses: {
            confirm: { action: "accept", content: { confirmed: true } },
          },
        };

        if (validOutput) {
          const result = await interruptClient.callTool(params);
          expect(result.structuredContent).toEqual({ confirmed: true });
        } else {
          await expect(interruptClient.callTool(params)).rejects.toThrow();
        }
      } finally {
        await interruptClient.close();
      }
    } finally {
      await client.close();
      await handler.close();
      http.close();
      http.closeAllConnections();
      await once(http, "close");
    }
  }
);

it.each(["state-only", "limit", "abort", "transport"])(
  "bounds graph continuation without user questions: %s",
  async (scenario) => {
    const controller = new AbortController();
    let calls = 0;
    const State = Annotation.Root({ result: Annotation<string>() });

    const graph = new StateGraph(State)
      .addNode("call", async () => ({
        result: await withMCPInterrupts(
          async (continuation) => {
            calls += 1;

            if (scenario === "transport") throw new Error("transport failure");

            if (continuation) {
              expect(continuation.requestState).toBe("opaque-state");
              expect(continuation.inputResponses).toEqual({});

              if (scenario === "state-only") return "done";
            }

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

    if (scenario === "state-only") {
      expect((await invocation).result).toBe("done");
      expect(calls).toBe(2);
    } else {
      await expect(invocation).rejects.toThrow(
        scenario === "limit"
          ? /round limit/
          : scenario === "transport"
            ? /transport/
            : /abort/i
      );
      expect(calls).toBe(scenario === "limit" ? 3 : 1);
    }
  }
);

it("resumes a modern stdio interrupt after reconstructing the adapter and server process", async () => {
  const before = vi.fn();
  const after = vi.fn();

  const createAdapter = () =>
    new MCPAdapter({
      servers: {
        modern: {
          transport: "stdio",
          command: process.execPath,
          args: [
            "--import",
            "tsx",
            join(__dirname, "fixtures", "modern-stdio-server.ts"),
          ],
          elicitationMode: "interrupt",
        },
      },
      beforeToolCall: before,
      afterToolCall: after,
    });

  let adapter = createAdapter();
  const State = Annotation.Root({ done: Annotation<string>() });
  const checkpointer = new MemorySaver();

  const graph = () =>
    new StateGraph(State)
      .addNode("call", async () => {
        const [tool] = await adapter.getTools();

        return { done: await tool.invoke({}) };
      })
      .addEdge(START, "call")
      .addEdge("call", END)
      .compile({ checkpointer });

  const config = { configurable: { thread_id: "stdio-reconstruction" } };

  try {
    const pending = await graph().invoke({}, config);
    expect(pending).toHaveProperty("__interrupt__.length", 1);
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).not.toHaveBeenCalled();
    await adapter.close();
    adapter = createAdapter();

    const result = await graph().invoke(
      new Command({
        resume: {
          confirmation: { action: "accept", content: { confirm: true } },
        },
      }),
      config
    );

    expect(result.done).toBe("accept");
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
  } finally {
    await adapter.close();
  }
});

it("recognizes pending input across adapter copies without matching lookalikes", async () => {
  const pending = {
    kind: "input_required",
    inputRequests: {},
  } satisfies ConstructorParameters<typeof PendingMCPInput>[0];
  const request = { name: "confirm", arguments: {} };
  const original = new PendingMCPInput(pending, request);
  vi.resetModules();
  const duplicate = await import("../continuation.js");

  expect(duplicate.PendingMCPInput).not.toBe(PendingMCPInput);
  expect(duplicate.PendingMCPInput.isInstance(original)).toBe(true);
  expect(
    PendingMCPInput.isInstance(new duplicate.PendingMCPInput(pending, request))
  ).toBe(true);
  expect(PendingMCPInput.isInstance({ pending, request })).toBe(false);
  expect(PendingMCPInput.isInstance(new Error("MCP tool requires input"))).toBe(
    false
  );
});

it("bounds answered elicitation rounds without replaying earlier requests", async () => {
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
  const resume = { confirmation: { action: "decline" } };
  await graph.invoke(new Command({ resume }), config);
  expect(calls).toBe(2);
  await expect(graph.invoke(new Command({ resume }), config)).rejects.toThrow(
    /round limit/
  );
  expect(calls).toBe(3);
});

it.each(["modern", "mixed"])(
  "resumes accept/decline/cancel against real %s stdio servers",
  async (mode) => {
    const legacyCallback = vi.fn<MCPElicitationHandler>(() => ({
      action: "decline",
    }));
    const adapter = new MCPAdapter({
      servers: {
        ...(mode === "mixed"
          ? {
              legacy: {
                transport: "stdio",
                command: process.execPath,
                args: [
                  "--import",
                  "tsx",
                  join(__dirname, "fixtures", "sdk1-stdio-server.ts"),
                  "legacy",
                  "--elicitation",
                ],
              },
            }
          : {}),
        modern: {
          transport: "stdio",
          command: process.execPath,
          args: [
            "--import",
            "tsx",
            join(__dirname, "fixtures", "modern-stdio-server.ts"),
          ],
          elicitationMode: "interrupt",
        },
      },
      prefixToolNameWithServerName: true,
      onElicitation: legacyCallback,
    });
    try {
      const tools = await adapter.getTools();
      expect(tools).toHaveLength(mode === "mixed" ? 2 : 1);
      const modern = tools.find((tool) => tool.name === "modern__approve");
      if (!modern) throw new Error("Missing modern tool");
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
          new Command({
            resume: {
              confirmation:
                action === "accept"
                  ? { action, content: { confirm: true } }
                  : { action },
            },
          }),
          config
        );
        expect(result.result).toBe(action);
      }
      expect(legacyCallback).not.toHaveBeenCalled();
      if (mode === "mixed") {
        const legacy = tools.find((tool) => tool.name === "legacy__approve");
        if (!legacy) throw new Error("Missing legacy tool");
        expect(await legacy.invoke({})).toBe("decline");
        expect(legacyCallback).toHaveBeenCalledTimes(1);
      }
    } finally {
      await adapter.close();
    }
  }
);
