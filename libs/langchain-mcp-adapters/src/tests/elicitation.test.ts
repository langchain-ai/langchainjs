import { createServer } from "node:http";
import { once } from "node:events";
import { join } from "node:path";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { z } from "zod";
import { adapterConfigSchema } from "../types.js";
import { MCPAdapter } from "../index.js";

import { describe, expect, it, vi } from "vitest";
import { sdkSchema, validateElicitationAnswer } from "../elicitation.js";
import type {
  MCPElicitationRequest,
} from "../elicitation.js";

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
