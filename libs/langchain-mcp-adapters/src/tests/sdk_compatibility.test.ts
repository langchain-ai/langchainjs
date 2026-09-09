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
