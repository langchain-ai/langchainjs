import { Server as LegacyServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport as LegacyTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListResourcesRequestSchema,
  SubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer, type ServerResponse } from "node:http";
import { once } from "node:events";
import { join } from "node:path";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { z } from "zod";
import { ElicitRequestSchema } from "@modelcontextprotocol/core";
import { MCPAdapterInit, isDescriptorConnection } from "../types.js";
import { MCPAdapter } from "../index.js";

import {
  Annotation,
  Command,
  END,
  MemorySaver,
  START,
  StateGraph,
  type Interrupt,
} from "@langchain/langgraph";
import type {
  CallToolResult,
  InputRequest,
} from "@modelcontextprotocol/client";

import { describe, expect, it, vi } from "vitest";
import {
  callToolWithElicitation,
  createMCPElicitationResume,
  modernElicitationRequestSchema,
  validateElicitationAnswer,
} from "../elicitation.js";
import type { MCPElicitationRequest } from "../elicitation.js";
import { isToolException } from "../utils/errors.js";

const form = {
  message: "Approve deployment?",
  requestedSchema: {
    type: "object",
    properties: { confirm: { type: "boolean" } },
    required: ["confirm"],
  },
} satisfies MCPElicitationRequest;

describe("elicitation answers", () => {
  it("projects modern form requests without legacy task metadata", () => {
    const request = {
      method: "elicitation/create",
      params: { mode: "form", ...form },
    };
    expect(
      modernElicitationRequestSchema.parse({
        ...request,
        params: {
          ...request.params,
          task: { ttl: 1000 },
          _meta: { application: "example" },
          extension: true,
        },
      })
    ).toEqual(request.params);
  });

  it("projects modern URL requests without weakening legacy validation", () => {
    const request = {
      method: "elicitation/create",
      params: {
        mode: "url",
        message: "Continue in browser",
        url: "https://example.com/authorize",
      },
    };
    expect(modernElicitationRequestSchema.parse(request)).toEqual(
      request.params
    );
    expect(() => ElicitRequestSchema.parse(request)).toThrow(z.ZodError);
    expect(
      modernElicitationRequestSchema.parse({
        ...request,
        params: {
          ...request.params,
          elicitationId: "legacy",
          task: { ttl: 1000 },
          _meta: { application: "example" },
          extension: true,
        },
      })
    ).toEqual(request.params);
    for (const invalid of [
      { ...request, method: "tools/call" },
      { ...request, params: { ...request.params, url: "invalid" } },
      { ...request, params: { ...request.params, message: 42 } },
    ])
      expect(() => modernElicitationRequestSchema.parse(invalid)).toThrow(
        z.ZodError
      );
  });
  it("retains the SDK-required legacy URL identifier", () => {
    const params = {
      mode: "url",
      message: "Continue in browser",
      url: "https://example.com/approve",
      elicitationId: "approval",
    };
    expect(
      ElicitRequestSchema.parse({ method: "elicitation/create", params }).params
    ).toEqual(params);
    expect(() =>
      ElicitRequestSchema.parse({
        method: "elicitation/create",
        params: { ...params, elicitationId: undefined },
      })
    ).toThrow(z.ZodError);
  });
  it("accepts schema-valid form content", async () => {
    const answer = { action: "accept", content: { confirm: false } };
    expect(await validateElicitationAnswer(form, answer)).toEqual(answer);
  });

  it.each(["decline", "cancel"])(
    "allows %s without form content",
    async (action) => {
      expect(await validateElicitationAnswer(form, { action })).toEqual({
        action,
      });
    }
  );

  it.each([
    null,
    { action: "unknown" },
    { action: "accept" },
    { action: "accept", content: { confirm: "yes" } },
  ])("rejects invalid answers: %j", async (answer) => {
    await expect(validateElicitationAnswer(form, answer)).rejects.toThrow(
      z.ZodError
    );
  });

  it("reports SDK form validation errors under content", async () => {
    await expect(
      validateElicitationAnswer(form, {
        action: "accept",
        content: { confirm: "yes" },
      })
    ).rejects.toMatchObject({
      issues: [
        { path: ["content"], message: expect.stringContaining("confirm") },
      ],
    });
  });

  it("rejects form content in URL answers", async () => {
    await expect(
      validateElicitationAnswer(
        {
          mode: "url",
          message: "Continue in browser",
          url: "https://example.com/approve",
          elicitationId: "approval",
        },
        { action: "accept", content: { confirm: true } }
      )
    ).rejects.toThrow(/URL/);
  });
});

/** Why each failing scenario is refused, and whether it reached the callback. */
const legacyFailures: Record<string, { reason: string; asked: string[] }> = {
  // The requested schema, not just the result envelope, rejects the answer.
  invalid: {
    reason: "data/confirm must be boolean",
    asked: ["Approve legacy?"],
  },
  throws: { reason: "Application rejected input", asked: ["Approve legacy?"] },
  // Refused before the question reaches an application that cannot answer it.
  missing: { reason: "Client does not support form elicitation", asked: [] },
};

it.each(["accept", "decline", "cancel", "invalid", "throws", "missing"])(
  "handles legacy adapter elicitation: %s",
  async (scenario) => {
    const questions: string[] = [];

    const adapter = new MCPAdapter({
      servers: {
        legacy: {
          mode: "legacy",
          transport: "stdio",
          command: "node",
          args: [
            "--import",
            "tsx",
            "--no-warnings",
            join(__dirname, "fixtures", "sdk1-stdio-server.ts"),
            "legacy",
            "--elicitation",
          ],
          onElicitation:
            scenario === "missing"
              ? undefined
              : (request, context) => {
                  expect(context.server).toBe("legacy");
                  expect(context.signal.aborted).toBe(false);
                  questions.push(request.message);

                  if (scenario === "throws")
                    throw new Error("Application rejected input");

                  if (scenario === "decline" || scenario === "cancel")
                    return { action: scenario };

                  return {
                    action: "accept",
                    content: { confirm: scenario === "invalid" ? "yes" : true },
                  };
                },
        },
      },
    });

    try {
      const [tool] = await adapter.listTools();

      if (["accept", "decline", "cancel"].includes(scenario)) {
        expect(await tool.invoke({})).toBe(scenario);
        expect(questions).toEqual(["Approve legacy?"]);
      } else {
        const { reason, asked } = legacyFailures[scenario];
        const failure = await tool.invoke({}).catch((error: unknown) => error);

        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).toContain(reason);
        // Whether the application was consulted at all is part of the contract.
        expect(questions).toEqual(asked);
      }
    } finally {
      await adapter.close();
    }
  }
);

it("answers legacy reverse requests using the same callback contract", async () => {
  const { Client, InMemoryTransport } =
    await import("@modelcontextprotocol/client");

  const { configureElicitation } = await import("../elicitation.js");
  const server = new McpServer({ name: "legacy", version: "1" });
  server.registerTool(
    "approve",
    { inputSchema: z.object({}) },
    async (_, context) => {
      const answer = await context.mcpReq.elicitInput(form);

      return { content: [{ type: "text", text: answer.action }] };
    }
  );

  const client = new Client(
    { name: "test", version: "1" },
    {
      capabilities: { elicitation: { form: {}, url: {} } },
      versionNegotiation: { mode: "legacy" },
    }
  );

  configureElicitation(client, "legacy", (_, context) => {
    expect(context.server).toBe("legacy");

    return { action: "decline" };
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  try {
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    const { loadMcpTools } = await import("../index.js");
    const [tool] = await loadMcpTools("legacy", client);
    expect(await tool.invoke({})).toBe("decline");
  } finally {
    await client.close();
    await server.close();
  }
});

it("aborts an in-flight elicitation when the server cancels it", async () => {
  {
    let resolveElicitationStarted: () => void = () => {};
    const elicitationStarted = new Promise<void>((resolve) => {
      resolveElicitationStarted = resolve;
    });
    let elicitationSignal: AbortSignal | undefined;

    const adapter = new MCPAdapter({
      servers: {
        legacy: {
          mode: "legacy",
          transport: "stdio",
          command: "node",
          args: [
            "--import",
            "tsx",
            "--no-warnings",
            join(__dirname, "fixtures", "sdk1-stdio-server.ts"),
            "legacy",
            "--elicitation",
            "--cancel-elicitation",
          ],
          onElicitation: async (_, { signal }) => {
            elicitationSignal = signal;
            resolveElicitationStarted();
            await new Promise<void>((resolve) => {
              signal.addEventListener("abort", () => resolve(), { once: true });
            });

            return { action: "cancel" };
          },
        },
      },
    });

    try {
      const [tool] = await adapter.listTools();
      const invocation = tool.invoke({}).then(
        () => ({ status: "fulfilled" as const }),
        (error) => ({ status: "rejected" as const, error })
      );

      await elicitationStarted;
      await vi.waitFor(() => expect(elicitationSignal?.aborted).toBe(true), {
        timeout: 2_000,
      });
      await expect(invocation).resolves.toEqual(
        expect.objectContaining({ status: "rejected" })
      );
    } finally {
      await adapter.close();
    }
  }
});

it.each([true, false])(
  "subscribes to modern catalog changes with external observer %s",
  async (externalObserver) => {
    let toolName = "first";
    let requests = 0;
    const logs: unknown[] = [];
    let changed: () => void = () => {};

    const notification = new Promise<void>((resolve) => {
      changed = resolve;
    });
    const observer = vi.fn(() => changed());

    const handler = createMcpHandler(
      () => {
        const server = new McpServer(
          { name: "catalog", version: "1" },
          {
            capabilities: { tools: { listChanged: true }, logging: {} },
            cacheHints: {
              "tools/list": { ttlMs: 60_000, cacheScope: "private" },
            },
          }
        );

        requests += 1;
        server.registerTool(
          toolName,
          { inputSchema: z.object({}) },
          async (_args, context) => {
            await context.mcpReq.log("info", "catalog invoked");

            return { content: [] };
          }
        );

        return server;
      },
      { legacy: "reject" }
    );

    const http = createServer(toNodeHandler(handler));
    http.listen(0, "127.0.0.1");
    await once(http, "listening");
    const address = z.object({ port: z.number() }).parse(http.address());
    let timestamp = Date.now();
    const clock = vi.spyOn(Date, "now").mockImplementation(() => timestamp);

    const adapter = new MCPAdapter({
      servers: {
        catalog: {
          transport: "http",
          url: `http://127.0.0.1:${address.port}/mcp`,
          logLevel: "info",
          onMessage: (message) => {
            logs.push(message.data);
          },
          onToolsListChanged: externalObserver ? observer : undefined,
        },
      },
    });

    try {
      const [first] = await adapter.listTools();
      await first.invoke({});
      expect(logs).toEqual(["catalog invoked"]);
      await expect(adapter.setLoggingLevel("debug")).rejects.toThrow(
        /legacy-only/
      );
      const beforeCache = requests;
      expect((await adapter.listTools())[0]).toBe(first);
      expect(requests).toBe(beforeCache);
      toolName = "second";
      await handler.notify.toolsChanged();

      if (externalObserver) await notification;
      await vi.waitFor(async () =>
        expect((await adapter.listTools())[0].name).toContain("second")
      );
      // The catalog refreshes either way; only a configured observer is told.
      expect(observer).toHaveBeenCalledTimes(externalObserver ? 1 : 0);
      toolName = "third";
      expect(
        (await adapter.listTools([], { cacheMode: "bypass" }))[0].name
      ).toContain("third");
      expect((await adapter.listTools())[0].name).toContain("second");
      expect(
        (await adapter.listTools([], { cacheMode: "refresh" }))[0].name
      ).toContain("third");
      timestamp += 60_001;
      toolName = "expired";
      expect((await adapter.listTools())[0].name).toContain("expired");
      expect(first.name).toContain("first");
    } finally {
      clock.mockRestore();
      await adapter.close();
      await handler.close();
      http.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        http.close((error) => (error ? reject(error) : resolve()))
      );
    }
  }
);

describe("elicitation and logging configuration", () => {
  it("uses SDK logging levels", () => {
    expect(
      MCPAdapterInit.safeParse({
        servers: { modern: { url: "http://localhost/mcp", logLevel: "info" } },
      }).success
    ).toBe(true);

    const invalid = MCPAdapterInit.safeParse({
      servers: { modern: { url: "http://localhost/mcp", logLevel: "trace" } },
    });

    expect(invalid.success).toBe(false);

    if (!invalid.success)
      expect(JSON.stringify(invalid.error.issues)).toContain('"logLevel"');
  });

  it.each([
    {
      servers: {
        modern: {
          command: "node",
          args: [],
          onElicitation: () => ({ action: "decline" }),
        },
      },
    },
    {
      servers: {
        legacy: {
          mode: "legacy",
          command: "node",
          args: [],
          elicitation: true,
        },
      },
    },
    {
      servers: { modern: { command: "node", args: [] } },
      onElicitation: () => ({ action: "decline" }),
    },
    {
      servers: { modern: { command: "node", args: [] } },
      elicitation: true,
    },
    { servers: { modern: { command: "node", args: [] } }, logLevel: "info" },
  ])("rejects unsupported server policy with Zod errors: %j", (input) => {
    const parsed = MCPAdapterInit.safeParse(input);
    expect(parsed.success).toBe(false);

    if (!parsed.success) expect(parsed.error.issues.length).toBeGreaterThan(0);
  });
});

it.each([true, false])(
  "watches configured modern resource URIs (supported: %s)",
  async (supported) => {
    const updated = vi.fn();

    const handler = createMcpHandler(
      () => {
        const server = new McpServer(
          { name: "resources", version: "1" },
          {
            capabilities: { resources: { subscribe: supported } },
          }
        );

        server.registerResource("watched", "test://watched", {}, async () => ({
          contents: [{ uri: "test://watched", text: "value" }],
        }));

        return server;
      },
      { legacy: "reject" }
    );

    const http = createServer(toNodeHandler(handler));
    http.listen(0, "127.0.0.1");
    await once(http, "listening");
    const { port } = z.object({ port: z.number() }).parse(http.address());

    const adapter = new MCPAdapter({
      servers: {
        resources: {
          url: `http://127.0.0.1:${port}/mcp`,
          resourceSubscriptions: ["test://watched"],
          onResourcesUpdated: updated,
        },
      },
    });

    try {
      if (!supported) {
        await expect(adapter.listResources()).rejects.toThrow(
          /does not support resource subscriptions/
        );

        return;
      }

      await adapter.listResources();
      await handler.notify.resourceUpdated("test://ignored");
      await handler.notify.resourceUpdated("test://watched");
      await vi.waitFor(() => expect(updated).toHaveBeenCalledTimes(1));
      expect(updated.mock.calls[0][0]).toMatchObject({
        uri: "test://watched",
        _meta: { "io.modelcontextprotocol/subscriptionId": expect.any(String) },
      });
      await adapter.close();
      await handler.notify.resourceUpdated("test://watched");
      expect(updated).toHaveBeenCalledTimes(1);
    } finally {
      await adapter.close();
      http.close();
      http.closeAllConnections();
      await once(http, "close");
    }
  }
);

it("accepts modern reconnect settings and rejects invalid resource subscriptions", () => {
  expect(
    MCPAdapterInit.safeParse({
      servers: {
        server: {
          url: "https://example.com/mcp",
          reconnect: { enabled: true },
        },
      },
    }).success
  ).toBe(true);

  expect(
    MCPAdapterInit.safeParse({
      servers: {
        server: {
          url: "https://example.com/mcp",
          resourceSubscriptions: [42],
        },
      },
    }).success
  ).toBe(false);

  const parsed = MCPAdapterInit.parse({
    servers: {
      server: {
        mode: "legacy",
        url: "https://example.com/mcp",
        reconnect: { enabled: false },
      },
    },
  });
  if (!("servers" in parsed)) {
    throw new Error("Expected named config");
  }
  const server = parsed.servers.server;
  if (!isDescriptorConnection(server) || server.transport !== "http") {
    throw new Error("Expected HTTP config");
  }
  expect(server.mode).toBe("legacy");
});

it("auto-detects legacy subscriptions without advertising callback elicitation", async () => {
  const subscribed: string[] = [];
  const updated = vi.fn();

  const server = new LegacyServer(
    { name: "legacy-resources", version: "1" },
    {
      capabilities: { resources: { subscribe: true } },
    }
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
  }));
  server.setRequestHandler(SubscribeRequestSchema, async ({ params }) => {
    subscribed.push(params.uri);

    return {};
  });

  const transport = new LegacyTransport({
    sessionIdGenerator: () => "resource-subscription-test",
  });

  await server.connect(transport);

  const http = createServer((req, res) => {
    transport.handleRequest(req, res);
  });

  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const { port } = z.object({ port: z.number() }).parse(http.address());

  const adapter = new MCPAdapter({
    servers: {
      resources: {
        url: `http://127.0.0.1:${port}/mcp`,
        resourceSubscriptions: ["test://watched"],
        onResourcesUpdated: updated,
      },
    },
  });

  try {
    await adapter.listResources();
    expect(subscribed).toEqual(["test://watched"]);
    expect(server.getClientCapabilities()).not.toHaveProperty("elicitation");
  } finally {
    await adapter.close();
    await server.close();
    http.close();
    http.closeAllConnections();
    await once(http, "close");
  }
});

it("does not replay a modern tool whose response stream is lost", async () => {
  let response: ServerResponse | undefined;
  let executions = 0;

  const handler = createMcpHandler(
    () => {
      const server = new McpServer({ name: "disconnect", version: "1" });
      server.registerTool(
        "disconnect",
        { inputSchema: z.object({}) },
        async () => {
          executions += 1;
          response?.destroy();

          return { content: [] };
        }
      );

      return server;
    },
    { legacy: "reject" }
  );

  const serve = toNodeHandler(handler);

  const http = createServer((req, res) => {
    response = res;
    serve(req, res);
  });

  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const { port } = z.object({ port: z.number() }).parse(http.address());

  const adapter = new MCPAdapter({
    servers: { server: { url: `http://127.0.0.1:${port}/mcp` } },
  });

  try {
    const [tool] = await adapter.listTools();
    await expect(tool.invoke({})).rejects.toThrow(
      /Error calling tool disconnect/
    );
    expect(executions).toBe(1);
  } finally {
    await adapter.close();
    http.close();
    http.closeAllConnections();
    await once(http, "close");
  }
});

/** One form question, as a server would put it on the wire. */
function elicitQuestion(message: string): InputRequest {
  return {
    method: "elicitation/create" as const,
    params: {
      mode: "form" as const,
      message,
      requestedSchema: {
        type: "object" as const,
        properties: { confirm: { type: "boolean" }, note: { type: "string" } },
        required: ["confirm"],
      },
    },
  };
}

const interruptsIn = (snapshot: {
  tasks: readonly { interrupts?: readonly Interrupt<unknown>[] }[];
}) => snapshot.tasks.flatMap((task) => [...(task.interrupts ?? [])]);

describe("resuming an elicitation", () => {
  const accepted = { action: "accept" as const, content: { confirm: true } };

  /** One question, then completion once it is answered. */
  async function askOnce() {
    const served: unknown[] = [];
    const State = Annotation.Root({ done: Annotation<boolean>() });

    const graph = new StateGraph(State)
      .addNode("call", async () => {
        await callToolWithElicitation(
          async (params) => {
            served.push(params.inputResponses);
            if (params.inputResponses)
              return {
                content: [{ type: "text", text: "done" }],
              } as CallToolResult;
            return {
              resultType: "input_required" as const,
              requestState: "opaque",
              inputRequests: { confirmation: elicitQuestion("approve $10") },
            };
          },
          { name: "approve", arguments: { label: "operation" } },
          "modern",
          "approve"
        );
        return { done: true };
      })
      .addEdge(START, "call")
      .addEdge("call", END)
      .compile({ checkpointer: new MemorySaver() });

    const config = {
      configurable: { thread_id: `resume-${served.length}-${Math.random()}` },
    };
    await graph.invoke({ done: false }, config);
    const [raised] = interruptsIn(await graph.getState(config));
    return { graph, config, raised, served };
  }

  it("accepts an answer built by createMCPElicitationResume", async () => {
    const { graph, config, raised, served } = await askOnce();

    await expect(
      graph.invoke(
        new Command({
          resume: createMCPElicitationResume(raised, {
            confirmation: accepted,
          }),
        }),
        config
      )
    ).resolves.toMatchObject({ done: true });

    expect(served.filter(Boolean)).toHaveLength(1);
  });

  // Each is a resume the parse must refuse, and none may reach the server.
  it.each([
    { name: "no answers at all", body: { responses: {} } },
    {
      name: "an answer under the wrong key",
      body: { responses: { wrong: accepted } },
    },
    {
      name: "an unexpected extra answer",
      body: { responses: { confirmation: accepted, extra: accepted } },
    },
    {
      name: "an action the protocol does not define",
      body: { responses: { confirmation: { action: "sideways" } } },
    },
    {
      name: "content that does not fit the requested schema",
      body: {
        responses: {
          confirmation: { action: "accept", content: { confirm: "yes" } },
        },
      },
    },
    {
      name: "responses that are not wrapped",
      body: { confirmation: accepted },
    },
    { name: "null", body: null },
    { name: "a string", body: "not an answer" },
  ])("refuses $name", async ({ body }) => {
    const { graph, config, raised, served } = await askOnce();

    await expect(
      graph.invoke(new Command({ resume: { [raised.id!]: body } }), config)
    ).rejects.toSatisfy(isToolException);

    // A refused resume never reaches the server carrying an answer.
    expect(served.filter(Boolean)).toEqual([]);
  });
});
