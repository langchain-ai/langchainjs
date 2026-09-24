import {
  Client as MCPClient,
  InMemoryTransport,
} from "@modelcontextprotocol/client";
import type { Client, Connection } from "./connection.js";
import type { ResolvedInProcessConnection } from "./types.js";

export interface InProcessConnectionContext {
  serverName: string;
  onToolsChanged?: () => void;
}

const consumedServers = new WeakSet<object>();

export async function connectInProcessServer(
  server: ResolvedInProcessConnection,
  context: InProcessConnectionContext
): Promise<Connection> {
  if (consumedServers.has(server)) {
    throw new Error(
      `The MCP connection for "${context.serverName}" has already been closed and cannot be reused`
    );
  }
  consumedServers.add(server);

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new MCPClient(
    { name: "@langchain/mcp-adapters", version: __PKG_VERSION__ },
    { versionNegotiation: { mode: "auto" } }
  );

  try {
    if (context.onToolsChanged) {
      client.setNotificationHandler("notifications/tools/list_changed", () =>
        context.onToolsChanged?.()
      );
    }

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    if (
      context.onToolsChanged &&
      client.getProtocolEra() === "modern" &&
      client.getServerCapabilities()?.tools?.listChanged
    ) {
      await client.listen({ toolsListChanged: true });
    }

    const connectedClient = client as Client;
    return {
      transport: clientTransport,
      client: connectedClient,
      transportOptions: server,
      closeCallback: async () => {
        const results = await Promise.allSettled([
          connectedClient.close(),
          server.close(),
        ]);
        const errors = results.flatMap((result) =>
          result.status === "rejected" ? [result.reason] : []
        );
        if (errors.length) {
          throw new AggregateError(
            errors,
            "Failed to close in-process MCP connection"
          );
        }
      },
    };
  } catch (error) {
    await Promise.allSettled([
      client.close(),
      clientTransport.close(),
      serverTransport.close(),
      server.close(),
    ]);
    throw error;
  }
}
