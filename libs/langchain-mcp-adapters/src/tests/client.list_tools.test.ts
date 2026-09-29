import { afterEach, describe, expect, test, vi } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { MCPAdapter } from "../client.js";
import type { Client as ConnectedClient } from "../connection.js";
import { ConnectionManager } from "../connection.js";

describe("adapter tool listing", () => {
  afterEach(() => vi.restoreAllMocks());

  test("listTools supports server selection and tool invocation", async () => {
    const connections = new Map<
      string,
      import("../connection.js").Connection
    >();
    vi.spyOn(
      ConnectionManager.prototype,
      "getOrCreateConnection"
    ).mockImplementation(async (serverName, source) => {
      const existing = connections.get(serverName);
      if (existing) return existing;

      const client = new Client({ name: serverName, version: "1" });

      const connected = Object.assign(client, {
        fork: async () => connected,
      }) as ConnectedClient;

      vi.spyOn(client, "listTools").mockResolvedValue({
        tools: [{ name: serverName, inputSchema: { type: "object" } }],
      });
      vi.spyOn(client, "callTool").mockResolvedValue({
        content: [{ type: "text", text: serverName }],
      });

      const opened = {
        client: connected,
        source: source,
        closeCallback: async () => {},
      };
      connections.set(serverName, opened);
      return opened;
    });

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
      const toolsets = await adapter.listToolsets();
      expect(Object.keys(toolsets)).toEqual(["first", "second"]);
      expect(Object.values(toolsets).flat()).toEqual(await adapter.listTools());
      expect(await adapter.initializeConnections()).toEqual(toolsets);
      expect(await toolsets.second[0].invoke({})).toBe("second");
      expect(selected.name).toBe("second");
      expect(await selected.invoke({})).toBe("second");
      expect(
        (await adapter.listTools(["second"])).map((tool) => tool.name)
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
