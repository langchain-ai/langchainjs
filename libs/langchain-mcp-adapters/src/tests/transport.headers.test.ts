import { describe, expect, it } from "vitest";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { SSEClientTransport } from "@modelcontextprotocol/client";
import { ConnectionManager } from "../connection.js";
import { ConnectionSchema } from "../types.js";

/** An `authProvider` holding one static token (or none), the smallest shape the SDK adapts. */
const staticProvider = (token: string | undefined) =>
  ({
    get redirectUrl() {
      return "http://localhost/cb";
    },
    get clientMetadata() {
      return { redirect_uris: ["http://localhost/cb"] };
    },
    clientInformation: () => undefined,
    tokens: () =>
      token === undefined
        ? undefined
        : { access_token: token, token_type: "Bearer" },
    saveTokens: () => {},
    redirectToAuthorization: () => {},
    saveCodeVerifier: () => {},
    codeVerifier: () => "verifier",
  }) as never;

/** Record what a transport actually puts on the wire. */
async function recordingServer(failFast = false): Promise<{
  url: string;
  seen: IncomingHttpHeaders[];
  server: Server;
}> {
  const seen: IncomingHttpHeaders[] = [];
  const server = createServer((req, res) => {
    seen.push(req.headers);
    if (failFast) {
      // Speak no MCP: the request headers are the subject, and a prompt
      // failure keeps the test off the handshake's timeout.
      res.writeHead(500).end();
      return;
    }
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write("event: endpoint\ndata: /messages\n\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/sse`, seen, server };
}

describe("what the transports send", () => {
  it("SSE: the SDK authorizes a connection with no custom fetch of ours", async () => {
    const { url, seen, server } = await recordingServer();
    const transport = new SSEClientTransport(new URL(url), {
      authProvider: staticProvider("from-provider"),
      requestInit: { headers: { "x-custom": "1" } },
    } as never);

    await transport.start();
    await transport.close();
    server.close();

    expect(seen[0].authorization).toBe("Bearer from-provider");
    expect(seen[0]["x-custom"]).toBe("1");
    expect(seen[0].accept).toContain("text/event-stream");
  });

  // SDK >= 2.1.0 (#2475): once the provider has a token it replaces a
  // configured Authorization in any spelling, and the two never join.
  it.each([
    ["sse", "authorization"],
    ["sse", "Authorization"],
    ["sse", "AUTHORIZATION"],
    ["http", "authorization"],
    ["http", "Authorization"],
    ["http", "AUTHORIZATION"],
  ] as const)(
    "%s: the provider's token replaces a configured %s",
    async (transport, spelling) => {
      const { url, seen, server } = await recordingServer(true);
      const manager = new ConnectionManager();
      const connection = {
        ...ConnectionSchema.parse({
          mode: "legacy",
          transport,
          url,
          automaticSSEFallback: false,
          headers: { [spelling]: "Bearer from-config" },
        }),
        authProvider: staticProvider("from-provider"),
      } as never;

      await (
        transport === "sse"
          ? manager.createClient("sse", "svc", connection)
          : manager.createClient("http", "svc", connection)
      ).catch(() => {
        // The recording server speaks no MCP; the request is what matters.
      });

      await manager.delete();
      server.close();

      expect(seen.length).toBeGreaterThan(0);
      expect(seen[0].authorization).toBe("Bearer from-provider");
    }
  );

  it.each(["sse", "http"] as const)(
    "%s: a configured Authorization is sent while the provider has no token",
    async (transport) => {
      const { url, seen, server } = await recordingServer(true);
      const manager = new ConnectionManager();
      const connection = {
        ...ConnectionSchema.parse({
          mode: "legacy",
          transport,
          url,
          automaticSSEFallback: false,
          headers: { Authorization: "Bearer from-config" },
        }),
        authProvider: staticProvider(undefined),
      } as never;

      await (
        transport === "sse"
          ? manager.createClient("sse", "svc", connection)
          : manager.createClient("http", "svc", connection)
      ).catch(() => {});

      await manager.delete();
      server.close();

      expect(seen[0].authorization).toBe("Bearer from-config");
    }
  );
});
