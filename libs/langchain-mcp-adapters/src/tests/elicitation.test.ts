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
import { adapterConfigSchema } from "../types.js";
import { MCPAdapter } from "../index.js";

import { describe, expect, it, vi } from "vitest";
import { sdkSchema, validateElicitationAnswer } from "../elicitation.js";
import type { MCPElicitationRequest } from "../elicitation.js";

const form = {
  message: "Approve deployment?",
  requestedSchema: {
    type: "object",
    properties: { confirm: { type: "boolean" } },
    required: ["confirm"],
  },
} satisfies MCPElicitationRequest;

describe("elicitation answers", () => {
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
    await expect(validateElicitationAnswer(form, answer)).rejects.toThrow();
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
        await expect(tool.invoke({})).rejects.toThrow();
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
          onToolsListChanged: externalObserver ? changed : undefined,
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
      adapterConfigSchema.safeParse({
        servers: { modern: { url: "http://localhost/mcp", logLevel: "info" } },
      }).success
    ).toBe(true);

    const invalid = adapterConfigSchema.safeParse({
      servers: { modern: { url: "http://localhost/mcp", logLevel: "trace" } },
    });

    expect(invalid.success).toBe(false);

    if (!invalid.success)
      expect(JSON.stringify(invalid.error.issues)).toContain(
        "Invalid MCP logging level"
      );
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
          maxElicitationRounds: 2,
        },
      },
    },
    {
      servers: {
        legacy: { mode: "legacy", command: "node", args: [], logLevel: "info" },
      },
    },
    {
      servers: { modern: { command: "node", args: [] } },
      onElicitation: () => ({ action: "decline" }),
    },
    {
      servers: { modern: { command: "node", args: [] } },
      maxElicitationRounds: 2,
    },
    { servers: { modern: { command: "node", args: [] } }, logLevel: "info" },
  ])("rejects unsupported server policy with Zod errors: %j", (input) => {
    const parsed = adapterConfigSchema.safeParse(input);
    expect(parsed.success).toBe(false);

    if (!parsed.success) expect(parsed.error.issues.length).toBeGreaterThan(0);
  });
});

it("composes Standard Schema defaults and issue paths through Zod", async () => {
  const parser = sdkSchema(z.object({ label: z.string().default("default") }));
  expect(await parser.parseAsync({})).toEqual({ label: "default" });
  const result = await parser.safeParseAsync({ label: 42 });
  expect(result.success).toBe(false);

  if (!result.success) expect(result.error.issues[0].path).toEqual(["label"]);
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
      expect(updated.mock.calls[0][0]).toMatchObject({ uri: "test://watched" });
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

it("rejects modern reconnect settings and invalid resource subscriptions", () => {
  for (const options of [
    { reconnect: { enabled: true } },
    { resourceSubscriptions: [42] },
  ]) {
    expect(
      adapterConfigSchema.safeParse({
        servers: {
          server: {
            url: "https://example.com/mcp",
            ...options,
          },
        },
      }).success
    ).toBe(false);
  }

  expect(
    adapterConfigSchema.parse({
      servers: {
        server: {
          mode: "legacy",
          url: "https://example.com/mcp",
          reconnect: { enabled: false },
        },
      },
    }).mcpServers.server.mode
  ).toBe("legacy");
});

it("routes legacy resource subscriptions through resources/subscribe", async () => {
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
        mode: "legacy",
        url: `http://127.0.0.1:${port}/mcp`,
        automaticSSEFallback: false,
        resourceSubscriptions: ["test://watched"],
        onResourcesUpdated: updated,
      },
    },
  });

  try {
    await adapter.listResources();
    expect(subscribed).toEqual(["test://watched"]);
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
    await expect(tool.invoke({})).rejects.toThrow();
    expect(executions).toBe(1);
  } finally {
    await adapter.close();
    http.close();
    http.closeAllConnections();
    await once(http, "close");
  }
});
