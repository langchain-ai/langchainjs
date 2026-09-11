import { afterEach, describe, expect, test, vi } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { MCPAdapter } from "../client.js";
import type { Client as ConnectedClient } from "../connection.js";
import { ConnectionManager } from "../connection.js";

describe("adapter tool listing", () => {
  afterEach(() => vi.restoreAllMocks());

  test("listTools and the deprecated alias share selection and invocation behavior", async () => {
    const clients = new Map<string, ConnectedClient>();
    vi.spyOn(ConnectionManager.prototype, "get").mockImplementation((key) =>
      clients.get(typeof key === "string" ? key : key.serverName)
    );
    vi.spyOn(ConnectionManager.prototype, "createClient").mockImplementation(
      async (_transport, serverName) => {
        const client = new Client({ name: serverName, version: "1" });

        const connected = Object.assign(client, {
          fork: async () => connected,
        });

        vi.spyOn(client, "listTools").mockResolvedValue({
          tools: [{ name: serverName, inputSchema: { type: "object" } }],
        });
        vi.spyOn(client, "callTool").mockResolvedValue({
          content: [{ type: "text", text: serverName }],
        });

        clients.set(serverName, connected);

        return connected;
      }
    );

    const adapter = new MCPAdapter({
      servers: {
        first: { command: "node", args: [] },
        second: { command: "node", args: [] },
      },
    });

    try {
      expect((await adapter.listTools()).map((tool) => tool.name)).toEqual([
        "first",
        "second",
      ]);
      const [selected] = await adapter.listTools("second");
      expect(selected.name).toBe("second");
      expect(await selected.invoke({})).toBe("second");
      expect(
        (await adapter.getTools(["second"])).map((tool) => tool.name)
      ).toEqual(["second"]);
      expect(
        (await adapter.listTools(["first"], { headers: {} })).map(
          (tool) => tool.name
        )
      ).toEqual(["first"]);
    } finally {
      await adapter.close();
    }
  });
});
