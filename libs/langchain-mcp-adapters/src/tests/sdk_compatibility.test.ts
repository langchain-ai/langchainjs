import { expect, test, vi } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { loadMcpTools } from "../index.js";

test("loads tools from an external SDK 2 client and forwards request options", async () => {
  const server = new McpServer({ name: "external", version: "1.0.0" });
  server.registerTool(
    "echo",
    { inputSchema: z.object({ value: z.string() }) },
    async ({ value }) => ({ content: [{ type: "text", text: value }] })
  );
  const client = new Client({ name: "consumer", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  try {
    await client.connect(clientTransport);
    const callTool = vi.spyOn(client, "callTool");
    const [echo] = await loadMcpTools("external", client);
    const controller = new AbortController();
    await expect(
      echo.invoke(
        { value: "hello" },
        { signal: controller.signal, metadata: { timeoutMs: 1000 } }
      )
    ).resolves.toBe("hello");
    expect(callTool).toHaveBeenCalledWith(
      { name: "echo", arguments: { value: "hello" } },
      expect.objectContaining({ signal: controller.signal, timeout: 1000 })
    );
  } finally {
    await client.close();
    await server.close();
  }
});

async function withClient(
  configure: (server: McpServer) => void,
  run: (client: Client, serverTransport: InMemoryTransport) => Promise<void>
) {
  const server = new McpServer({ name: "compatibility", version: "1.0.0" });
  configure(server);
  const client = new Client({ name: "consumer", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  try {
    await client.connect(clientTransport);
    await run(client, serverTransport);
  } finally {
    await client.close();
    await server.close();
  }
}

test("preserves SDK output schema validation", async () => {
  await withClient(
    (server) => {
      server.registerTool(
        "validated",
        { outputSchema: z.object({ value: z.string() }) },
        async () => ({ content: [], structuredContent: { value: "valid" } })
      );
    },
    async (client) => {
      const [tool] = await loadMcpTools("external", client);
      // Corrupt a response after server-side validation, before client-side validation.
      const request = client.request.bind(client);
      vi.spyOn(client, "request").mockImplementation(async (...args) => {
        const result = await request(...args);
        if (args[0].method === "tools/call") {
          return { content: [], structuredContent: { value: 123 } };
        }
        return result;
      });
      await expect(tool.invoke({})).rejects.toThrow(/schema|validat/i);
    }
  );
});

test("forwards progress callbacks through the SDK 2 call options", async () => {
  await withClient(
    (server) => {
      server.registerTool(
        "progress",
        { inputSchema: z.object({}) },
        async (_args, extra) => {
          const progressToken = extra.mcpReq._meta?.progressToken;
          if (progressToken === undefined)
            throw new Error("Missing progress token");
          await server.server.notification({
            method: "notifications/progress",
            params: {
              progressToken,
              progress: 1,
              total: 1,
            },
          });
          return { content: [{ type: "text", text: "done" }] };
        }
      );
    },
    async (client) => {
      const onProgress = vi.fn();
      const [tool] = await loadMcpTools("external", client, { onProgress });
      await expect(tool.invoke({})).resolves.toBe("done");
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 1, total: 1 }),
        expect.objectContaining({ name: "progress", server: "external" })
      );
    }
  );
});

test.each(["timeout", "abort"] as const)(
  "honors %s through the SDK 2 call options",
  async (mode) => {
    let started!: () => void;
    const toolStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    await withClient(
      (server) => {
        server.registerTool("slow", {}, async () => {
          started();
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { content: [{ type: "text", text: "done" }] };
        });
      },
      async (client) => {
        const [tool] = await loadMcpTools("external", client);
        const controller = new AbortController();
        const result = tool.invoke(
          {},
          mode === "timeout"
            ? { metadata: { timeoutMs: 5 } }
            : { signal: controller.signal }
        );
        const rejected = expect(result).rejects.toThrow(
          /timeout|timed out|abort/i
        );
        if (mode === "abort") {
          await toolStarted;
          controller.abort();
        }
        await rejected;
      }
    );
  }
);

test("method-string notification handlers still validate incoming messages", async () => {
  await withClient(
    () => {},
    async (client, transport) => {
      const onMessage = vi.fn();
      const onError = vi.fn();
      client.onerror = onError;
      client.setNotificationHandler("notifications/message", onMessage);
      await transport.send({
        jsonrpc: "2.0",
        method: "notifications/message",
        params: { level: "invalid-level", data: "invalid" },
      });
      await transport.send({
        jsonrpc: "2.0",
        method: "notifications/message",
        params: { level: "info", data: "valid" },
      });
      await vi.waitFor(() => expect(onMessage).toHaveBeenCalledTimes(1));
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({ level: "info", data: "valid" }),
        })
      );
      expect(onError).toHaveBeenCalled();
    }
  );
});
