import { createServer } from "node:http";
import { once } from "node:events";
import { join } from "node:path";
import {
  createMcpHandler,
  inputRequired,
  McpServer,
} from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { z } from "zod";
import { MCPAdapter } from "../index.js";

import { describe, expect, it, vi } from "vitest";
import { validateElicitationAnswer } from "../elicitation.js";
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

it.each(["accept", "invalid", "throws", "exhausted", "missing"])(
  "handles modern elicitation: %s",
  async (scenario) => {
    let calls = 0;

    const handler = createMcpHandler(
      () => {
        const server = new McpServer({ name: "elicitation", version: "1" });
        server.registerTool(
          "approve",
          {
            inputSchema: z.object({ label: z.string() }),
            outputSchema: z.object({ approved: z.boolean() }),
          },
          async ({ label }, context) => {
            calls += 1;
            const response = context.mcpReq.inputResponses?.confirmation;

            if (!response || scenario === "exhausted") {
              return inputRequired({
                inputRequests: {
                  confirmation: inputRequired.elicit({
                    ...form,
                    message: label,
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
      throw new Error("Missing HTTP address");
    const questions: string[] = [];

    const adapter = new MCPAdapter({
      servers: {
        legacy: {
          transport: "stdio",
          command: "node",
          args: [
            "--import",
            "tsx",
            "--no-warnings",
            join(__dirname, "fixtures", "sdk1-stdio-server.ts"),
            "legacy",
          ],
        },
        modern: { transport: "http", url: `http://127.0.0.1:${address.port}` },
      },
      maxElicitationRounds: 2,
      onElicitation:
        scenario === "missing"
          ? undefined
          : (request, context) => {
              expect(context.server).toBe("modern");
              expect(context.signal.aborted).toBe(false);
              questions.push(request.message);

              if (scenario === "throws")
                throw new Error("Application rejected input");

              return {
                action: "accept",
                content: { confirm: scenario === "invalid" ? "yes" : true },
              };
            },
    });

    try {
      const tools = await adapter.getTools();

      const tool = tools.find((candidate) =>
        candidate.name.endsWith("approve")
      );

      const legacy = tools.find((candidate) =>
        candidate.name.endsWith("legacy_tool")
      );

      if (!tool || !legacy) throw new Error("Mixed server discovery failed");
      expect(await legacy.invoke({ input: "hello" })).toBe("legacy:hello");

      if (scenario === "accept") {
        await tool.invoke({ label: "Deploy?" });
        expect(questions).toEqual(["Deploy?"]);
        expect(calls).toBe(2);
      } else {
        await expect(tool.invoke({ label: "Deploy?" })).rejects.toThrow();
        expect(calls).toBeLessThanOrEqual(3);
      }
    } finally {
      await adapter.close();
      await handler.close();
      http.close();
      http.closeAllConnections();
      await once(http, "close");
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

it("subscribes to modern catalog changes and honors SDK cache policy", async () => {
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
      },
    },
    logLevel: "info",
    onMessage: (message) => {
      logs.push(message.data);
    },
    onToolsListChanged: changed,
  });
  try {
    const [first] = await adapter.getTools();
    await first.invoke({});
    expect(logs).toEqual(["catalog invoked"]);
    await expect(adapter.setLoggingLevel("debug")).rejects.toThrow(
      /legacy-only/
    );
    const beforeCache = requests;
    expect((await adapter.getTools())[0]).toBe(first);
    expect(requests).toBe(beforeCache);
    toolName = "second";
    await handler.notify.toolsChanged();
    await notification;
    expect((await adapter.getTools())[0].name).toContain("second");
    toolName = "third";
    expect(
      (await adapter.getTools([], { cacheMode: "bypass" }))[0].name
    ).toContain("third");
    expect((await adapter.getTools())[0].name).toContain("second");
    expect(
      (await adapter.getTools([], { cacheMode: "refresh" }))[0].name
    ).toContain("third");
    timestamp += 60_001;
    toolName = "expired";
    expect((await adapter.getTools())[0].name).toContain("expired");
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
});
